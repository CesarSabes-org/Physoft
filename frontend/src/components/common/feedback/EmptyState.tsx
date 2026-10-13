import { ReactNode } from 'react'
import '@/styles/EmptyState.css'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * Componente reutilizable para estados vacíos
 */
function EmptyState({ 
  icon, 
  title, 
  message, 
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      {title && <h3 className="empty-state-title">{title}</h3>}
      <p className="empty-state-message">{message}</p>
      {action && (
        <button className="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
