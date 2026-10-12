import { IoGolfOutline, IoImageOutline } from 'react-icons/io5'
import {
    SPORT_IMAGES,
    SPORT_TITLES,
    SPORT_PLACEHOLDERS,
    DEFAULT_SPORT_PLACEHOLDER,
    INERTIAL_FORCE_PHASES
} from './sportAssets'
import './charts/ChartCard.css'
import './SportReportSection.css'

interface SportReportSectionProps {
    sport?: string | null
}

/**
 * Sport Report — keeps the section's space and design, but Inertial Force
 * stays "Not evaluated" until acquisition and a calculation method are
 * available (a wrist IMU alone does not give whole-body force; it has to be
 * converted to newtons using the measured velocity).
 */
function SportReportSection({ sport }: SportReportSectionProps) {
    const title = sport ? SPORT_TITLES[sport] || `INERTIAL FORCE IN ${sport.toUpperCase()}` : 'INERTIAL FORCE ANALYSIS'
    const image = sport ? SPORT_IMAGES[sport] : undefined
    const placeholderText = sport ? SPORT_PLACEHOLDERS[sport] || DEFAULT_SPORT_PLACEHOLDER : DEFAULT_SPORT_PLACEHOLDER
    const phases = sport ? INERTIAL_FORCE_PHASES[sport] : undefined

    return (
        <section className="analysis-section">
            <h2>
                <IoGolfOutline /> {title}
            </h2>

            <div className="sport-report-body">
                <div className="sport-report-visual">
                    {image ? (
                        <img src={image} alt={sport ? `${sport} illustration` : 'Sport illustration'} className="sport-report-image" />
                    ) : (
                        <div className="sport-report-placeholder">
                            <IoImageOutline />
                            <p>{placeholderText}</p>
                        </div>
                    )}

                    <div className="chart-card sport-report-chart-card">
                        <div className="chart-card-header">
                            <div className="chart-card-title-row">
                                <h3>Inertial Force by Phase</h3>
                                <span className="report-status-tag report-status-not_evaluated">Not evaluated</span>
                            </div>
                        </div>
                        <div className="sport-report-phases">
                            {(phases ?? ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']).map((phase) => (
                                <div key={phase} className="sport-report-phase">
                                    <span className="sport-report-phase-bar" />
                                    <span>{phase}</span>
                                    <strong>—</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="sport-report-side">
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3>Interpretation</h3>
                        </div>
                        <p className="chart-card-note" style={{ marginTop: 0 }}>
                            Not evaluated. Results will be shown once inertial force acquisition and a validated calculation method are available.
                            A wrist IMU alone does not provide whole-body force: it has to be converted to newtons using the measured velocity.
                        </p>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3>Metrics</h3>
                        </div>
                        <div className="sport-report-metrics">
                            {['Peak Force', 'Average Force', 'Control Index', 'Variability'].map((label) => (
                                <div key={label} className="sport-report-metric">
                                    <span className="sport-report-metric-label">{label}</span>
                                    <span className="sport-report-metric-value sport-report-metric-empty">Not evaluated</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default SportReportSection
