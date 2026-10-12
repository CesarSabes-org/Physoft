import { useCallback, useEffect, useRef, useState } from 'react'
import { getChatErrorMessage, sendAssistantMessage } from '../services/assistantApi'
import { AssistantMessage, buildChatHistory, CHAT_MESSAGE_LIMIT, ChatMode, ChatRequest } from '../types/chat.types'

interface FailedTurn { request: ChatRequest; userMessageId: string }

export function useAssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [mode, setMode] = useState<ChatMode>('general')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null }, [])

  const run = useCallback(async (turn: FailedTurn) => {
    if (activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setIsSending(true)
    setError(null)
    setFailedTurn(null)
    try {
      const reply = await sendAssistantMessage(turn.request, controller.signal)
      if (activeRequest.current !== controller) return
      if (controller.signal.aborted) throw new Error('Response stopped')
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', ...reply }])
    } catch (failure) {
      if (activeRequest.current !== controller) return
      setError(controller.signal.aborted ? 'Response stopped. You can retry or edit your question.' : getChatErrorMessage(failure))
      setFailedTurn(turn)
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setIsSending(false)
      }
    }
  }, [])

  const send = useCallback((text: string): boolean => {
    const content = text.trim()
    if (!content || text.length > CHAT_MESSAGE_LIMIT || activeRequest.current || failedTurn) return false
    const id = crypto.randomUUID()
    const turn: FailedTurn = { userMessageId: id, request: { message: content, mode, history: buildChatHistory(messages) } }
    setMessages(previous => [...previous, { id, role: 'user', content, mode }])
    void run(turn)
    return true
  }, [failedTurn, messages, mode, run])
  const retry = useCallback(() => { if (failedTurn) void run(failedTurn) }, [failedTurn, run])
  const editFailed = useCallback(() => {
    if (!failedTurn || activeRequest.current) return ''
    setMessages(previous => previous.filter(message => message.id !== failedTurn.userMessageId))
    setMode(failedTurn.request.mode)
    setFailedTurn(null)
    setError(null)
    return failedTurn.request.message
  }, [failedTurn])
  const reset = useCallback(() => {
    activeRequest.current?.abort()
    activeRequest.current = null
    setMessages([])
    setMode('general')
    setIsSending(false)
    setError(null)
    setFailedTurn(null)
  }, [])
  return { messages, mode, setMode, isSending, error, failedTurn: Boolean(failedTurn), send, retry, editFailed, reset,
    stop: () => activeRequest.current?.abort() }
}
