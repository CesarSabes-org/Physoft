import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IoSparkles, IoAnalyticsOutline, IoBulbOutline, IoLayersOutline, IoTrendingUpOutline, IoSend, IoAdd, IoStop, IoRefreshOutline, IoArrowDown, IoTrashOutline, IoCheckmark } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import ChatMessage from '../../components/assistant/ChatMessage'
import { useAssistantChat } from '../../hooks/useAssistantChat'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useAuth } from '../../hooks/useAuth'
import { CHAT_MESSAGE_LIMIT, CHAT_MODE_LABELS, ChatMode } from '../../types/chat.types'
import './Assistant.css'

const CAPABILITIES: { mode: ChatMode; icon: JSX.Element; description: string; placeholder: string }[] = [
    { mode: 'interpret_results', icon: <IoAnalyticsOutline />, description: 'Make sense of assessments and capacity scores.', placeholder: 'Share a result or score you would like to understand…' },
    { mode: 'explain_concepts', icon: <IoBulbOutline />, description: 'Explore biomechanics and kinesiology concepts.', placeholder: 'Which concept would you like to explore?' },
    { mode: 'protocol_guidance', icon: <IoLayersOutline />, description: 'Structure a rehabilitation or training draft.', placeholder: 'What is the goal of the protocol you are designing?' },
    { mode: 'performance_advice', icon: <IoTrendingUpOutline />, description: 'Find practical ways to support performance.', placeholder: 'What sport or performance goal are you working on?' },
]

