// ============================================
// ROUTES: Analysis
// ============================================
// HTTP routes for analysis operations
// ============================================

import { Router } from 'express'
import { AnalysisController } from '../controllers/analysisController'
import { uploadAnalysisCreateFiles, uploadFlexibilityEvidence } from '../../middleware/upload'

const router = Router()

// ============================================
// ANALYSIS ROUTES
// ============================================

/**
 * GET /api/analyses
 * Get all analyses with optional filters
 * Query params: athleteId, globalClassification, startDate, endDate
 */
router.get('/', AnalysisController.getAll)

/**
 * GET /api/analyses/:id
 * Get a specific analysis by ID
 */
router.get('/:id', AnalysisController.getById)

/**
 * POST /api/analyses
 * Create a new analysis with optional graph images and Flexibility Assessment evidence
 * Supports multipart/form-data with a 'graphs' field for multiple images and
 * one 'flexibilityEvidence_<exerciseId>' field per Flexibility Assessment exercise
 */
router.post('/', uploadAnalysisCreateFiles, AnalysisController.create)

/**
 * PUT /api/analyses/:id
 * Update an analysis
 */
router.put('/:id', AnalysisController.update)

/**
 * POST /api/analyses/:id/flexibility-evidence
 * Upload or replace the evidence photo for one Flexibility Assessment exercise
 * Supports multipart/form-data with 'exerciseId' (text) and 'evidence' (file) fields
 */
router.post('/:id/flexibility-evidence', uploadFlexibilityEvidence, AnalysisController.uploadFlexibilityEvidence)

/**
 * DELETE /api/analyses/:id/flexibility-evidence/:exerciseId
 * Remove the evidence photo for one Flexibility Assessment exercise (keeps the rating)
 */
router.delete('/:id/flexibility-evidence/:exerciseId', AnalysisController.deleteFlexibilityEvidence)

/**
 * DELETE /api/analyses/:id
 * Delete an analysis and its associated images
 */
router.delete('/:id', AnalysisController.delete)

export default router
