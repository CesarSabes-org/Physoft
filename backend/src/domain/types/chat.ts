export const CHAT_MODES = ['general', 'interpret_results', 'explain_concepts', 'protocol_guidance', 'performance_advice'] as const
export type ChatMode = typeof CHAT_MODES[number]

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  mode: ChatMode
  message: string
  history: ChatMessage[]
}

export interface ChatReply {
  content: string
  mode: ChatMode
  truncated: boolean
}

export class ChatError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'ChatError'
  }
}

export interface ChatProvider {
  generate(system: string, messages: ChatMessage[], signal: AbortSignal): Promise<Pick<ChatReply, 'content' | 'truncated'>>
}
