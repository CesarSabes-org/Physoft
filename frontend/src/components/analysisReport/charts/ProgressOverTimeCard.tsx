import { formatDate } from '@/utils/date.utils'
import type { ProgressRow } from '../reportData'
import ReportCard from './ReportCard'
import './RangeOfMotionCard.css'

/**
 * Comparable earlier visits only: same variable and unit, same source when
 * both visits record it, and at least a week apart (tests from the same
 * week don't form a progress curve).
 */
function ProgressOverTimeCard({ rows }: { rows: ProgressRow[] }) {
    return (
        <ReportCard title="Progress Over Time" subtitle="Comparable previous visits (same variable, unit and protocol)" wide>
            {rows.length === 0 ? (
                <p className="chart-card-empty">Initial evaluation — follow-up pending</p>
            ) : (
                <div className="rom-table-wrap">
                    <table className="rom-table">
                        <thead>
                            <tr>
                                <th>Variable</th>
                                <th>Previous</th>
                                <th>This evaluation</th>
                                <th>Change vs last</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const previous = row.points.slice(0, -1)
                                const current = row.points[row.points.length - 1]
                                return (
                                    <tr key={row.label}>
                                        <td>{row.label}</td>
                                        <td>
                                            {previous.map((p) => `${p.value} (${formatDate(p.date)})`).join(' → ')}
                                        </td>
                                        <td>{current.value} {row.unit}</td>
                                        <td>{row.change === null ? '—' : `${row.change > 0 ? '+' : ''}${row.change} ${row.unit}`}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </ReportCard>
    )
}

export default ProgressOverTimeCard
