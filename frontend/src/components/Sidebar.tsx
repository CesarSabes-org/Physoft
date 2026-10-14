import { memo, type ReactElement } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
    IoHomeOutline,
    IoPeopleOutline,
    IoClipboardOutline,
    IoBarChartOutline,
    IoDocumentTextOutline,
    IoLayersOutline,
    IoSettingsOutline,
    IoPersonOutline
} from 'react-icons/io5'
import assistantImage from '@/assets/ClinicalAssistant/IA.webp'
import physoftLogo from '@/assets/physoft.png'
import { ROUTES } from '../constants'
import '../styles/Sidebar.css'

interface NavItem {
    label: string
    path: string
    icon: ReactElement
    /** Path prefixes that should mark this item as active */
    match: string[]
}

const MAIN_ITEMS: NavItem[] = [
    { label: 'Home', path: ROUTES.DASHBOARD, icon: <IoHomeOutline />, match: ['/dashboard'] },
    { label: 'Patients', path: ROUTES.ALL_PATIENTS, icon: <IoPeopleOutline />, match: ['/patients', '/athlete-detail', '/add-athlete', '/athletes'] },
    { label: 'Assessments', path: ROUTES.ASSESSMENTS, icon: <IoClipboardOutline />, match: ['/analysis', '/all-analyses', '/new-analysis', '/analysis-view'] },
    { label: 'Analytics', path: ROUTES.ANALYTICS, icon: <IoBarChartOutline />, match: ['/analytics'] },
    { label: 'Reports', path: ROUTES.REPORTS, icon: <IoDocumentTextOutline />, match: ['/reports'] },
    { label: 'Protocols', path: ROUTES.PROTOCOLS, icon: <IoLayersOutline />, match: ['/protocols'] }
]

const BOTTOM_ITEMS: NavItem[] = [
    { label: 'Settings', path: ROUTES.SETTINGS, icon: <IoSettingsOutline />, match: ['/settings'] },
    { label: 'Profile', path: ROUTES.PROFILE, icon: <IoPersonOutline />, match: ['/profile'] }
]

function Sidebar() {
    const navigate = useNavigate()
    const location = useLocation()

    const isActive = (item: NavItem) =>
        item.match.some(prefix => location.pathname === prefix || location.pathname.startsWith(prefix))

    const renderItem = (item: NavItem) => (
        <button
            key={item.path}
            className={`sidebar-link ${isActive(item) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            title={item.label}
        >
            {item.icon}
            <span className="sidebar-link-label">{item.label}</span>
        </button>
    )

    const assistantActive = location.pathname.startsWith(ROUTES.ASSISTANT)

    return (
        <aside className="app-sidebar">
            {/* Logo */}
            <button
                className="sidebar-logo"
                onClick={() => navigate(ROUTES.DASHBOARD)}
                title="Physoft"
            >
                <img src={physoftLogo} alt="Physoft" />
            </button>

            {/* Main navigation */}
            <nav className="sidebar-nav">
                {MAIN_ITEMS.map(renderItem)}
            </nav>

            <div className="sidebar-spacer" />

            {/* Clinical Assistant (AI) highlight block */}
            <button
                className={`sidebar-ai-card ${assistantActive ? 'active' : ''}`}
                onClick={() => navigate(ROUTES.ASSISTANT)}
                title="Clinical Assistant"
            >
                <span className="sidebar-ai-icon">
                    <img src={assistantImage} alt="" />
                </span>
                <span className="sidebar-ai-text">
                    <span className="sidebar-ai-title">Clinical Assistant</span>
                    <span className="sidebar-ai-subtitle">AI clinical support</span>
                </span>
            </button>

            {/* Bottom navigation */}
            <nav className="sidebar-nav sidebar-nav-bottom">
                {BOTTOM_ITEMS.map(renderItem)}
            </nav>
        </aside>
    )
}

export default memo(Sidebar)
