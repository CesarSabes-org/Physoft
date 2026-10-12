// ============================================
// ROUTES: Claude
// ============================================
// HTTP routes for AI-assisted Textual Analysis (Anthropic Claude)
// ============================================

import { Router } from 'express'
import { ClaudeController } from '../controllers/claudeController'
import { uploadClaudeFiles, uploadClinicalReportFiles } from '../../middleware/claudeUpload'
import { claudeRateLimiter } from '../../middleware/claudeRateLimiter'

const router = Router()

/**
 * POST /api/claude/analyze-assessment
 * Generate an AI analysis for one Textual Analysis checkbox type.
 * multipart/form-data: checkboxType, userPrompt?, patientContext?, assessmentId?, patientId, files[]
 */
router.post('/analyze-assessment', claudeRateLimiter, uploadClaudeFiles.array('files', 5), ClaudeController.analyzeAssessment)

/**
 * POST /api/claude/extract-clinical-results
 * Pre-fill the assessment's measured results from device reports (BTS, InBody, EMG).
 * Only explicitly printed values are returned; the evaluator reviews them in the form.
 * multipart/form-data: files[] (PDF or images, max 5)
 */
router.post('/extract-clinical-results', claudeRateLimiter, uploadClinicalReportFiles, ClaudeController.extractClinicalResults)

export default router
