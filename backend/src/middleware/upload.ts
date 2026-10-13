// ============================================
// UPLOAD MIDDLEWARE - Multer Configuration
// ============================================
// Handles file uploads for athlete images
// ============================================

import multer from 'multer'
import path from 'path'
import { Request, Response, NextFunction } from 'express'
import { FLEXIBILITY_EXERCISE_IDS } from '../domain/types/flexibilityAssessment'

// Use memory storage for Vercel (filesystem is read-only in serverless)
// Files are stored in req.file.buffer and uploaded directly to Cloudinary
const storage = multer.memoryStorage()

// File filter - only accept images. Includes heic/heif (the default photo
// format on iPhones) since Cloudinary can ingest and convert them; without
// this, any patient photo taken on an iPhone gets rejected here.
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|webp|heic|heif|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
        cb(null, true)
    } else {
        cb(new Error('Only images are allowed (jpeg, jpg, png, webp, heic, heif, gif)'))
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
})

/**
 * Wraps a multer middleware so rejected uploads (wrong type, too large)
 * return a clear `{ success: false, error: '...' }` JSON response from this
 * route directly, instead of throwing past the route handler's own
 * try/catch and falling into the app's generic 500 error handler.
 */
function withUploadErrorHandling(
    multerMiddleware: (req: Request, res: Response, callback: (err: unknown) => void) => void
) {
    return (req: Request, res: Response, next: NextFunction) => {
        multerMiddleware(req, res, (err: unknown) => {
            if (!err) return next()

            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'Photo must be smaller than 5MB' })
            }

            const message = err instanceof Error ? err.message : 'Invalid photo file'
            return res.status(400).json({ success: false, error: message })
        })
    }
}

export const uploadSinglePhoto = withUploadErrorHandling(upload.single('photo'))

// Analysis creation accepts both graph images ('graphs') and, per Flexibility
// Assessment exercise, an optional evidence photo under its own field name
// ('flexibilityEvidence_<exerciseId>'), so each file arrives pre-tagged with
// the exercise it belongs to instead of relying on upload order.
export const uploadAnalysisCreateFiles = withUploadErrorHandling(
    upload.fields([
        { name: 'graphs', maxCount: 10 },
        ...FLEXIBILITY_EXERCISE_IDS.map((exerciseId) => ({ name: `flexibilityEvidence_${exerciseId}`, maxCount: 1 }))
    ])
)

export const uploadFlexibilityEvidence = withUploadErrorHandling(upload.single('evidence'))
