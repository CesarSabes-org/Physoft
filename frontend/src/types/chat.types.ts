export type ChatMode = 'general' | 'interpret_results' | 'explain_concepts' | 'protocol_guidance' | 'performance_advice'
export const CHAT_MODE_LABELS: Record<ChatMode, string> = {
  general: 'General specialist', interpret_results: 'Interpret results', explain_concepts: 'Explain concepts',
  protocol_guidance: 'Protocol guidance', performance_advice: 'Performance advice',
}
export const CHAT_MESSAGE_LIMIT = 4000
export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  mode: ChatMode
  truncated?: boolean
}
export interface ChatSummary {
  id: string
  title: string
  mode: ChatMode
  createdAt: string
  updatedAt: string
}
export interface ChatTurn {
  id: string
  requestId: string
  prompt: string
  answer: string | null
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  truncated: boolean
  createdAt: string
}
export interface Conversation extends ChatSummary { turns: ChatTurn[] }
export interface SendChatRequest { requestId: string; message: string }
