// ============================================
// CONTROLLER: Analysis - Presentation Layer
// ============================================
// Handles HTTP requests related to analyses
// ============================================

import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../infrastructure/prismaClient'
import { UploadService } from '../../application/services/uploadService'
import { ComparisonService } from '../../application/services/ComparisonService'
import { isFlexibilityExerciseId, normalizeFlexibilityAssessment, FlexibilityAssessmentItem } from '../../domain/types/flexibilityAssessment'
import { normalizeClinicalResults, ClinicalResults, ClinicalResultsValidationError } from '../../domain/types/clinicalResults'

/**
 * Prisma's Json input types require an index signature that a plain named
 * interface doesn't structurally provide. This narrow cast (via `unknown`,
 * not `any`) is the standard escape hatch for writing a strongly-typed
 * domain shape into a `Json` column.
 */
function toInputJson(items: FlexibilityAssessmentItem[] | ClinicalResults): Prisma.InputJsonValue {
  return items as unknown as Prisma.InputJsonValue
}

export class AnalysisController {
  /**
   * GET /api/analyses
   * Get all analyses with optional filters
   */
  static async getAll(req: Request, res: Response) {
    try {
      const { athleteId, globalClassification, startDate, endDate } = req.query

      // Build dynamic filters
      const where: any = {}

      if (athleteId) {
        where.athleteId = athleteId as string
      }

      if (globalClassification) {
        where.globalClassification = globalClassification as string
      }

      if (startDate || endDate) {
        where.evaluationDate = {}
        if (startDate) {
          where.evaluationDate.gte = new Date(startDate as string)
        }
        if (endDate) {
          where.evaluationDate.lte = new Date(endDate as string)
        }
      }

      const analyses = await prisma.analysis.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              accessCode: true,
              name: true,
              sport: true,
              photo: true
            }
          }
        },
        orderBy: {
          evaluationDate: 'desc',
        },
      })

      return res.json({
        success: true,
        data: analyses,
        total: analyses.length,
      })
    } catch (error) {
      console.error('Error fetching analyses:', error)
      return res.status(500).json({
        success: false,
        error: 'Error fetching analyses',
      })
    }
  }

  /**
   * GET /api/analyses/:id
   * Get an analysis by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const analysis = await prisma.analysis.findUnique({
        where: { id: parseInt(id) },
        include: {
          athlete: true,
        },
      })

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        })
      }

      return res.json({
        success: true,
        data: analysis,
      })
    } catch (error) {
      console.error('Error fetching analysis:', error)
      return res.status(500).json({
        success: false,
        error: 'Error fetching analysis',
      })
    }
  }

  /**
   * GET /api/athletes/:athleteId/analyses
   * Get all analyses for a specific athlete
   */
  static async getByAthlete(req: Request, res: Response) {
    try {
      const { athleteId } = req.params

      // Verify athlete exists
      const athlete = await prisma.athlete.findUnique({
        where: { id: athleteId }
      })

      if (!athlete || athlete.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Athlete not found',
        })
      }

      const analyses = await prisma.analysis.findMany({
        where: { athleteId },
        orderBy: {
          evaluationDate: 'desc',
        },
      })

      return res.json({
        success: true,
        data: analyses,
        total: analyses.length,
      })
    } catch (error) {
      console.error('Error fetching athlete analyses:', error)
      return res.status(500).json({
        success: false,
        error: 'Error fetching athlete analyses',
      })
    }
  }

  /**
   * POST /api/analyses
   * Create a new analysis with optional graph images
   */
  static async create(req: Request, res: Response) {
    try {
      const {
        athleteId,
        evaluationDate,
        weakPoints, // JSON string array
        power,
        endurance,
        strength,
        flexibility,
        speed,
        globalClassification,
        cohortClassification, // AI-generated cohort classification
        coachRecommendations,
        flexibilityAssessment, // Flexibility Assessment ratings (array), JSON string over multipart
        clinicalResults // Measured/observed results for report boxes 2-9, JSON string over multipart
      } = req.body

      // Validate required fields
      if (!athleteId || !evaluationDate) {
        return res.status(400).json({
          success: false,
          error: 'athleteId and evaluationDate are required',
        })
      }

      // Validated before any file is uploaded, so a bad payload never leaves
      // orphaned images behind.
      let parsedClinicalResults: ClinicalResults | undefined = undefined
      if (clinicalResults !== undefined && clinicalResults !== null && clinicalResults !== '') {
        try {
          parsedClinicalResults = normalizeClinicalResults(clinicalResults)
        } catch (validationError) {
          if (validationError instanceof ClinicalResultsValidationError) {
            return res.status(400).json({ success: false, error: validationError.message })
          }
          throw validationError
        }
      }

      // Verify athlete exists
      const athlete = await prisma.athlete.findUnique({
        where: { id: athleteId }
      })

      if (!athlete || athlete.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Athlete not found',
        })
      }

      // Validate physical capacities (0-100)
      const validateCapacity = (value: any, name: string) => {
        if (value !== undefined && value !== null) {
          const num = parseInt(value)
          if (isNaN(num) || num < 0 || num > 100) {
            throw new Error(`${name} must be between 0 and 100`)
          }
          return num
        }
        return null
      }

      // Files arrive grouped by field name ('graphs' plus one
      // 'flexibilityEvidence_<exerciseId>' field per exercise) via uploadAnalysisCreateFiles.
      const filesByField = (req.files || {}) as { [fieldname: string]: Express.Multer.File[] }
      let tempAnalysisId = `temp_${Date.now()}`

      // Handle multiple graph images upload
      let graphImagesArray: string[] = []
      const graphFiles = filesByField['graphs'] || []

      if (graphFiles.length > 0) {
        const uploadPromises = graphFiles.map(async (file) => {
          const result = await UploadService.uploadPhoto(
            file,
            tempAnalysisId,
            `physoft/analysis/${tempAnalysisId}`
          )
          return result.url
        })
        graphImagesArray = await Promise.all(uploadPromises)
      }

      // Calculate global classification based on capacities average and cohort comparison
      let calculatedGlobalClassification = globalClassification || 'medium'

      if (power !== undefined || endurance !== undefined || strength !== undefined ||
        flexibility !== undefined || speed !== undefined) {
        const capacitiesAverage = ComparisonService.calculateCapacitiesAverage({
          power: validateCapacity(power, 'Power'),
          endurance: validateCapacity(endurance, 'Endurance'),
          strength: validateCapacity(strength, 'Strength'),
          flexibility: validateCapacity(flexibility, 'Flexibility'),
          speed: validateCapacity(speed, 'Speed')
        })

        // Calculate classification based on comparison with same sport/bodyType
        calculatedGlobalClassification = await ComparisonService.calculateGlobalClassification(
          athleteId,
          capacitiesAverage
        )
      }

      // Flexibility Assessment: validate the submitted ratings, then upload
      // each exercise's evidence photo (if provided) under its own field
      // name so it maps back to the right exercise unambiguously.
      let parsedFlexibilityAssessment: FlexibilityAssessmentItem[] | undefined = undefined
      if (flexibilityAssessment !== undefined && flexibilityAssessment !== null && flexibilityAssessment !== '') {
        const rawItems = typeof flexibilityAssessment === 'string'
          ? JSON.parse(flexibilityAssessment)
          : flexibilityAssessment
        const normalized = normalizeFlexibilityAssessment(rawItems)

        const withEvidence = await Promise.all(normalized.map(async (item) => {
          const evidenceFile = filesByField[`flexibilityEvidence_${item.exerciseId}`]?.[0]
          if (!evidenceFile) return item

          const result = await UploadService.uploadPhoto(
            evidenceFile,
            `${tempAnalysisId}_${item.exerciseId}`,
            `physoft/analysis/${tempAnalysisId}/flexibility`
          )
          return { ...item, evidenceUrl: result.url, evidencePublicId: result.publicId || null }
        }))

        // Drop exercises the user never touched (no rating, no evidence)
        const meaningful = withEvidence.filter((item) => item.rating !== null || item.evidenceUrl !== null)
        parsedFlexibilityAssessment = meaningful.length > 0 ? meaningful : undefined
      }

      const newAnalysis = await prisma.analysis.create({
        data: {
          athleteId,
          evaluationDate: new Date(evaluationDate),
          graphImages: graphImagesArray.length > 0 ? JSON.stringify(graphImagesArray) : null,
          weakPoints: weakPoints || null,
          power: validateCapacity(power, 'Power'),
          endurance: validateCapacity(endurance, 'Endurance'),
          strength: validateCapacity(strength, 'Strength'),
          flexibility: validateCapacity(flexibility, 'Flexibility'),
          speed: validateCapacity(speed, 'Speed'),
          globalClassification: calculatedGlobalClassification,
          cohortClassification: cohortClassification || null, // From AI or manual input
          coachRecommendations: coachRecommendations || null,
          flexibilityAssessment: parsedFlexibilityAssessment ? toInputJson(parsedFlexibilityAssessment) : undefined,
          clinicalResults: parsedClinicalResults ? toInputJson(parsedClinicalResults) : undefined,
        },
        include: {
          athlete: {
            select: {
              id: true,
              accessCode: true,
              name: true,
              sport: true
            }
          }
        }
      })

      return res.status(201).json({
        success: true,
        data: newAnalysis,
        message: 'Analysis created successfully',
      })
    } catch (error: any) {
      console.error('Error creating analysis:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error creating analysis',
      })
    }
  }

  /**
   * PUT /api/analyses/:id
   * Update an analysis
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const {
        evaluationDate,
        weakPoints,
        power,
        endurance,
        strength,
        flexibility,
        speed,
        globalClassification,
        cohortClassification,
        coachRecommendations,
        flexibilityAssessment,
        clinicalResults
      } = req.body

      // clinicalResults uses the same full-replace contract as
      // flexibilityAssessment; explicit null clears it.
      let clinicalResultsUpdate: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined = undefined
      if (clinicalResults === null) {
        clinicalResultsUpdate = Prisma.DbNull
      } else if (clinicalResults !== undefined) {
        try {
          clinicalResultsUpdate = toInputJson(normalizeClinicalResults(clinicalResults))
        } catch (validationError) {
          if (validationError instanceof ClinicalResultsValidationError) {
            return res.status(400).json({ success: false, error: validationError.message })
          }
          throw validationError
        }
      }

      // Check if analysis exists
      const existing = await prisma.analysis.findUnique({
        where: { id: parseInt(id) }
      })

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        })
      }

      // Validate physical capacities. Explicit null / '' clears the value
      // (only undefined means "not sent, leave unchanged").
      const validateCapacity = (value: any, name: string) => {
        if (value === null || value === '') return null
        if (value !== undefined) {
          const num = parseInt(value)
          if (isNaN(num) || num < 0 || num > 100) {
            throw new Error(`${name} must be between 0 and 100`)
          }
          return num
        }
        return undefined
      }

      const updatedAnalysis = await prisma.analysis.update({
        where: { id: parseInt(id) },
        data: {
          ...(evaluationDate && { evaluationDate: new Date(evaluationDate) }),
          ...(weakPoints !== undefined && { weakPoints }),
          ...(power !== undefined && { power: validateCapacity(power, 'Power') }),
          ...(endurance !== undefined && { endurance: validateCapacity(endurance, 'Endurance') }),
          ...(strength !== undefined && { strength: validateCapacity(strength, 'Strength') }),
          ...(flexibility !== undefined && { flexibility: validateCapacity(flexibility, 'Flexibility') }),
          ...(speed !== undefined && { speed: validateCapacity(speed, 'Speed') }),
          ...(globalClassification !== undefined && { globalClassification }),
          ...(cohortClassification !== undefined && { cohortClassification }),
          ...(coachRecommendations !== undefined && { coachRecommendations }),
          // flexibilityAssessment is sent as the full array (ratings + the
          // evidenceUrl/evidencePublicId already known client-side), same
          // full-replace contract. Evidence file
          // mutations themselves go through the dedicated endpoints below.
          ...(flexibilityAssessment !== undefined && {
            flexibilityAssessment: (() => {
              const raw = typeof flexibilityAssessment === 'string'
                ? JSON.parse(flexibilityAssessment)
                : flexibilityAssessment
              if (raw === null) return Prisma.DbNull
              const normalized = normalizeFlexibilityAssessment(raw)
              return normalized.length > 0 ? toInputJson(normalized) : Prisma.DbNull
            })()
          }),
          ...(clinicalResultsUpdate !== undefined && { clinicalResults: clinicalResultsUpdate }),
        },
        include: {
          athlete: {
            select: {
              id: true,
              accessCode: true,
              name: true,
              sport: true
            }
          }
        }
      })

      return res.json({
        success: true,
        data: updatedAnalysis,
        message: 'Analysis updated successfully',
      })
    } catch (error: any) {
      console.error('Error updating analysis:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error updating analysis',
      })
    }
  }

  /**
   * POST /api/analyses/:id/flexibility-evidence
   * Upload (or replace) the evidence photo for one Flexibility Assessment exercise
   */
  static async uploadFlexibilityEvidence(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { exerciseId } = req.body

      if (!isFlexibilityExerciseId(exerciseId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or missing exerciseId',
        })
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No evidence file provided',
        })
      }

      const analysis = await prisma.analysis.findUnique({
        where: { id: parseInt(id) }
      })

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        })
      }

      const currentItems = normalizeFlexibilityAssessment(analysis.flexibilityAssessment)
      const existing = currentItems.find((item) => item.exerciseId === exerciseId)

      // Replacing an existing evidence photo: delete the previous asset first
      if (existing?.evidencePublicId) {
        await UploadService.deletePhoto(existing.evidencePublicId)
      }

      const uploadResult = await UploadService.uploadPhoto(
        req.file,
        `analysis_${id}_${exerciseId}`,
        `physoft/analysis/${id}/flexibility`
      )

      const updatedItems = existing
        ? currentItems.map((item) => item.exerciseId === exerciseId
          ? { ...item, evidenceUrl: uploadResult.url, evidencePublicId: uploadResult.publicId || null }
          : item)
        : [...currentItems, {
          exerciseId,
          rating: null,
          evidenceUrl: uploadResult.url,
          evidencePublicId: uploadResult.publicId || null
        }]

      const updatedAnalysis = await prisma.analysis.update({
        where: { id: parseInt(id) },
        data: { flexibilityAssessment: toInputJson(updatedItems) },
        include: {
          athlete: {
            select: {
              id: true,
              accessCode: true,
              name: true,
              sport: true
            }
          }
        }
      })

      return res.json({
        success: true,
        data: updatedAnalysis,
        message: 'Evidence uploaded successfully',
      })
    } catch (error: any) {
      console.error('Error uploading flexibility evidence:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error uploading evidence',
      })
    }
  }

  /**
   * DELETE /api/analyses/:id/flexibility-evidence/:exerciseId
   * Remove the evidence photo for one Flexibility Assessment exercise (keeps the rating)
   */
  static async deleteFlexibilityEvidence(req: Request, res: Response) {
    try {
      const { id, exerciseId } = req.params

      if (!isFlexibilityExerciseId(exerciseId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid exerciseId',
        })
      }

      const analysis = await prisma.analysis.findUnique({
        where: { id: parseInt(id) }
      })

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        })
      }

      const currentItems = normalizeFlexibilityAssessment(analysis.flexibilityAssessment)
      const existing = currentItems.find((item) => item.exerciseId === exerciseId)

      if (existing?.evidencePublicId) {
        await UploadService.deletePhoto(existing.evidencePublicId)
      }

      const updatedItems = currentItems.map((item) =>
        item.exerciseId === exerciseId ? { ...item, evidenceUrl: null, evidencePublicId: null } : item
      )

      const updatedAnalysis = await prisma.analysis.update({
        where: { id: parseInt(id) },
        data: { flexibilityAssessment: updatedItems.length > 0 ? toInputJson(updatedItems) : Prisma.DbNull },
        include: {
          athlete: {
            select: {
              id: true,
              accessCode: true,
              name: true,
              sport: true
            }
          }
        }
      })

      return res.json({
        success: true,
        data: updatedAnalysis,
        message: 'Evidence removed successfully',
      })
    } catch (error: any) {
      console.error('Error deleting flexibility evidence:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Error deleting evidence',
      })
    }
  }

  /**
   * DELETE /api/analyses/:id
   * Delete an analysis
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      // Get analysis to delete associated images
      const analysis = await prisma.analysis.findUnique({
        where: { id: parseInt(id) }
      })

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        })
      }

      // Delete associated graph images from Cloudinary
      if (analysis.graphImages) {
        try {
          const graphUrls: string[] = JSON.parse(analysis.graphImages)
          for (const url of graphUrls) {
            // Extract public_id from Cloudinary URL
            // Format: https://res.cloudinary.com/CLOUD_NAME/image/upload/VERSION/FOLDER/PUBLIC_ID.ext
            if (url.includes('cloudinary.com')) {
              const urlParts = url.split('/')
              const uploadIndex = urlParts.indexOf('upload')
              if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
                // Get everything after 'upload/VERSION/' and remove file extension
                const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/')
                const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '') // Remove extension
                await UploadService.deletePhoto(publicId)
              }
            }
          }
        } catch (e) {
          console.error('Error deleting graph images:', e)
        }
      }

      // Delete associated Flexibility Assessment evidence photos from Cloudinary
      if (analysis.flexibilityAssessment) {
        try {
          const items = normalizeFlexibilityAssessment(analysis.flexibilityAssessment)
          for (const item of items) {
            if (item.evidencePublicId) {
              await UploadService.deletePhoto(item.evidencePublicId)
            }
          }
        } catch (e) {
          console.error('Error deleting flexibility evidence images:', e)
        }
      }

      // Delete analysis
      await prisma.analysis.delete({
        where: { id: parseInt(id) }
      })

      return res.json({
        success: true,
        message: 'Analysis deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting analysis:', error)
      return res.status(500).json({
        success: false,
        error: 'Error deleting analysis',
      })
    }
  }
}
