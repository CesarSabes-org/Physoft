export type ChatMode = 'general' | 'interpret_results' | 'explain_concepts' | 'protocol_guidance' | 'performance_advice'

export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  general: 'General specialist',
  interpret_results: 'Interpret results',
  explain_concepts: 'Explain concepts',
  protocol_guidance: 'Protocol guidance',
  performance_advice: 'Performance advice',
}
export const CHAT_MESSAGE_LIMIT = 4000

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}
export interface AssistantMessage extends ChatHistoryMessage {
  id: string
  mode: ChatMode
  truncated?: boolean
}
export interface ChatRequest {
  message: string
  mode: ChatMode
  history: ChatHistoryMessage[]
}
export interface ChatReply {
  content: string
  mode: ChatMode
  truncated: boolean
}

// Keep complete recent exchanges within the input budget, without changing the UI history.
export function buildChatHistory(messages: AssistantMessage[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = []
  let size = 0
  for (let index = messages.length - 2; index >= 0 && history.length < 20; index -= 2) {
    const user = messages[index]
    const assistant = messages[index + 1]
    if (user.role !== 'user' || assistant.role !== 'assistant') break
    const pairSize = user.content.length + assistant.content.length
    if (size + pairSize > 28000) break
    history.unshift({ role: user.role, content: user.content }, { role: assistant.role, content: assistant.content })
    size += pairSize
  }
  return history
}
