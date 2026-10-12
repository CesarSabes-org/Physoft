import { Request, Response } from 'express'
import { ChatService } from '../../application/services/chat/ChatService'
import { parseChatRequest } from '../../application/services/chat/chatValidation'
import { ChatError } from '../../domain/types/chat'

export function createChatController(service: ChatService) {
  return async (req: Request, res: Response): Promise<void> => {
    const abort = new AbortController()
    const disconnect = () => { if (!res.writableEnded) abort.abort() }
    res.on('close', disconnect)
    res.setHeader('Cache-Control', 'no-store')
    try {
      const request = parseChatRequest(req.body)
      const data = await service.reply(request, abort.signal)
      if (!abort.signal.aborted) res.json({ success: true, data })
    } catch (error) {
      if (!abort.signal.aborted) {
        const safeError = error instanceof ChatError ? error
          : new ChatError(500, 'CHAT_FAILED', 'Something went wrong. Please try again.')
        // Never log messages, history, SDK errors (which can contain request data), or secrets.
        res.status(safeError.status).json({ success: false, code: safeError.code, error: safeError.message })
      }
    } finally {
      res.off('close', disconnect)
    }
  }
}
