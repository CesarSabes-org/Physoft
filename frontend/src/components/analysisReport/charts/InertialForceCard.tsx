import { IoImageOutline } from 'react-icons/io5'
import { DEFAULT_SPORT_PLACEHOLDER, INERTIAL_FORCE_PHASES, SPORT_IMAGES, SPORT_PLACEHOLDERS } from '../sportAssets'
import ReportCard from './ReportCard'
import './InertialForceCard.css'

const METRICS = ['Peak Force', 'Average Force', 'Control Index', 'Variability']

/**
 * Inertial Force for the assessment sport. Stays "Not evaluated" until
 * acquisition and a calculation method are available: a wrist IMU alone does
 * not give whole-body force, it has to be converted to newtons using the
 * measured velocity.
 */
function InertialForceCard({ sport, index }: { sport: string | null; index?: number }) {
    const image = sport ? SPORT_IMAGES[sport] : undefined
    const phases = (sport && INERTIAL_FORCE_PHASES[sport]) || ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']

    return (
        <ReportCard
            title={sport ? `Inertial Force — ${sport}` : 'Inertial Force'}
            index={index}
            subtitle="Force by movement phase"
        >
            <div className="inertial-card-body">
                <div className="inertial-card-visual">
                    {image ? (
                        <img src={image} alt={`${sport} illustration`} />
                    ) : (
                        <div className="inertial-card-placeholder">
                            <IoImageOutline />
                            <span>{(sport && SPORT_PLACEHOLDERS[sport]) || DEFAULT_SPORT_PLACEHOLDER}</span>
                        </div>
                    )}
                </div>

                <div className="inertial-card-data">
                    <span className="report-status-tag report-status-not_evaluated">Not evaluated</span>
                    <div className="inertial-card-phases">
                        {phases.map((phase) => (
                            <div key={phase}>
                                <span className="inertial-card-phase-bar" />
                                <span>{phase}</span>
                            </div>
                        ))}
                    </div>
                    <dl className="report-kv">
                        {METRICS.map((metric) => (
                            <div key={metric}>
                                <dt>{metric}</dt>
                                <dd className="inertial-card-empty">Not evaluated</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="chart-card-note">
                        Shown once inertial force acquisition and a validated calculation method are available. A wrist IMU
                        alone does not provide whole-body force: it has to be converted to newtons using the measured velocity.
                    </p>
                </div>
            </div>
        </ReportCard>
    )
}

export default InertialForceCard
