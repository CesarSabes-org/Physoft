import axios from 'axios'
import { apiClient } from './api'
import type { ChatReply, ChatRequest } from '../types/chat.types'

export async function sendAssistantMessage(request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
  const response = await apiClient.post<{ success: true; data: ChatReply }>('/chat/messages', request, {
    signal, timeout: 55000,
  })
  return response.data.data
}
export function getChatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.code === 'ECONNABORTED') return 'The response took too long. Please try again.'
    const message: unknown = error.response?.data?.error
    if (typeof message === 'string') return message
    if (!error.response) return 'Could not connect. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
