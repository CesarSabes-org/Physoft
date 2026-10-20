import { IoImageOutline } from 'react-icons/io5'
import type { ClinicalResults } from '@/types/clinicalResults.types'
import { effectiveStatus, summarizeInertialForce } from '@/utils/clinicalScoring'
import { DEFAULT_SPORT_PLACEHOLDER, SPORT_IMAGES, SPORT_PLACEHOLDERS, inertialPhaseLabels } from '../sportAssets'
import ReportCard, { StatusTag } from './ReportCard'
import './InertialForceCard.css'

/**
 * Inertial Force of the sport gesture, by phase. Each phase shows the
 * device's force, or F = m × a from the IMU acceleration and the mass the
 * evaluator recorded. No classification until reference standards exist.
 */
function InertialForceCard({ results, sport, index }: { results: ClinicalResults; sport: string | null; index?: number }) {
    const section = results.inertialForce
    const status = effectiveStatus(results, 'inertialForce')
    const evaluated = status !== 'NOT_EVALUATED'
    const summary = summarizeInertialForce(section)
    const labels = inertialPhaseLabels(sport)
    const image = sport ? SPORT_IMAGES[sport] : undefined
    const anyCalculated = summary.phases.some((p) => p.method === 'calculated')

    return (
        <ReportCard
            title={sport ? `Inertial Force — ${sport}` : 'Inertial Force'}
            index={index}
            subtitle="Force by movement phase"
            source={evaluated ? section.source : null}
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
                    <StatusTag status={status} />

                    <div className="inertial-card-phases">
                        {labels.map((label, i) => {
                            const phase = summary.phases[i]
                            const height = phase.forceN !== null && summary.peak ? Math.max(6, (phase.forceN / summary.peak.forceN) * 100) : 0
                            return (
                                <div key={label}>
                                    <span className="inertial-card-phase-value">
                                        {phase.forceN !== null ? `${phase.forceN}${phase.method === 'calculated' ? '*' : ''}` : '—'}
                                    </span>
                                    <span className={`inertial-card-phase-bar ${phase.forceN !== null ? 'has-value' : ''}`}>
                                        {phase.forceN !== null && (
                                            <span
                                                className={summary.peak?.phaseIndex === i ? 'is-peak' : undefined}
                                                style={{ height: `${height}%` }}
                                            />
                                        )}
                                    </span>
                                    <span>{label}</span>
                                </div>
                            )
                        })}
                    </div>

                    <dl className="report-kv">
                        <div>
                            <dt>Peak force</dt>
                            <dd className={summary.peak ? undefined : 'inertial-card-empty'}>
                                {summary.peak ? `${summary.peak.forceN} N` : 'Not evaluated'}
                                {summary.peak && <small>{labels[summary.peak.phaseIndex]}</small>}
                            </dd>
                        </div>
                        <div>
                            <dt>Average force</dt>
                            <dd className={summary.averageN !== null ? undefined : 'inertial-card-empty'}>
                                {summary.averageN !== null ? `${summary.averageN} N` : 'Not evaluated'}
                                {summary.averageN !== null && <small>{summary.phasesWithForce} of 4 phases</small>}
                            </dd>
                        </div>
                        <div>
                            <dt>Control Index</dt>
                            <dd className="inertial-card-empty">Pending method</dd>
                        </div>
                        <div>
                            <dt>Variability</dt>
                            <dd className="inertial-card-empty">Pending method</dd>
                        </div>
                    </dl>

                    {evaluated ? (
                        <>
                            {anyCalculated && (
                                <p className="chart-card-note">
                                    * Calculated as F = m × a from the IMU acceleration and a mass of {section.massKg} kg. Other values are the device's force.
                                </p>
                            )}
                            <p className="chart-card-note">Classification: <strong>Pending reference standards</strong>.</p>
                            {section.notes && <p className="chart-card-note">{section.notes}</p>}
                        </>
                    ) : (
                        <p className="chart-card-note">
                            Not evaluated. Record the force of each phase from the device, or the IMU acceleration and the mass so it can be calculated as F = m × a.
                        </p>
                    )}
                </div>
            </div>
        </ReportCard>
    )
}

export default InertialForceCard
