// ============================================
// ROUTES: Athlete - Presentation Layer
// ============================================
// Define HTTP routes for athlete operations
// ============================================

import { Router } from 'express'
import { AthleteController } from '../controllers/athleteController'
import { uploadSinglePhoto } from '../../middleware/upload'
import { AnalysisController } from '../controllers/analysisController'

const router = Router()

// Athlete CRUD routes
router.get('/', AthleteController.getAll)           // GET /api/athletes (with optional filters)
router.get('/:id', AthleteController.getById)       // GET /api/athletes/:id
router.post('/', uploadSinglePhoto, AthleteController.create)  // POST /api/athletes (with optional photo)
router.put('/:id', AthleteController.update)        // PUT /api/athletes/:id
router.delete('/:id', AthleteController.delete)     // DELETE /api/athletes/:id

// Photo upload route
router.post('/:id/photo', uploadSinglePhoto, AthleteController.uploadPhoto)  // POST /api/athletes/:id/photo

// Athlete analyses route
router.get('/:athleteId/analyses', AnalysisController.getByAthlete)  // GET /api/athletes/:athleteId/analyses

export default router
