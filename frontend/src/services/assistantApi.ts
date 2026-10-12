import axios from 'axios'
import { apiClient } from './api'
import type { ChatMode, ChatSummary, Conversation, SendChatRequest } from '../types/chat.types'

export const assistantApi = {
  async list(signal?: AbortSignal) {
    return (await apiClient.get<{ data: ChatSummary[] }>('/chat/conversations', { signal })).data.data
  },
  async get(id: string, signal?: AbortSignal) {
    return (await apiClient.get<{ data: Conversation }>(`/chat/conversations/${id}`, { signal })).data.data
  },
  async create(id: string, mode: ChatMode, signal?: AbortSignal) {
    return (await apiClient.post<{ data: Conversation }>('/chat/conversations', { id, mode }, { signal })).data.data
  },
  async send(id: string, request: SendChatRequest, signal: AbortSignal) {
    return (await apiClient.post<{ data: Conversation }>(`/chat/conversations/${id}/messages`, request, { signal, timeout: 55000 })).data.data
  },
  async remove(id: string) { await apiClient.delete(`/chat/conversations/${id}`) },
}
export function getChatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.code === 'ECONNABORTED') return 'The response took too long. Reopen this chat to check its saved state.'
    const message: unknown = error.response?.data?.error
    if (typeof message === 'string') return message
    if (!error.response) return 'Could not connect. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
