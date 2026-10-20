// ============================================
// MIDDLEWARE: Claude Rate Limiter
// ============================================
// Blunts abuse/runaway-script traffic against POST /api/claude/extract-clinical-results.
// Each request calls the paid Anthropic API, so an unbounded loop against
// this endpoint burns through the API quota/budget, not just server CPU —
// this exists to cut that off within seconds rather than after it happens.
// ============================================

import rateLimit from 'express-rate-limit'

export const claudeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI analysis requests. Please wait a few minutes before trying again.' }
})
