import Anthropic from '@anthropic-ai/sdk'
import { ChatError, ChatMessage, ChatProvider } from '../../domain/types/chat'

export function mapAnthropicChatError(error: unknown): ChatError {
  if (error instanceof ChatError) return error
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ChatError(504, 'PROVIDER_TIMEOUT', 'The response took too long. Please try again.')
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429 || error.status === 529) {
      return new ChatError(429, 'PROVIDER_BUSY', 'The assistant is busy. Please wait a moment and try again.')
    }
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return new ChatError(503, 'PROVIDER_CONFIGURATION', 'The assistant is unavailable. Please ask your administrator to check its configuration.')
    }
  }
  return new ChatError(502, 'PROVIDER_UNAVAILABLE', 'Could not reach the assistant. Please try again.')
}

export class AnthropicChatProvider implements ChatProvider {
  constructor(private readonly createClient: (apiKey: string) => Pick<Anthropic, 'messages'> =
    apiKey => new Anthropic({ apiKey, timeout: 45000, maxRetries: 0 })) {}

  async generate(system: string, messages: ChatMessage[], signal: AbortSignal) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey?.trim()) {
      throw new ChatError(503, 'PROVIDER_CONFIGURATION', 'The assistant is not configured yet. Please contact your administrator.')
    }
    // Lazy construction keeps missing optional credentials from breaking app startup.
    const client = this.createClient(apiKey)
    try {
      const response = await client.messages.create({
        model: process.env.CHAT_ANTHROPIC_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 2048,
        system,
        messages,
      }, { signal })
      if (response.stop_reason === 'refusal') {
        throw new ChatError(422, 'RESPONSE_BLOCKED', 'The assistant could not help with this request. Try rephrasing your question.')
      }
      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text).join('\n\n').trim()
      if (!content) throw new ChatError(502, 'EMPTY_RESPONSE', 'The assistant returned no text. Please try again.')
      return { content, truncated: response.stop_reason === 'max_tokens' }
    } catch (error) {
      if (signal.aborted) throw error
      throw mapAnthropicChatError(error)
    }
  }
}
