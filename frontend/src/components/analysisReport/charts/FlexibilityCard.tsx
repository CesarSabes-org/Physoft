import type { FlexibilityRating } from '@/services/api'
import CapacityRadarChart from '../CapacityRadarChart'
import {
    FLEXIBILITY_EXERCISE_LABELS,
    FLEXIBILITY_RATING_INTERPRETATION,
    FLEXIBILITY_RATING_LABELS,
    type FlexibilityScore
} from '@/utils/clinicalScoring'
import ReportCard, { TONE_COLORS } from './ReportCard'
import type { Tone } from '../reportData'
import './FlexibilityCard.css'

const RATING_TONE: Record<FlexibilityRating, Tone> = {
    LOW: 'bad',
    MEDIUM: 'mid',
    HIGH: 'good',
    RISK: 'warning'
}

/** Box 1 — four standardized tests (evaluator selection), points and score. */
function FlexibilityCard({ flexibility }: { flexibility: FlexibilityScore }) {
    const rated = flexibility.ratedCount > 0

    return (
        <ReportCard
            title="1 · Flexibility"
            subtitle="Flexibility Score = (P1 + P2 + P3 + P4) / 4"
            source={rated ? 'Form — evaluator selection' : null}
            status={rated ? 'EVALUATED' : 'NOT_EVALUATED'}
        >
            <div className={`flex-card-body ${flexibility.score === null ? 'flex-card-body-list' : ''}`}>
                {/* Radar only with all 4 tests rated: a missing test must never be drawn as 0 */}
                {flexibility.score !== null && (
                    <CapacityRadarChart
                        axes={flexibility.tests.map((t) => ({ label: FLEXIBILITY_EXERCISE_LABELS[t.exerciseId], value: t.points as number }))}
                        size={260}
                    />
                )}

                <ul className="flex-card-tests">
                    {flexibility.tests.map((test) => (
                        <li key={test.exerciseId}>
                            <div>
                                <span className="flex-card-test-name">{FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]}</span>
                                <span className="flex-card-test-note">
                                    {test.rating ? FLEXIBILITY_RATING_INTERPRETATION[test.rating] : 'Not evaluated'}
                                </span>
                            </div>
                            <div className="flex-card-test-result">
                                {test.rating ? (
                                    <>
                                        <strong style={{ color: TONE_COLORS[RATING_TONE[test.rating]] }}>
                                            {test.rating === 'RISK' ? '⚠ ' : ''}{FLEXIBILITY_RATING_LABELS[test.rating]}
                                        </strong>
                                        <span>{test.points}{test.rating === 'RISK' ? '*' : ''} pts</span>
                                    </>
                                ) : (
                                    <span>—</span>
                                )}
                                {test.evidenceUrl && (
                                    <a href={test.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex-card-evidence">
                                        <img src={test.evidenceUrl} alt={`${FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]} evidence`} />
                                    </a>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="chart-card-footer">
                <span className="chart-card-footer-label">Flexibility Score</span>
                <span className="chart-card-footer-value">
                    {flexibility.score !== null ? `${flexibility.score} / 100` : `Incomplete — ${flexibility.ratedCount}/4 tests rated`}
                </span>
            </div>
            {flexibility.riskExercises.length > 0 && (
                <p className="chart-card-note">
                    * Risk adds no extra points: it keeps the maximum range score and raises a separate warning to review joint control.
                    It does not automatically mean a higher injury risk.
                </p>
            )}
        </ReportCard>
    )
}

export default FlexibilityCard
