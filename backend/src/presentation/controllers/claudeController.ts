// ============================================
// CONTROLLER: Claude - Presentation Layer
// ============================================
// Handles the AI-assisted Textual Analysis endpoint. Stateless with respect
// to the app database (like /analyses/ai-analyze) — the frontend merges the
// result into local state and it is persisted only when the whole assessment
// is saved via the existing /analyses create/update endpoints.
//
// Also gathers the richer clinical context (patient demographics via a
// direct Prisma lookup, plus evaluation date and the physiotherapist's
// additional clinical notes passed through from the still-unsaved New
// Assessment form) and hands it to claudeAnalysisService, which builds the
// actual prompts.
// ============================================

import { Request, Response } from 'express'
import { UploadService } from '../../application/services/uploadService'
import { CHECKLIST_TYPES, ChecklistType } from '../../domain/types/claudeAnalysis'
import { prisma } from '../../infrastructure/prismaClient'
import type { PatientDemographics } from '../../application/services/claude/promptBuilder'

// Claude's Messages API caps requests at 32MB. Base64 inflates raw bytes by
// ~4/3, so we reject uploads that would exceed that before ever calling the
// API, rather than surfacing an opaque provider-side rejection.
const MAX_BASE64_REQUEST_BYTES = 28 * 1024 * 1024

