// ============================================
// ROUTES: Claude
// ============================================
// AI autocomplete of the assessment's measured results (Anthropic Claude)
// ============================================

import { Router } from 'express'
import { ClaudeController } from '../controllers/claudeController'
import { uploadClinicalReportFiles } from '../../middleware/claudeUpload'
import { claudeRateLimiter } from '../../middleware/claudeRateLimiter'

const router = Router()

/**
 * POST /api/claude/extract-clinical-results
 * Pre-fill the assessment's measured results from device reports (BTS, InBody, EMG).
 * Only explicitly printed values are returned; the evaluator reviews them in the form.
 * multipart/form-data: files[] (PDF or images, max 5)
 */
router.post('/extract-clinical-results', claudeRateLimiter, uploadClinicalReportFiles, ClaudeController.extractClinicalResults)

export default router
