import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoLogOutOutline } from 'react-icons/io5'
import ConfirmModal from '@/components/common/feedback/ConfirmModal'
import { useAuth } from '@/hooks'
import { ROUTES, MESSAGES } from '@/constants'
import './DashboardHeader.css'

function DashboardHeader() {
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

    const handleLogout = () => {
        setIsLogoutConfirmOpen(false)
        logout()
        navigate(ROUTES.LOGIN, { replace: true })
    }

    return (
        <div className="dashboard-header">
            <div className="dashboard-header-greeting">
                <h1 className="dashboard-header-title">Welcome back, Administrator</h1>
                <p className="dashboard-header-subtitle">
                    Here's an overview of your clinic and recent activity.
                </p>
            </div>

            <div className="dashboard-header-session">
                {user?.email && <span className="dashboard-header-user" title="Signed in as">{user.email}</span>}
                <button
                    type="button"
                    className="dashboard-header-logout"
                    onClick={() => setIsLogoutConfirmOpen(true)}
                    title="Log out of this device"
                >
                    <IoLogOutOutline />
                    <span>Log out</span>
                </button>
            </div>

            <ConfirmModal
                isOpen={isLogoutConfirmOpen}
                title="Log out"
                message={MESSAGES.CONFIRM.LOGOUT}
                confirmLabel="Log out"
                danger
                onConfirm={handleLogout}
                onCancel={() => setIsLogoutConfirmOpen(false)}
            />
        </div>
    )
}

export default DashboardHeader
