import type { ReactNode } from 'react'
import {
    IoAccessibilityOutline,
    IoBatteryHalfOutline,
    IoBodyOutline,
    IoFlashOutline,
    IoGitCompareOutline,
    IoGridOutline,
    IoPieChartOutline,
    IoShieldCheckmarkOutline
} from 'react-icons/io5'
import { TONE_COLORS } from './charts/ReportCard'
import { buildCapacityProfile, type CapacityKey, type ReportData } from './reportData'
import './CapacityProfileSection.css'

const ICONS: Record<CapacityKey, ReactNode> = {
    mobility: <IoBodyOutline />,
    explosive: <IoFlashOutline />,
    fatigue: <IoBatteryHalfOutline />,
    balance: <IoAccessibilityOutline />,
    fallRisk: <IoShieldCheckmarkOutline />,
    asymmetry: <IoGitCompareOutline />,
    composition: <IoPieChartOutline />
}

/** Capacity Profile — one card per capacity: measured value and rule-based result. */
function CapacityProfileSection({ data }: { data: ReportData }) {
    const cards = buildCapacityProfile(data)

    return (
        <section className="analysis-section">
            <h2>
                <IoGridOutline /> Capacity Profile
                <span className="section-heading-note">Objective measures</span>
            </h2>

            <div className="capacity-grid">
                {cards.map((card) => {
                    const color = TONE_COLORS[card.tone]
                    const muted = card.tone === 'muted'
                    return (
                        <div key={card.key} className={`capacity-card ${muted ? 'is-muted' : ''}`}>
                            <div className="capacity-card-head">
                                <span className="capacity-card-icon" style={{ color: muted ? undefined : color }}>{ICONS[card.key]}</span>
                                <span className="capacity-card-title">{card.title}</span>
                            </div>

                            <span className="capacity-card-value">{card.value}</span>

                            {card.score !== null && (
                                <span className="capacity-card-bar" aria-hidden="true">
                                    <span style={{ width: `${card.score}%`, background: color }} />
                                </span>
                            )}

                            {card.rating && (
                                <span className="capacity-card-rating" style={{ color, borderColor: color }}>{card.rating}</span>
                            )}

                            {card.detail && <span className="capacity-card-detail">{card.detail}</span>}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

export default CapacityProfileSection
