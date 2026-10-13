import '@/styles/LoadingSpinner.css'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
  fullScreen?: boolean
}

/**
 * Componente reutilizable para estados de carga
 */
function LoadingSpinner({ 
  size = 'medium', 
  message = 'Loading...',
  fullScreen = false
}: LoadingSpinnerProps) {
  const content = (
    <>
      <div className={`loading-spinner ${size}`}>
        <div className="spinner-circle"></div>
      </div>
      {message && <p className="loading-message">{message}</p>}
    </>
  )

  if (fullScreen) {
    return (
      <div className="loading-container fullscreen">
        {content}
      </div>
    )
  }

  return <div className="loading-container">{content}</div>
}

export default LoadingSpinner
