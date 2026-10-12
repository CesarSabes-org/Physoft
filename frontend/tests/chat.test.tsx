import { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Assistant from '../src/pages/Assistant/Assistant'
import ChatMessage from '../src/components/assistant/ChatMessage'
import { useAssistantChat } from '../src/hooks/useAssistantChat'
import { sendAssistantMessage } from '../src/services/assistantApi'
import { AssistantMessage, buildChatHistory } from '../src/types/chat.types'

const auth = vi.hoisted(() => ({ isAuthenticated: true, user: { id: 'test-user' } }))
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => auth }))
vi.mock('../src/components/templates/PageTemplate', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('../src/services/assistantApi', () => ({ sendAssistantMessage: vi.fn(), getChatErrorMessage: () => 'Connection failed.' }))
const sendMock = vi.mocked(sendAssistantMessage)
const reply = { content: '## Strength\n\nAn explanation.', mode: 'general' as const, truncated: false }
const page = () => render(<MemoryRouter><Assistant /></MemoryRouter>)

beforeEach(() => {
  auth.isAuthenticated = true
  sendMock.mockReset()
  sendMock.mockResolvedValue(reply)
})

describe('assistant interface', () => {
  it('allows exactly one optional focus and clears it on a second click', () => {
    page()
    const interpret = screen.getByRole('button', { name: /Interpret results/ })
    const explain = screen.getByRole('button', { name: /Explain concepts/ })
    expect(interpret).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(interpret)
    expect(interpret).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(explain)
    expect(interpret).toHaveAttribute('aria-pressed', 'false')
    expect(explain).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(explain)
    expect(explain).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('General specialist')).toBeInTheDocument()
  })

  it('sends the exact question with selected mode and renders Markdown', async () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: /Explain concepts/ }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'What is strength?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(sendMock).toHaveBeenCalledWith({ message: 'What is strength?', mode: 'explain_concepts', history: [] }, expect.any(AbortSignal))
    expect(await screen.findByRole('heading', { name: 'Strength' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('works without selection, preserves context and sends on Enter', async () => {
    page()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Strength?' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true })
    expect(sendMock).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(sendMock).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    await screen.findByRole('heading', { name: 'Strength' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'And power?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(sendMock.mock.calls[1][0]).toEqual({
      mode: 'general', message: 'And power?', history: [
        { role: 'user', content: 'Strength?' }, { role: 'assistant', content: reply.content },
      ],
    })
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Strength' })).toHaveLength(2))
  })

  it('does not send empty input and offers sign-in for anonymous users', () => {
    auth.isAuthenticated = false
    page()
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('shows errors, retries once without duplicating the question and resets', async () => {
    sendMock.mockRejectedValueOnce(new Error('network'))
    page()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain recovery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { name: 'Strength' })
    expect(screen.getAllByText('Explain recovery')).toHaveLength(1)
    expect(sendMock.mock.calls[1][0]).toEqual(sendMock.mock.calls[0][0])
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    expect(screen.getByText('General specialist')).toBeInTheDocument()
  })

  it('restores a failed question for editing and removes the failed turn', async () => {
    sendMock.mockRejectedValueOnce(new Error('network'))
    page()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Original question' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Edit question' }))
    expect(screen.getByRole('textbox')).toHaveValue('Original question')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  it('renders untrusted Markdown without HTML, unsafe links or remote images', () => {
    const { container } = render(<ChatMessage message={{ id: '1', role: 'assistant', mode: 'general', content:
      '<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n![track](https://example.invalid/pixel)\n\n**Safe text**' }} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/)
    expect(screen.getByText('Safe text').tagName).toBe('STRONG')
  })
})

describe('conversation lifecycle', () => {
  it('blocks double submits while a request is pending', async () => {
    let resolve!: (value: typeof reply) => void
    sendMock.mockImplementation(() => new Promise(done => { resolve = done }))
    const { result } = renderHook(useAssistantChat)
    act(() => { expect(result.current.send('First')).toBe(true); expect(result.current.send('Second')).toBe(false) })
    expect(sendMock).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(reply) })
    expect(result.current.messages).toHaveLength(2)
  })

  it('stops the request and makes the same question retryable', async () => {
    sendMock.mockImplementationOnce((_request, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const { result } = renderHook(useAssistantChat)
    act(() => { result.current.send('Hello') })
    await act(async () => { result.current.stop() })
    expect(sendMock.mock.calls[0][1].aborted).toBe(true)
    expect(result.current.isSending).toBe(false)
    expect(result.current.failedTurn).toBe(true)
    expect(result.current.error).toContain('Response stopped')
  })

  it('ignores stale replies after new conversation', async () => {
    let resolve!: (value: typeof reply) => void
    sendMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const { result } = renderHook(useAssistantChat)
    act(() => { result.current.send('Old question') })
    act(() => { result.current.reset() })
    await act(async () => { resolve(reply) })
    expect(result.current.messages).toEqual([])
    expect(result.current.isSending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('cancels in-flight work on unmount', () => {
    sendMock.mockImplementationOnce(() => new Promise(() => {}))
    const { result, unmount } = renderHook(useAssistantChat)
    act(() => { result.current.send('Hello') })
    unmount()
    expect(sendMock.mock.calls[0][1].aborted).toBe(true)
  })

  it('bounds context by complete recent pairs and character budget', () => {
    const messages: AssistantMessage[] = Array.from({ length: 24 }, (_, i) => ({
      id: String(i), mode: 'general', role: i % 2 ? 'assistant' : 'user', content: String(i),
    }))
    expect(buildChatHistory(messages)).toHaveLength(20)
    expect(buildChatHistory(messages)[0].content).toBe('4')
    const big = messages.map(message => ({ ...message, content: 'x'.repeat(4000) }))
    const bounded = buildChatHistory(big)
    expect(bounded).toHaveLength(6)
    expect(bounded.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(28000)
  })
})
