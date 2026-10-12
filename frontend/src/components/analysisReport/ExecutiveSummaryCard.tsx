import { IoAnalyticsOutline } from 'react-icons/io5'
import { effectiveStatus, CLINICAL_SECTIONS } from '@/utils/clinicalScoring'
import { TONE_COLORS } from './charts/ReportCard'
import type { ReportData } from './reportData'
import './ExecutiveSummaryCard.css'

const MAX_FINDINGS = 6

/**
 * Executive Summary — documented findings with their source. No global
 * 0-100 score is presented until a justified formula exists, and the
 * cohort comparison is withdrawn.
 */
function ExecutiveSummaryCard({ data }: { data: ReportData }) {
    const { results, findings, flexibility } = data
    const boxes = CLINICAL_SECTIONS.filter((s) => s.box !== null)
    const evaluatedBoxes = boxes.filter((s) => effectiveStatus(results, s.key) !== 'NOT_EVALUATED').length + (flexibility.ratedCount > 0 ? 1 : 0)
    const pendingVerification = boxes.filter((s) => effectiveStatus(results, s.key) === 'PENDING_VERIFICATION')
    const sources = new Set(
        [flexibility.ratedCount > 0 ? 'Evaluator form' : null, ...boxes.map((s) => (effectiveStatus(results, s.key) !== 'NOT_EVALUATED' ? results[s.key].source : null))]
            .filter((s): s is string => Boolean(s))
    )
    const shown = findings.slice(0, MAX_FINDINGS)

    return (
        <section className="analysis-section executive-summary-card">
            <h2>
                <IoAnalyticsOutline /> Executive Summary
            </h2>

            <div className="executive-summary-body">
                <div className="executive-summary-text">
                    {shown.length === 0 ? (
                        <p>
                            {evaluatedBoxes === 0
                                ? 'No results recorded for this evaluation yet.'
                                : 'No limitations were documented in the evaluated boxes.'}
                        </p>
                    ) : (
                        <ul className="executive-summary-findings">
                            {shown.map((finding, idx) => (
                                <li key={idx}>
                                    <span
                                        className="executive-summary-dot"
                                        style={{ background: finding.level === 'limitation' ? TONE_COLORS.bad : TONE_COLORS.warning }}
                                    />
                                    <div>
                                        <p>{finding.text}</p>
                                        {finding.source && <span className="executive-summary-source">Source: {finding.source}</span>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {findings.length > MAX_FINDINGS && (
                        <p className="executive-summary-more">+{findings.length - MAX_FINDINGS} more in Detailed Analysis</p>
                    )}
                </div>

                <div className="executive-summary-stats">
                    <div className="executive-summary-stat">
                        <span className="executive-summary-stat-label">Boxes evaluated</span>
                        <span className="executive-summary-stat-value">{evaluatedBoxes}/9</span>
                    </div>
                    <div className="executive-summary-stat">
                        <span className="executive-summary-stat-label">Data sources</span>
                        <span className="executive-summary-stat-value">{sources.size}</span>
                    </div>
                    {pendingVerification.length > 0 && (
                        <div className="executive-summary-stat">
                            <span className="executive-summary-stat-label">Pending verification</span>
                            <span className="executive-summary-stat-value" style={{ color: TONE_COLORS.warning }}>
                                {pendingVerification.map((s) => s.title).join(', ')}
                            </span>
                        </div>
                    )}
                    <div className="executive-summary-stat">
                        <span className="executive-summary-stat-label">Global score</span>
                        <span className="executive-summary-stat-muted">Not presented — requires a justified formula</span>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default ExecutiveSummaryCard
