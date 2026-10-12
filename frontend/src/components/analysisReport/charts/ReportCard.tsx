import type { ReactNode } from 'react'
import { RESULT_STATUS_LABELS, type ResultStatus } from '@/types/clinicalResults.types'
import type { Tone } from '../reportData'
import './ChartCard.css'

export const TONE_COLORS: Record<Tone, string> = {
    good: '#22c55e',
    mid: '#f59e0b',
    bad: '#ef4444',
    warning: '#a855f7',
    neutral: '#14b8a6',
    muted: '#737373'
}

export function StatusTag({ status }: { status: ResultStatus }) {
    if (status === 'EVALUATED') return null
    return <span className={`report-status-tag report-status-${status.toLowerCase()}`}>{RESULT_STATUS_LABELS[status]}</span>
}

export function ToneText({ tone, children }: { tone: Tone; children: ReactNode }) {
    return <strong style={{ color: TONE_COLORS[tone] }}>{children}</strong>
}

interface ReportCardProps {
    title: string
    subtitle?: string
    source?: string | null
    status?: ResultStatus
    wide?: boolean
    children: ReactNode
}

/** Shared wrapper for the report's result cards: title, status tag and source line. */
function ReportCard({ title, subtitle, source, status, wide, children }: ReportCardProps) {
    const notEvaluated = status === 'NOT_EVALUATED'

    return (
        <div className={`chart-card ${wide ? 'chart-card-wide' : ''}`}>
            <div className="chart-card-header">
                <div className="chart-card-title-row">
                    <h3>{title}</h3>
                    {status && <StatusTag status={status} />}
                </div>
                {subtitle && <p>{subtitle}</p>}
            </div>

            {notEvaluated ? <p className="chart-card-empty">Not evaluated</p> : children}

            {source && !notEvaluated && (
                <div className="chart-card-footer">
                    <span className="chart-card-footer-label">Source</span>
                    <span className="chart-card-source">{source}</span>
                </div>
            )}
        </div>
    )
}

export default ReportCard
