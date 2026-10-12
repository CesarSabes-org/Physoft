import express, { Router, ErrorRequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middleware/authenticate'
import { ChatService } from '../../application/services/chat/ChatService'
import { AnthropicChatProvider } from '../../infrastructure/ai/AnthropicChatProvider'
import { createChatController } from '../controllers/chatController'

export function createChatRouter(service = new ChatService(new AnthropicChatProvider())) {
  const router = Router()
  router.use(authenticate)
  router.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: req => req.user!.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMITED', error: 'Too many messages. Please wait a minute before trying again.' },
  }))
  router.post('/messages', express.json({ limit: '64kb' }), createChatController(service))
  const bodyError: ErrorRequestHandler = (error, _req, res, next) => {
    if (error.type === 'entity.too.large' || error.type === 'entity.parse.failed') {
      res.status(error.type === 'entity.too.large' ? 413 : 400).json({
        success: false, code: 'INVALID_REQUEST', error: 'The chat request is invalid or too large.',
      })
      return
    }
    next(error)
  }
  router.use(bodyError)
  return router
}

export default createChatRouter()