function calculateAgeFromBirthDate(birthDate: string | null | undefined): number | undefined {
  if (!birthDate) return undefined
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return undefined

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * Best-effort patient demographics lookup for AI context. Never throws —
 * a DB hiccup or deleted patient should never fail the AI call, just fall
 * back to whatever thin patientContext the frontend already sent.
 */
async function fetchPatientDemographics(patientId: string | undefined): Promise<PatientDemographics | null> {
  if (!patientId) return null

  try {
    const athlete = await prisma.athlete.findUnique({
      where: { id: patientId },
      select: { name: true, gender: true, birthDate: true, sport: true, height: true, weight: true, patientType: true }
    })
    if (!athlete) return null

    return {
      name: athlete.name,
      age: calculateAgeFromBirthDate(athlete.birthDate),
      gender: athlete.gender,
      sport: athlete.sport,
      height: athlete.height,
      weight: athlete.weight,
      patientType: athlete.patientType
    }
  } catch (error) {
    console.error('[Claude] Athlete lookup failed for AI context (non-fatal):', error)
    return null
  }
}

export class ClaudeController {
  /**
   * POST /api/claude/analyze-assessment
   */
  static async analyzeAssessment(req: Request, res: Response) {
    try {
      const {
        checkboxType,
        userPrompt,
        patientContext: patientContextRaw,
        assessmentId,
        patientId,
        evaluationDate,
        clinicalNotes
      } = req.body

      if (!CHECKLIST_TYPES.includes(checkboxType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid checkboxType. Must be one of: ${CHECKLIST_TYPES.join(', ')}`
        })
      }

      if (checkboxType === 'free' && (!userPrompt || String(userPrompt).trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'A prompt is required for the "Free" analysis type'
        })
      }

      let patientContext: any = undefined
      if (patientContextRaw) {
        try {
          patientContext = typeof patientContextRaw === 'string' ? JSON.parse(patientContextRaw) : patientContextRaw
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid patientContext format' })
        }
      }

      const files = (req.files as Express.Multer.File[]) || []
      const imageMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])

      const imageFiles = files
        .filter(f => imageMimeTypes.has(f.mimetype))
        .map(f => ({ buffer: f.buffer, mimeType: f.mimetype }))

      const pdfFiles = files
        .filter(f => f.mimetype === 'application/pdf')
        .map(f => ({ buffer: f.buffer, filename: f.originalname }))

      // Reject empty (0-byte) files explicitly rather than silently sending
      // them to the AI provider.
      const emptyFile = files.find(f => f.size === 0)
      if (emptyFile) {
        return res.status(400).json({
          success: false,
          error: `File "${emptyFile.originalname}" is empty (0 bytes)`
        })
      }

      const totalRawBytes = files.reduce((sum, f) => sum + f.size, 0)
      const estimatedBase64Bytes = Math.ceil(totalRawBytes * 4 / 3)
      if (estimatedBase64Bytes > MAX_BASE64_REQUEST_BYTES) {
        return res.status(400).json({
          success: false,
          error: 'The attached files are too large for one AI request. Please reduce the number or size of files (max ~5 files, 10MB each, and keep total attachments modest).'
        })
      }

      // Gather the richer clinical context. Best-effort / non-fatal —
      // a demographics lookup failure can't fail the AI call itself.
      const patientDemographics = await fetchPatientDemographics(patientId as string | undefined)

      // Lazy import, so a missing ANTHROPIC_API_KEY only surfaces when this
      // endpoint is actually used, not at server boot.
      let claudeAnalysisService: typeof import('../../application/services/claudeAnalysisService').default
      try {
        claudeAnalysisService = (await import('../../application/services/claudeAnalysisService')).default
      } catch (initError: any) {
        return res.status(503).json({
          success: false,
          error: 'AI analysis service is not configured. Please set ANTHROPIC_API_KEY in the server environment.'
        })
      }

      const { aiResponse, tokensUsed } = await claudeAnalysisService.analyzeAssessment({
        checkboxType: checkboxType as ChecklistType,
        userPrompt: userPrompt || null,
        patientContext,
        imageFiles,
        pdfFiles,
        patientDemographics,
        evaluationDate: (evaluationDate as string) || null,
        clinicalNotes: (clinicalNotes as string) || null
      })

      // Persist the uploaded files to Cloudinary for the audit trail.
      const uploadResourceId = (assessmentId as string) || (patientId as string) || 'unfiled'
      const folder = `physoft/analysis/${uploadResourceId}/textual-analysis`
      const uploadedFiles: string[] = []

      for (const file of files) {
        try {
          const isPdf = file.mimetype === 'application/pdf'
          const result = isPdf
            ? await UploadService.uploadDocument(file, uploadResourceId, folder)
            : await UploadService.uploadPhoto(file, uploadResourceId, folder)
          uploadedFiles.push(result.url)
        } catch (uploadError) {
          // Non-fatal: the AI analysis already succeeded. Log and continue
          // without that file's URL rather than losing the AI response.
          console.error('⚠️ Failed to persist a Textual Analysis file to Cloudinary:', uploadError)
        }
      }

      return res.json({
        success: true,
        data: { checkboxType, aiResponse, tokensUsed, uploadedFiles },
        message: 'AI analysis completed successfully'
      })
    } catch (error: any) {
      console.error('Error in Claude analyzeAssessment:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error processing AI analysis'
      })
    }
  }

  /**
   * POST /api/claude/extract-clinical-results
   * Stateless: returns suggested values only; nothing is persisted here.
   */
  static async extractClinicalResults(req: Request, res: Response) {
    try {
      const files = (req.files as Express.Multer.File[]) || []

      if (files.length === 0) {
        return res.status(400).json({ success: false, error: 'Attach at least one report (PDF or image)' })
      }

      const emptyFile = files.find(f => f.size === 0)
      if (emptyFile) {
        return res.status(400).json({ success: false, error: `File "${emptyFile.originalname}" is empty (0 bytes)` })
      }

      const totalRawBytes = files.reduce((sum, f) => sum + f.size, 0)
      if (Math.ceil(totalRawBytes * 4 / 3) > MAX_BASE64_REQUEST_BYTES) {
        return res.status(400).json({
          success: false,
          error: 'The attached files are too large for one AI request. Please reduce the number or size of files.'
        })
      }

      const imageMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
      const imageFiles = files
        .filter(f => imageMimeTypes.has(f.mimetype))
        .map(f => ({ buffer: f.buffer, mimeType: f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype }))
      const pdfFiles = files
        .filter(f => f.mimetype === 'application/pdf')
        .map(f => ({ buffer: f.buffer, filename: f.originalname }))

      let claudeAnalysisService: typeof import('../../application/services/claudeAnalysisService').default
      try {
        claudeAnalysisService = (await import('../../application/services/claudeAnalysisService')).default
      } catch {
        return res.status(503).json({
          success: false,
          error: 'AI analysis service is not configured. Please set ANTHROPIC_API_KEY in the server environment.'
        })
      }

      const result = await claudeAnalysisService.extractClinicalResults({ imageFiles, pdfFiles })

      return res.json({
        success: true,
        data: result,
        message: `${Object.keys(result.values).length} value(s) found`
      })
    } catch (error: any) {
      console.error('Error in Claude extractClinicalResults:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error extracting values from the reports'
      })
    }
  }
}
