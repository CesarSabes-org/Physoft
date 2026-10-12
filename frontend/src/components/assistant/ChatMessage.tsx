import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoPersonOutline, IoSparkles } from 'react-icons/io5'
import { AssistantMessage, CHAT_MODE_LABELS } from '../../types/chat.types'

export default function ChatMessage({ message }: { message: AssistantMessage }) {
  const isAssistant = message.role === 'assistant'
  return (
    <article className={`chat-message chat-message--${message.role}`} aria-label={isAssistant ? 'Assistant response' : 'Your message'}>
      <div className="chat-avatar" aria-hidden="true">{isAssistant ? <IoSparkles /> : <IoPersonOutline />}</div>
      <div className="chat-message-main">
        <div className="chat-message-heading">
          <strong>{isAssistant ? 'Physoft Assistant' : 'You'}</strong>
          {isAssistant && <span>{CHAT_MODE_LABELS[message.mode]}</span>}
        </div>
        {isAssistant ? (
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
              img: () => null,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
            }}>{message.content}</ReactMarkdown>
          </div>
        ) : <p className="chat-user-text">{message.content}</p>}
        {message.truncated && <p className="chat-truncated">This answer reached its length limit. Ask the assistant to continue.</p>}
      </div>
    </article>
  )
}
