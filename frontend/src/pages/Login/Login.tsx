import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { IoLogInOutline, IoAlertCircle, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import { ButtonLoadingContent } from '../../components/common/feedback/ButtonSpinner'
import { useAuth } from '../../hooks'
import { ROUTES, MESSAGES } from '../../constants'
import physoftLogo from '@/assets/physoft.png'
import './Login.css'

function Login() {
    const { isAuthenticated, login } = useAuth()
    const location = useLocation()
    const from: unknown = location.state?.from
    const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : ROUTES.DASHBOARD
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Already signed in — nothing to do here.
    if (isAuthenticated) {
        return <Navigate to={destination} replace />
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await login(email, password)
        } catch {
            // Backend errors (wrong credentials, rate limiting, network) are
            // never surfaced verbatim — always this one generic message.
            setError(MESSAGES.ERROR.LOGIN_FAILED)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <PageTemplate showNavbar={false} className="login-wrapper">
            <div className="login-container">
                <div className="login-content">
                    <div className="logo-container">
                        <img
                            src={physoftLogo}
                            alt="Physoft Logo"
                            className="login-logo"
                        />
                    </div>

                    <h1 className="login-title">Physoft</h1>
                    <p className="login-subtitle">Sign in to your account</p>

                    <form className="login-form" onSubmit={handleSubmit} noValidate>
                        {error && (
                            <div className="login-error" role="alert">
                                <IoAlertCircle className="login-error-icon" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="login-field">
                            <label htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@physoft.com"
                                autoComplete="username"
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="login-field">
                            <label htmlFor="login-password">Password</label>
                            <div className="login-password-wrap">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    disabled={isSubmitting}
                                />
                                <button
                                    type="button"
                                    className="login-password-toggle"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    disabled={isSubmitting}
                                >
                                    {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-button" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <ButtonLoadingContent text="Signing in..." />
                            ) : (
                                <>
                                    <span>Login</span>
                                    <IoLogInOutline className="button-icon" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p>Physoft Datasoftware © 2025</p>
                    </div>
                </div>

                <div className="animated-background">
                    <div className="gradient-orb orb-1"></div>
                    <div className="gradient-orb orb-2"></div>
                    <div className="gradient-orb orb-3"></div>
                </div>
            </div>
        </PageTemplate>
    )
}

export default Login
