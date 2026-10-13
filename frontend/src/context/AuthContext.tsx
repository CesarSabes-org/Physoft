import { createContext, ReactNode, useState } from 'react'
import { authAPI, AuthUser } from '../services/authApi'
import { getToken, setToken, clearToken, isTokenExpired, decodeToken } from '../utils/tokenStorage'

interface AuthState {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readInitialState(): AuthState {
  const token = getToken()

  if (token && !isTokenExpired(token)) {
    const decoded = decodeToken(token)
    if (decoded) {
      return {
        token,
        user: { id: decoded.id, email: decoded.email, role: decoded.role as AuthUser['role'] },
        isAuthenticated: true
      }
    }
  }

  clearToken()
  return { token: null, user: null, isAuthenticated: false }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Synchronous lazy initializer: runs once, before the first paint, so
  // ProtectedRoute always sees the correct isAuthenticated value on its
  // very first render — no loading flash, no async gate.
  const [state, setState] = useState<AuthState>(readInitialState)

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password)
    const { token, user } = response.data
    setToken(token)
    setState({ token, user, isAuthenticated: true })
  }

  const logout = () => {
    clearToken()
    setState({ token: null, user: null, isAuthenticated: false })
  }

  // A token that expires while the app stays open ends the session on the
  // next navigation instead of leaving a dead session behind.
  const isAuthenticated = state.isAuthenticated && state.token !== null && !isTokenExpired(state.token)

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
