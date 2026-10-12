import type { ClinicalResults } from '@/types/clinicalResults.types'
import { MOBILITY_LEVEL_LABELS, MOBILITY_MOVEMENTS, classifyRom, effectiveStatus } from '@/utils/clinicalScoring'
import ReportCard, { ToneText } from './ReportCard'
import type { Tone } from '../reportData'
import './RangeOfMotionCard.css'

const LEVEL_TONE: Record<'POOR' | 'AVERAGE' | 'EXCELLENT', Tone> = { POOR: 'bad', AVERAGE: 'mid', EXCELLENT: 'good' }

function RomCell({ value, item, colSpan }: {
    value: number | null
    item: ClinicalResults['mobility']['items'][keyof ClinicalResults['mobility']['items']]
    colSpan?: number
}) {
    if (value === null) return <td className="rom-muted" colSpan={colSpan}>—</td>
    const c = classifyRom(value, item)
    return (
        <td colSpan={colSpan}>
            {value}&deg;{' '}
            {c.level ? <ToneText tone={LEVEL_TONE[c.level]}>{MOBILITY_LEVEL_LABELS[c.level]}</ToneText> : <span className="rom-muted">Pending ref.</span>}
            {c.excessive && <span className="rom-excessive"> · Excessive</span>}
        </td>
    )
}

/** Box 6 — instrumented ROM by movement and side, against the stored reference. */
function RangeOfMotionCard({ results }: { results: ClinicalResults }) {
    const rows = MOBILITY_MOVEMENTS.filter((m) => {
        const item = results.mobility.items[m.id]
        return item.rightDeg !== null || item.leftDeg !== null || item.valueDeg !== null
    })

    return (
        <ReportCard
            title="6 · Mobility Range"
            subtitle="By movement and side (R = right, L = left)"
            source={results.mobility.source}
            status={effectiveStatus(results, 'mobility')}
            wide
        >
            <div className="rom-table-wrap">
                <table className="rom-table">
                    <thead>
                        <tr>
                            <th>Movement</th>
                            <th>Right</th>
                            <th>Left</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((movement) => {
                            const item = results.mobility.items[movement.id]
                            return (
                                <tr key={movement.id}>
                                    <td>{movement.label}</td>
                                    {movement.bilateral ? (
                                        <>
                                            <RomCell value={item.rightDeg} item={item} />
                                            <RomCell value={item.leftDeg} item={item} />
                                        </>
                                    ) : (
                                        <RomCell value={item.valueDeg} item={item} colSpan={2} />
                                    )}
                                    <td>{item.referenceDeg !== null ? `${item.referenceDeg}°` : <span className="rom-muted">Not available</span>}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <p className="chart-card-note">
                Excellent: within the target range for the test · Average: acceptable functional range, below the reference target ·
                Poor: clearly limited compared with the expected range. Excessive ROM is flagged separately when an upper limit is set.
            </p>
            {results.mobility.notes && <p className="chart-card-note">{results.mobility.notes}</p>}
        </ReportCard>
    )
}

export default RangeOfMotionCard
