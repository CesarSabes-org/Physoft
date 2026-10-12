import { ChatRepository } from '../../../infrastructure/repositories/ChatRepository'
import { ChatError, ChatMessage, ChatMode } from '../../../domain/types/chat'
import { ChatService } from './ChatService'

export class ConversationService {
  constructor(public readonly repository: ChatRepository, private readonly chat: ChatService) {}

  async reply(userId: string, id: string, requestId: string, message: string, signal: AbortSignal) {
    const { conversation, turn, cached } = await this.repository.begin(userId, id, requestId, message)
    if (cached) return this.repository.get(userId, id)
    try {
      const previous = await this.repository.completedHistory(id, turn.sequence)
      const history: ChatMessage[] = []
      let size = 0
      for (const item of previous) {
        if (!item.answer || size + item.prompt.length + item.answer.length > 28000) break
        size += item.prompt.length + item.answer.length
        history.unshift({ role: 'user', content: item.prompt }, { role: 'assistant', content: item.answer })
      }
      if (signal.aborted) throw new Error('aborted')
      const reply = await this.chat.reply({ mode: conversation.mode as ChatMode, message, history }, signal)
      if (signal.aborted) throw new Error('aborted')
      await this.repository.finish(turn, reply.content, reply.truncated, 'completed')
      return await this.repository.get(userId, id)
    } catch (error) {
      const code = error instanceof ChatError ? error.code : 'CHAT_FAILED'
      await this.repository.finish(turn, null, false, signal.aborted ? 'cancelled' : 'failed', code)
      throw error
    }
  }
}
