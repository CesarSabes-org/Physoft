// ============================================
// UPLOAD MIDDLEWARE - Multer Configuration
// ============================================
// Handles file uploads for the Textual Analysis / Claude AI endpoint.
// Separate from middleware/upload.ts (photos/graphs) since the allowed
// types (PDF + images) and limits (10MB, 5 files) differ.
// ============================================

import multer from 'multer'
import path from 'path'
import { Request, Response, NextFunction } from 'express'

const storage = multer.memoryStorage()

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /pdf|jpeg|jpg|png|webp|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
        cb(null, true)
    } else {
        cb(new Error('Only PDF and images are allowed (pdf, jpeg, jpg, png, webp, gif)'))
    }
}

export const uploadClaudeFiles = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per file
        files: 5
    }
})

/**
 * Device reports (PDF/images) for AI extraction of clinical results.
 * Rejected uploads return a clear 400 JSON error instead of falling into
 * the app's generic 500 handler.
 */
export function uploadClinicalReportFiles(req: Request, res: Response, next: NextFunction) {
    uploadClaudeFiles.array('files', 5)(req, res, (err: unknown) => {
        if (!err) return next()

        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'Each file must be smaller than 10MB' })
            }
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ success: false, error: 'You can attach up to 5 files' })
            }
        }

        const message = err instanceof Error ? err.message : 'Invalid file'
        return res.status(400).json({ success: false, error: message })
    })
}
