// ============================================
// CONTROLLER: Athlete - Presentation Layer
// ============================================
// Handles HTTP requests related to athletes
// ============================================

import { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../../infrastructure/prismaClient'
import { UploadService } from '../../application/services/uploadService'

// Helper function to generate next access code
async function generateAccessCode(): Promise<string> {
  const athletes = await prisma.athlete.findMany({
    select: { accessCode: true },
    orderBy: { accessCode: 'desc' },
    take: 1
  })

  if (athletes.length === 0) {
    return '00000'
  }

  const lastCode = parseInt(athletes[0].accessCode)
  const nextCode = (lastCode + 1).toString().padStart(5, '0')
  return nextCode
}

export class AthleteController {
  /**
   * GET /api/athletes
   * Get all athletes with optional filters
   */
  static async getAll(req: Request, res: Response) {
    try {
      const { name, gender, sport, bodyType, nationality, patientType } = req.query

      // Build dynamic filters
      const where: any = { deletedAt: null }

      if (name) {
        where.name = {
          contains: name as string,
          mode: 'insensitive'
        }
      }

      if (gender) where.gender = gender as string
      if (sport) where.sport = sport as string
      if (bodyType) where.bodyType = bodyType as string
      if (nationality) where.nationality = nationality as string
      if (patientType) where.patientType = patientType as string

      const athletes = await prisma.athlete.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      })

      return res.json({
        success: true,
        data: athletes,
        total: athletes.length,
      })
    } catch (error) {
      console.error('Error fetching athletes:', error)
      return res.status(500).json({
        success: false,
        error: 'Error fetching patients',
      })
    }
  }

  /**
   * GET /api/athletes/:id
   * Get an athlete by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const athlete = await prisma.athlete.findUnique({
        where: { id },
        include: {
          analyses: true,
        },
      })

      if (!athlete || athlete.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
        })
      }

      return res.json({
        success: true,
        data: athlete,
      })
    } catch (error) {
      console.error('Error fetching athlete:', error)
      return res.status(500).json({
        success: false,
        error: 'Error fetching patient',
      })
    }
  }

  /**
   * POST /api/athletes
   * Create a new athlete with optional photo
   */
  static async create(req: Request, res: Response) {
    try {
      const {
        name, gender, birthDate, nationality, sport, club,
        position, bodyType, height, weight, email, phone, deviceId, patientType
      } = req.body

      // Basic validations
      if (!name || !gender || !sport || !bodyType || !height || !weight) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, gender, sport, bodyType, height, weight',
        })
      }

      // Generate access code
      const accessCode = await generateAccessCode()

      // Generate UUID for athlete
      const id = randomUUID()

      // Handle photo upload if present
      let photoUrl: string | null = null
      let cloudinaryPublicId: string | null = null

      if (req.file) {
        const uploadResult = await UploadService.uploadPhoto(
          req.file,
          id,
          `physoft/athletes/${id}`
        )
        photoUrl = uploadResult.url
        cloudinaryPublicId = uploadResult.publicId || null
      }

      const newAthlete = await prisma.athlete.create({
        data: {
          id,
          accessCode,
          name,
          patientType: patientType || 'Athlete',
          gender,
          birthDate: birthDate || null,
          nationality: nationality || null,
          sport,
          club: club || null,
          position: position || null,
          bodyType,
          height: parseFloat(height),
          weight: parseFloat(weight),
          email: email || null,
          phone: phone || null,
          photo: photoUrl,
          cloudinaryPublicId,
          deviceId: deviceId || null,
        },
      })

      return res.status(201).json({
        success: true,
        data: newAthlete,
        message: 'Patient created successfully',
      })
    } catch (error) {
      console.error('Error creating athlete:', error)
      return res.status(500).json({
        success: false,
        error: 'Error creating patient',
      })
    }
  }

  /**
   * PUT /api/athletes/:id
   * Update an athlete
   */
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const {
        name, gender, birthDate, nationality, sport, club,
        position, bodyType, height, weight, email, phone, patientType
      } = req.body

      // Check if athlete exists
      const existing = await prisma.athlete.findUnique({ where: { id } })
      if (!existing || existing.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
        })
      }

      // Optional fields: undefined = leave unchanged; null or '' = clear
      const optional = (value: unknown) =>
        value === undefined ? undefined : (typeof value === 'string' && value.trim() !== '' ? value : null)

      const updatedAthlete = await prisma.athlete.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(patientType && { patientType }),
          ...(gender && { gender }),
          ...(birthDate !== undefined && { birthDate: optional(birthDate) }),
          ...(nationality !== undefined && { nationality: optional(nationality) }),
          ...(sport && { sport }),
          ...(club !== undefined && { club: optional(club) }),
          ...(position !== undefined && { position: optional(position) }),
          ...(bodyType && { bodyType }),
          ...(height && { height: parseFloat(height) }),
          ...(weight && { weight: parseFloat(weight) }),
          ...(email !== undefined && { email: optional(email) }),
          ...(phone !== undefined && { phone: optional(phone) }),
        },
      })

      return res.json({
        success: true,
        data: updatedAthlete,
        message: 'Patient updated successfully',
      })
    } catch (error) {
      console.error('Error updating athlete:', error)
      return res.status(500).json({
        success: false,
        error: 'Error updating patient',
      })
    }
  }

  /**
   * POST /api/atletas/:id/photo
   * Upload or update athlete photo
   */
  static async uploadPhoto(req: Request, res: Response) {
    try {
      const { id } = req.params

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file provided',
        })
      }

      // Get current athlete to delete old photo
      const athlete = await prisma.athlete.findUnique({
        where: { id }
      })

      if (!athlete || athlete.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
        })
      }

      // Delete old photo if exists
      if (athlete.photo) {
        await UploadService.deletePhoto(athlete.cloudinaryPublicId)
      }

      // Upload new photo
      const uploadResult = await UploadService.uploadPhoto(
        req.file,
        id,
        `physoft/athletes/${id}`
      )

      // Update athlete with new photo
      const updatedAthlete = await prisma.athlete.update({
        where: { id },
        data: {
          photo: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId || null
        }
      })

      return res.json({
        success: true,
        data: updatedAthlete,
        message: 'Photo uploaded successfully',
      })
    } catch (error) {
      console.error('Error uploading photo:', error)
      return res.status(500).json({
        success: false,
        error: 'Error uploading photo',
      })
    }
  }

  /**
   * DELETE /api/atletas/:id
   * Delete an athlete (soft delete)
   */
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      // Get athlete to delete photo
      const athlete = await prisma.athlete.findUnique({
        where: { id }
      })

      if (!athlete || athlete.deletedAt) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
        })
      }

      // Get all analyses for this athlete to delete their images
      const analyses = await prisma.analysis.findMany({
        where: { athleteId: id }
      })

      // Delete graph images from Cloudinary for each analysis
      for (const analysis of analyses) {
        if (analysis.graphImages) {
          try {
            const imageUrls = JSON.parse(analysis.graphImages)
            for (const url of imageUrls) {
              // Extract public_id from Cloudinary URL
              const matches = url.match(/\/v\d+\/(.+)\.\w+$/)
              if (matches && matches[1]) {
                const publicId = matches[1]
                await UploadService.deletePhoto(publicId)
              }
            }
          } catch (err) {
            console.warn('Error deleting analysis images:', err)
          }
        }
      }

      // Delete all analyses for this athlete
      await prisma.analysis.deleteMany({
        where: { athleteId: id }
      })

      // Delete athlete photo if exists
      if (athlete.photo) {
        await UploadService.deletePhoto(athlete.cloudinaryPublicId)
      }

      // Soft delete by setting deletedAt
      await prisma.athlete.update({
        where: { id },
        data: { deletedAt: new Date() }
      })

      return res.json({
        success: true,
        message: 'Patient deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting athlete:', error)
      return res.status(500).json({
        success: false,
        error: 'Error deleting patient',
      })
    }
  }
}
