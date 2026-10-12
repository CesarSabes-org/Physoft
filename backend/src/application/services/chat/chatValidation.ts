import { CHAT_MODES, ChatError, ChatMessage, ChatMode, ChatRequest } from '../../../domain/types/chat'

const invalid = (message: string): never => { throw new ChatError(400, 'INVALID_REQUEST', message) }
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Only conversational text is accepted. No custom system prompt, model, tools,
// patient IDs or purported trusted assessment context can enter through this API.
export function parseChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body)) return invalid('A message is required.')
  if (Object.keys(body).some(key => !['mode', 'message', 'history'].includes(key))) {
    return invalid('Unsupported chat field.')
  }
  const mode = body.mode ?? 'general'
  if (typeof mode !== 'string' || !CHAT_MODES.includes(mode as ChatMode)) return invalid('Choose a valid focus.')
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) {
    return invalid('Enter a message between 1 and 4,000 characters.')
  }
  const history = body.history ?? []
  if (!Array.isArray(history) || history.length > 20 || history.length % 2 !== 0) {
    return invalid('History must contain at most 10 complete exchanges.')
  }
  let total = body.message.length
  const messages: ChatMessage[] = history.map((item: unknown, index: number) => {
    if (!isRecord(item) || Object.keys(item).some(key => !['role', 'content'].includes(key))) {
      return invalid('Invalid history entry.')
    }
    const role = index % 2 === 0 ? 'user' : 'assistant'
    if (item.role !== role || typeof item.content !== 'string' || !item.content.trim()
      || item.content.length > (role === 'user' ? 4000 : 16000)) return invalid('Invalid history entry.')
    total += item.content.length
    return { role, content: item.content.trim() }
  })
  if (total > 32000) return invalid('Conversation context is too long. Start a new conversation.')
  return { mode: mode as ChatMode, message: body.message.trim(), history: messages }
}
