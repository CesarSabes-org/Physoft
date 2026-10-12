import { ChatProvider, ChatReply, ChatRequest } from '../../../domain/types/chat'
import { buildChatSystemPrompt } from './prompts'

export class ChatService {
  constructor(private readonly provider: ChatProvider) {}

  async reply(request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
    const result = await this.provider.generate(buildChatSystemPrompt(request.mode), [
      ...request.history,
      { role: 'user', content: request.message },
    ], signal)
    return { ...result, mode: request.mode }
  }
}
