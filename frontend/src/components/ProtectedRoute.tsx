import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../constants'

/**
 * Layout route gating every authenticated page. Reactive on every
 * navigation (reads live context state, not a one-time mount check), so a
 * logout followed by the browser Back button redirects again immediately
 * instead of briefly rendering the protected page.
 *
 * The session persists across browser restarts: the JWT lives in
 * localStorage until it expires (JWT_EXPIRES_IN on the backend) or the user
 * logs out.
 */
function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
