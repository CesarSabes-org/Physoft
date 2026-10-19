import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoNotifications, IoLockClosed, IoColorPalette, IoLanguage, IoInformationCircle, IoLogOutOutline } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import ChangePasswordModal from '../../components/common/feedback/ChangePasswordModal'
import ConfirmModal from '../../components/common/feedback/ConfirmModal'
import Toast, { ToastType } from '../../components/common/feedback/Toast'
import { useAuth } from '../../hooks'
import { ROUTES, MESSAGES } from '../../constants'
import './Settings.css'

function Settings() {
    const navigate = useNavigate()
    const { logout } = useAuth()
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
    const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    const handlePasswordChanged = () => {
        setIsChangePasswordOpen(false)
        setToast({ type: 'success', message: MESSAGES.SUCCESS.PASSWORD_CHANGED })
    }

    const handleLogout = () => {
        setIsLogoutConfirmOpen(false)
        logout()
        navigate(ROUTES.LOGIN, { replace: true })
    }

    return (
        <PageTemplate
            title="Settings"
            subtitle="Customize your Physoft experience"
            showBackButton={true}
            breadcrumbItems={[
                { label: 'Settings' }
            ]}
        >
            <div className="settings-container">
                {/* Notifications */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoNotifications className="config-icon" />
                        <h3>Notifications</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Email notifications</p>
                                <p className="option-description">Receive updates about assessments and patients</p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Analysis reminders</p>
                                <p className="option-description">We'll remind you to perform periodic assessments</p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoLockClosed className="config-icon" />
                        <h3>Security</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Change password</p>
                                <p className="option-description">Update your password regularly</p>
                            </div>
                            <button className="config-btn" onClick={() => setIsChangePasswordOpen(true)}>Change</button>
                        </div>
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Autenticación de dos factores</p>
                                <p className="option-description">Añade una capa extra de seguridad</p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Session */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoLogOutOutline className="config-icon" />
                        <h3>Session</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Log out</p>
                                <p className="option-description">End your current session on this device</p>
                            </div>
                            <button className="config-btn config-btn-danger" onClick={() => setIsLogoutConfirmOpen(true)}>
                                Log out
                            </button>
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoColorPalette className="config-icon" />
                        <h3>Appearance</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Dark theme</p>
                                <p className="option-description">Currently active (default)</p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" defaultChecked disabled />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Language */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoLanguage className="config-icon" />
                        <h3>Language & Region</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Language</p>
                                <p className="option-description">Currently active (default). More languages coming soon</p>
                            </div>
                            {/* Locked like the theme toggle until the UI is translated */}
                            <select className="config-select" value="en" disabled aria-label="Language">
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* About */}
                <div className="config-section">
                    <div className="config-section-header">
                        <IoInformationCircle className="config-icon" />
                        <h3>About</h3>
                    </div>
                    <div className="config-options">
                        <div className="config-option">
                            <div className="option-info">
                                <p className="option-title">Physoft Version</p>
                                <p className="option-description">{__APP_VERSION__} Beta</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
                onSuccess={handlePasswordChanged}
            />

            <ConfirmModal
                isOpen={isLogoutConfirmOpen}
                title="Log out"
                message={MESSAGES.CONFIRM.LOGOUT}
                confirmLabel="Log out"
                danger
                onConfirm={handleLogout}
                onCancel={() => setIsLogoutConfirmOpen(false)}
            />

            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </PageTemplate>
    )
}

export default Settings
