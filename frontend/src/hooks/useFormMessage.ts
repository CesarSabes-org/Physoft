import { useState } from 'react'

export type MessageType = 'success' | 'error' | 'warning' | 'info'

interface Message {
  type: MessageType
  text: string
}

export interface UseFormMessageReturn {
  message: Message | null
  showMessage: (type: MessageType, text: string) => void
  clearMessage: () => void
  showSuccess: (text: string) => void
  showError: (text: string) => void
  showWarning: (text: string) => void
  showInfo: (text: string) => void
}

/**
 * Hook to manage form messages (success/error/warning/info)
 */
export function useFormMessage(): UseFormMessageReturn {
  const [message, setMessage] = useState<Message | null>(null)

  const showMessage = (type: MessageType, text: string) => {
    setMessage({ type, text })
  }

  const clearMessage = () => {
    setMessage(null)
  }

  const showSuccess = (text: string) => showMessage('success', text)
  const showError = (text: string) => showMessage('error', text)
  const showWarning = (text: string) => showMessage('warning', text)
  const showInfo = (text: string) => showMessage('info', text)

  return {
    message,
    showMessage,
    clearMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}