function Assistant() {
    const { isAuthenticated, user } = useAuth()
    const chat = useAssistantChat(user?.id)
    const isOnline = useOnlineStatus()
    const [draft, setDraft] = useState('')
    const [showLatest, setShowLatest] = useState(false)
    const composer = useRef<HTMLTextAreaElement>(null)
    const transcript = useRef<HTMLDivElement>(null)
    const nearBottom = useRef(true)
    const hasMessages = chat.messages.length > 0
    const currentFocus = CAPABILITIES.find(capability => capability.mode === chat.mode)
    const canSend = isAuthenticated && isOnline && Boolean(draft.trim()) && !chat.isSending && !chat.isLoading && !chat.waiting && !chat.failedTurn

    useEffect(() => { setDraft('') }, [chat.conversation?.id, user?.id])
    useEffect(() => {
        if (composer.current) {
            composer.current.style.height = 'auto'
            composer.current.style.height = `${Math.min(composer.current.scrollHeight, 180)}px`
        }
    }, [draft])
    useEffect(() => {
        if (nearBottom.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
        else if (hasMessages) setShowLatest(true)
    }, [chat.messages, chat.isSending, chat.error, hasMessages])
    useEffect(() => {
        if (!chat.isSending && isAuthenticated) composer.current?.focus({ preventScroll: true })
    }, [chat.isSending, isAuthenticated])

    const send = () => {
        if (!canSend) return
        nearBottom.current = true
        setShowLatest(false)
        if (chat.send(draft)) setDraft('')
    }
    const reset = () => {
        chat.reset()
        setDraft('')
        setShowLatest(false)
        nearBottom.current = true
        composer.current?.focus()
    }

    return (
        <PageTemplate title="Clinical Assistant" subtitle="A little clarity. A better next step." className="assistant-page">
          <div className="assistant-layout">
            <aside className="assistant-history" aria-label="Saved conversations">
                <div className="assistant-history-heading"><h2>Your conversations</h2><button type="button" aria-label="Refresh conversations" onClick={() => void chat.refreshList()}><IoRefreshOutline /></button></div>
                {chat.listError && <p role="alert">{chat.listError}</p>}
                {!chat.conversations.length && !chat.listError && <p>Your saved chats will appear here.</p>}
                <ul>{chat.conversations.map(item => <li key={item.id} className={chat.conversation?.id === item.id ? 'is-active' : ''}>
                    <button type="button" className="assistant-history-open" onClick={() => chat.open(item.id)} aria-current={chat.conversation?.id === item.id ? 'true' : undefined}>
                        <span>{item.title}</span><small>{CHAT_MODE_LABELS[item.mode]}</small>
                    </button>
                    <button type="button" className="assistant-history-delete" aria-label={`Delete ${item.title}`} onClick={() => {
                        if (window.confirm('Delete this conversation and its messages? This cannot be undone.')) void chat.remove(item.id)
                    }}><IoTrashOutline /></button>
                </li>)}</ul>
            </aside>
            <section className={`assistant ${hasMessages ? 'assistant--conversation' : ''}`} aria-label="Physoft assistant">
                <header className="assistant-toolbar">
                    <button type="button" className="assistant-new" onClick={reset}>
                        <IoAdd aria-hidden="true" /> New conversation
                    </button>
                </header>
                {!hasMessages && !chat.isLoading && <div className="assistant-hero">
                    <div className="assistant-hero-icon"><IoSparkles aria-hidden="true" /></div>
                    <p className="assistant-eyebrow">YOUR PARTNER IN MOVEMENT SCIENCE</p>
                    <h2>What would you like to understand?</h2>
                    <p>Choose a focus, or simply ask. We’ll bring the expertise<br className="assistant-desktop-break" /> so you can get straight to the question.</p>
                </div>}
                {!chat.modeChosen && !chat.isLoading && <><div className="assistant-focus-heading">
                    <span>Choose a focus for this conversation</span>
                    <span>Optional · fixed when you send</span>
                </div>
                <div className="assistant-suggestions" role="group" aria-label="Optional conversation focus">
                    {CAPABILITIES.map(capability => (
                        <button type="button" key={capability.mode}
                            className={`assistant-suggestion ${chat.mode === capability.mode ? 'is-selected' : ''}`}
                            aria-pressed={chat.mode === capability.mode}
                            disabled={chat.isSending || !isAuthenticated}
                            onClick={() => { chat.chooseMode(chat.mode === capability.mode ? 'general' : capability.mode); composer.current?.focus({ preventScroll: true }) }}>
                            <span className="assistant-suggestion-icon" aria-hidden="true">{capability.icon}</span>
                            <span className="assistant-suggestion-body">
                                <span className="assistant-suggestion-title">{CHAT_MODE_LABELS[capability.mode]}</span>
                                <span className="assistant-suggestion-desc">{capability.description}</span>
                            </span>
                            <span className="assistant-selection" aria-hidden="true">{chat.mode === capability.mode && <IoCheckmark />}</span>
                        </button>
                    ))}
                </div></>}
                {chat.modeChosen && <p className="assistant-focus-locked">{CHAT_MODE_LABELS[chat.mode]} · Focus fixed for this conversation</p>}
                {chat.isLoading && <p role="status">Loading conversation…</p>}
                {hasMessages && <div className="assistant-transcript-wrap">
                    <div className="assistant-transcript" ref={transcript} role="log" aria-label="Conversation" aria-live="polite" tabIndex={0}
                        onScroll={() => {
                            const element = transcript.current
                            if (!element) return
                            nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
                            if (nearBottom.current) setShowLatest(false)
                        }}>
                        {chat.messages.map(message => <ChatMessage key={message.id} message={message} />)}
                        {(chat.isSending || chat.waiting) && <div className="assistant-thinking" role="status">
                            <IoSparkles aria-hidden="true" /><span>Thinking through your question</span>
                            <span className="assistant-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                        </div>}
                    </div>
                    {showLatest && <button className="assistant-latest" type="button" onClick={() => {
                        if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
                        nearBottom.current = true
                        setShowLatest(false)
                    }}><IoArrowDown aria-hidden="true" /> Latest message</button>}
                </div>}
                {(chat.error || chat.failedTurn) && <div className="assistant-error" role="alert">
                    <p>{chat.error || 'The last answer was interrupted. Retry the saved question.'}</p>
                    {!chat.waiting && <div>
                        <button type="button" onClick={chat.retry} disabled={!isOnline || !isAuthenticated}><IoRefreshOutline aria-hidden="true" /> Retry</button>
                    </div>}
                </div>}
                {!isAuthenticated && <p className="assistant-notice"><Link to="/login">Sign in</Link> to start a conversation with your assistant.</p>}
                {!isOnline && <p className="assistant-notice" role="status">You’re offline. Reconnect to send your question.</p>}
                <form className="assistant-composer" onSubmit={event => { event.preventDefault(); send() }}>
                    <div className="assistant-composer-focus"><IoSparkles aria-hidden="true" /> {CHAT_MODE_LABELS[chat.mode]}<span>Expertise included. Just ask.</span></div>
                    <label htmlFor="assistant-question" className="assistant-sr-only">Your question</label>
                    <textarea id="assistant-question" ref={composer} value={draft} rows={2} maxLength={CHAT_MESSAGE_LIMIT}
                        onChange={event => setDraft(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                                event.preventDefault(); send()
                            }
                        }}
                        placeholder={currentFocus?.placeholder || 'Ask about movement, training, recovery, or a concept on your mind…'}
                        aria-describedby="assistant-composer-help" disabled={!isAuthenticated || chat.failedTurn || chat.isLoading}
                    />
                    <div className="assistant-composer-footer">
                        <span id="assistant-composer-help">Shift + Enter for a new line <span className="assistant-count">{draft.length.toLocaleString()} / 4,000</span></span>
                        {chat.isSending ? <button className="assistant-send assistant-stop" type="button" onClick={chat.stop}><IoStop aria-hidden="true" /> Stop</button>
                            : <button className="assistant-send" type="submit" disabled={!canSend}><span>Send</span><IoSend aria-hidden="true" /></button>}
                    </div>
                </form>
                <p className="assistant-disclaimer">AI guidance supports your professional judgment. Avoid identifying patient details.<br />Conversations are saved to your account. Start a new chat to choose a different focus.</p>
            </section>
          </div>
        </PageTemplate>
    )
}
export default Assistant
