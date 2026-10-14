import { IoAnalyticsOutline, IoArrowUpCircle, IoAlertCircle, IoWarning } from 'react-icons/io5'
import { TONE_COLORS } from './charts/ReportCard'
import { deriveStrengths, evaluationCoverage, type ReportData } from './reportData'
import './ExecutiveSummaryCard.css'

const MAX_ITEMS = 6
const RING_RADIUS = 46
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * Executive Summary — evaluation coverage, documented findings and the
 * results that meet their reference. No global 0-100 score is presented
 * until the client defines a justified formula.
 */
function ExecutiveSummaryCard({ data }: { data: ReportData }) {
    const coverage = evaluationCoverage(data)
    const strengths = deriveStrengths(data)
    const findings = data.findings
    const ratio = coverage.total > 0 ? coverage.evaluated / coverage.total : 0

    return (
        <section className="analysis-section executive-summary-card">
            <h2>
                <IoAnalyticsOutline /> Executive Summary
            </h2>

            <div className="executive-summary-layout">
                <div className="executive-summary-coverage">
                    <svg viewBox="0 0 120 120" className="executive-summary-ring" role="img" aria-label={`${coverage.evaluated} of ${coverage.total} boxes evaluated`}>
                        <circle cx="60" cy="60" r={RING_RADIUS} fill="none" stroke="var(--report-line, rgba(255, 255, 255, 0.08))" strokeWidth={10} />
                        <circle
                            cx="60"
                            cy="60"
                            r={RING_RADIUS}
                            fill="none"
                            stroke="var(--color-primary, #14b8a6)"
                            strokeWidth={10}
                            strokeLinecap="round"
                            strokeDasharray={`${RING_CIRCUMFERENCE * ratio} ${RING_CIRCUMFERENCE}`}
                            transform="rotate(-90 60 60)"
                        />
                        <text x="60" y="58" textAnchor="middle" fill="var(--color-text-primary, #fff)" fontSize={24} fontWeight={800}>{coverage.evaluated}/{coverage.total}</text>
                        <text x="60" y="76" textAnchor="middle" fill="var(--color-text-muted, #737373)" fontSize={11} fontWeight={600} letterSpacing="0.08em">boxes</text>
                    </svg>
                    <span className="executive-summary-coverage-title">Evaluation coverage</span>
                    <span className="executive-summary-coverage-note">
                        {coverage.sources.length} data source{coverage.sources.length === 1 ? '' : 's'}
                    </span>
                    {coverage.pendingVerification.length > 0 && (
                        <span className="executive-summary-coverage-pending">
                            Pending verification: {coverage.pendingVerification.join(', ')}
                        </span>
                    )}
                    <span className="executive-summary-coverage-note">Global score not presented — requires a justified formula</span>
                </div>

                <div className="executive-summary-column">
                    <h3>Areas to address</h3>
                    {findings.length === 0 ? (
                        <p className="executive-summary-empty">
                            {coverage.evaluated === 0 ? 'No results recorded for this evaluation yet.' : 'No limitations documented in the evaluated boxes.'}
                        </p>
                    ) : (
                        <ul className="executive-summary-list">
                            {findings.slice(0, MAX_ITEMS).map((finding, idx) => (
                                <li key={idx}>
                                    {finding.level === 'limitation'
                                        ? <IoAlertCircle style={{ color: TONE_COLORS.bad }} />
                                        : <IoWarning style={{ color: TONE_COLORS.warning }} />}
                                    <span>{finding.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {findings.length > MAX_ITEMS && (
                        <p className="executive-summary-more">+{findings.length - MAX_ITEMS} more in Detailed Analysis</p>
                    )}
                </div>

                <div className="executive-summary-column">
                    <h3>Strengths</h3>
                    {strengths.length === 0 ? (
                        <p className="executive-summary-empty">No result meets its reference yet, or references are pending.</p>
                    ) : (
                        <ul className="executive-summary-list">
                            {strengths.slice(0, MAX_ITEMS).map((strength, idx) => (
                                <li key={idx}>
                                    <IoArrowUpCircle style={{ color: TONE_COLORS.good }} />
                                    <span>{strength}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    )
}

export default ExecutiveSummaryCard
