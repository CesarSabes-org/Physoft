import { Request, Response } from 'express'
import { ConversationService } from '../../application/services/chat/ConversationService'
import { CHAT_MODES, ChatError, ChatMode } from '../../domain/types/chat'
import { ConversationDetail } from '../../infrastructure/repositories/ChatRepository'

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ChatError(400, 'INVALID_REQUEST', 'Invalid conversation or request ID.')
  }
  return value
}
function body(req: Request, keys: string[]) {
  const value: unknown = req.body
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
    throw new ChatError(400, 'INVALID_REQUEST', 'Invalid request fields.')
  }
  return value as Record<string, unknown>
}
// Do not expose leases, worker tokens, owner IDs or internal sequence bookkeeping.
function present(detail: ConversationDetail) {
  return { id: detail.id, title: detail.title, mode: detail.mode, createdAt: detail.createdAt, updatedAt: detail.updatedAt,
    turns: detail.turns.map(turn => ({ id: turn.id, requestId: turn.requestId, prompt: turn.prompt,
      answer: turn.answer, status: turn.status, truncated: turn.truncated, createdAt: turn.createdAt })) }
}
export function conversationControllers(service: ConversationService) {
  const wrap = (action: (req: Request, signal: AbortSignal) => Promise<unknown>) => async (req: Request, res: Response) => {
    const abort = new AbortController()
    const disconnect = () => { if (!res.writableEnded) abort.abort() }
    res.on('close', disconnect)
    res.setHeader('Cache-Control', 'no-store')
    try {
      const data = await action(req, abort.signal)
      if (!abort.signal.aborted) res.json({ success: true, data })
    } catch (error) {
      if (!abort.signal.aborted) {
        const safe = error instanceof ChatError ? error : new ChatError(503, 'CHAT_UNAVAILABLE', 'Chat storage is unavailable. Please contact your administrator or try again later.')
        res.status(safe.status).json({ success: false, code: safe.code, error: safe.message })
      }
    } finally { res.off('close', disconnect) }
  }
  return {
    list: wrap(req => service.repository.list(req.user!.id)),
    get: wrap(async req => present(await service.repository.get(req.user!.id, identifier(req.params.id)))),
    create: wrap(async req => {
      const value = body(req, ['id', 'mode'])
      const mode = value.mode ?? 'general'
      if (!CHAT_MODES.includes(mode as ChatMode)) throw new ChatError(400, 'INVALID_REQUEST', 'Invalid focus.')
      return present(await service.repository.create(req.user!.id, identifier(value.id), mode as ChatMode))
    }),
    remove: wrap(async req => { await service.repository.delete(req.user!.id, identifier(req.params.id)); return null }),
    send: wrap(async (req, signal) => {
      const value = body(req, ['requestId', 'message'])
      if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > 4000) {
        throw new ChatError(400, 'INVALID_REQUEST', 'Enter a message between 1 and 4,000 characters.')
      }
      return present(await service.reply(req.user!.id, identifier(req.params.id), identifier(value.requestId), value.message.trim(), signal))
    }),
  }
}
