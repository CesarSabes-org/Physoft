import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { assistantApi, getChatErrorMessage } from '../services/assistantApi'
import { AssistantMessage, CHAT_MESSAGE_LIMIT, ChatMode, ChatSummary, Conversation, SendChatRequest } from '../types/chat.types'

export function useAssistantChat(userId?: string) {
  const [params, setParams] = useSearchParams()
  const activeId = params.get('chat')
  const [conversations, setConversations] = useState<ChatSummary[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [mode, setMode] = useState<ChatMode>('general')
  const [modeChosen, setModeChosen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [pending, setPending] = useState<SendChatRequest | null>(null)
  const current = useRef<Conversation | null>(null)
  const draft = useRef<{ id: string; mode: ChatMode } | null>(null)
  const active = useRef<AbortController | null>(null)
  const identity = useRef(userId)
  identity.current = userId

  const adopt = useCallback((value: Conversation) => {
    current.current = value
    setConversation(value)
    setMode(value.mode)
    setModeChosen(true)
  }, [])
  const refreshList = useCallback(async () => {
    if (!userId) return
    try {
      const items = await assistantApi.list()
      if (identity.current === userId) { setConversations(items); setListError(null) }
    } catch (failure) { if (identity.current === userId) setListError(getChatErrorMessage(failure)) }
  }, [userId])
  useEffect(() => { setConversations([]); void refreshList() }, [refreshList])

  useEffect(() => {
    if (activeId && current.current?.id === activeId) return
    active.current?.abort()
    active.current = null
    current.current = null
    draft.current = null
    setConversation(null)
    setMode('general')
    setModeChosen(false)
    setPending(null)
    setIsSending(false)
    setError(null)
    if (!activeId || !userId) { setIsLoading(false); return }
    const controller = new AbortController()
    setIsLoading(true)
    assistantApi.get(activeId, controller.signal).then(value => {
      if (!controller.signal.aborted) adopt(value)
    }).catch(failure => { if (!controller.signal.aborted) setError(getChatErrorMessage(failure)) })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [activeId, userId, adopt])
  useEffect(() => () => { active.current?.abort(); active.current = null }, [])

  const lastTurn = conversation?.turns[conversation.turns.length - 1]
  const waiting = lastTurn?.status === 'pending'
  // A reload/second device can observe a running request. Poll only while pending;
  // the server expires abandoned leases without repeating the paid generation.
  useEffect(() => {
    if (!waiting || isSending || !activeId) return
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      assistantApi.get(activeId, controller.signal).then(value => {
        if (!controller.signal.aborted) adopt(value)
      }).catch(() => { /* Keep saved state on transient poll failure. */ })
    }, 3000)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [activeId, waiting, isSending, adopt])

  const ensureConversation = useCallback(async (signal: AbortSignal, selected: ChatMode) => {
    if (current.current) return current.current
    draft.current ??= { id: crypto.randomUUID(), mode: selected }
    const created = await assistantApi.create(draft.current.id, draft.current.mode, signal)
    if (signal.aborted) throw new Error('aborted')
    adopt(created)
    setParams({ chat: created.id }, { replace: true })
    return created
  }, [adopt, setParams])

  const run = useCallback(async (request: SendChatRequest | null, selected: ChatMode) => {
    if (active.current || !userId) return
    const controller = new AbortController()
    active.current = controller
    setIsSending(true)
    setModeChosen(true)
    setMode(selected)
    setError(null)
    setPending(request)
    try {
      const created = await ensureConversation(controller.signal, selected)
      const result = request ? await assistantApi.send(created.id, request, controller.signal) : created
      if (controller.signal.aborted || active.current !== controller) return
      adopt(result)
      setPending(null)
      void refreshList()
    } catch (failure) {
      if (active.current !== controller) return
      setError(controller.signal.aborted ? 'Response stopped. Your conversation is saved; reopen it to check the last question.' : getChatErrorMessage(failure))
      if (current.current) {
        try {
          const saved = await assistantApi.get(current.current.id)
          if (active.current === controller) { adopt(saved); if (saved.turns.some(turn => turn.requestId === request?.requestId)) setPending(null) }
        } catch { /* Keep the same request ID available for a safe retry. */ }
      }
      void refreshList()
    } finally { if (active.current === controller) { active.current = null; setIsSending(false) } }
  }, [userId, ensureConversation, adopt, refreshList])

  const chooseMode = useCallback((selected: ChatMode) => {
    if (modeChosen || current.current || active.current) return
    void run(null, selected)
  }, [modeChosen, run])
  const send = useCallback((text: string): boolean => {
    if (!text.trim() || text.length > CHAT_MESSAGE_LIMIT || active.current || isLoading || waiting || pending || !userId || (activeId && !current.current)) return false
    void run({ requestId: crypto.randomUUID(), message: text.trim() }, mode)
    return true
  }, [activeId, mode, isLoading, waiting, pending, userId, run])
  const failedTurn = Boolean(pending && !isSending) || lastTurn?.status === 'failed' || lastTurn?.status === 'cancelled'
  const retry = useCallback(() => {
    const request = pending ?? (lastTurn ? { requestId: lastTurn.requestId, message: lastTurn.prompt } : null)
    void run(request, mode)
  }, [pending, lastTurn, mode, run])
  const reset = useCallback(() => {
    active.current?.abort()
    active.current = null
    current.current = null
    draft.current = null
    setConversation(null)
    setMode('general')
    setModeChosen(false)
    setError(null)
    setPending(null)
    setIsSending(false)
    setParams({}, { replace: true })
  }, [setParams])
  const open = useCallback((id: string) => { setParams({ chat: id }) }, [setParams])
  const remove = useCallback(async (id: string) => {
    try {
      await assistantApi.remove(id)
      if (current.current?.id === id) reset()
      void refreshList()
    } catch (failure) { setError(getChatErrorMessage(failure)) }
  }, [refreshList, reset])

  const messages: AssistantMessage[] = (conversation?.turns ?? []).flatMap(turn => {
    const result: AssistantMessage[] = [{ id: turn.id, role: 'user', content: turn.prompt, mode }]
    if (turn.answer) result.push({ id: `${turn.id}-reply`, role: 'assistant', content: turn.answer, mode, truncated: turn.truncated })
    return result
  })
  if (pending && !conversation?.turns.some(turn => turn.requestId === pending.requestId)) messages.push({ id: pending.requestId, role: 'user', content: pending.message, mode })
  return { messages, mode, modeChosen, chooseMode, conversations, conversation, isSending, isLoading, waiting, error, listError,
    failedTurn, send, retry, reset, open, remove, refreshList, stop: () => active.current?.abort() }
}
