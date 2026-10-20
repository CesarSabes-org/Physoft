// ============================================
// CONTROLLER: Claude - Presentation Layer
// ============================================
// AI autocomplete of the assessment's measured results from device reports
// (BTS, InBody, EMG). Stateless: it only returns suggested values; the
// evaluator reviews them and they are saved with the assessment.
// ============================================

import { Request, Response } from 'express'

// Claude's Messages API caps requests at 32MB. Base64 inflates raw bytes by
// ~4/3, so we reject uploads that would exceed that before ever calling the
// API, rather than surfacing an opaque provider-side rejection.
const MAX_BASE64_REQUEST_BYTES = 28 * 1024 * 1024

export class ClaudeController {
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
