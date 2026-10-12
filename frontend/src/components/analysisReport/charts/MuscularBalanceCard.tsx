import type { ClinicalResults } from '@/types/clinicalResults.types'
import { PREDOMINANCE_LABELS, effectiveStatus } from '@/utils/clinicalScoring'
import ReportCard from './ReportCard'
import './MuscularBalanceCard.css'

/**
 * Box 7 detail — per-muscle EMG, limited to the channels recorded. Shows
 * apparent predominance only: a Good/Poor rating needs a comparable signal
 * and a task criterion.
 */
function MuscularBalanceCard({ results }: { results: ClinicalResults }) {
    const s = results.asymmetry

    return (
        <ReportCard title="7 · Muscle Asymmetry (EMG)" subtitle="Bilateral EMG of the recorded muscles" source={s.source} status={effectiveStatus(results, 'asymmetry')}>
            {s.overall && (
                <p className="muscular-balance-overall">Overall: <strong>{PREDOMINANCE_LABELS[s.overall]}</strong></p>
            )}

            {s.muscles.length > 0 && (
                <div className="muscular-balance-list">
                    {s.muscles.map((m, index) => {
                        const total = (m.rightValue ?? 0) + (m.leftValue ?? 0)
                        const rightShare = m.rightValue !== null && m.leftValue !== null && total > 0 ? (m.rightValue / total) * 100 : null
                        return (
                            <div key={`${m.muscle}-${index}`} className="muscular-balance-row">
                                <span className="muscular-balance-label">{m.muscle || 'Unnamed muscle'}</span>
                                {rightShare !== null ? (
                                    <div className="muscular-balance-split" title={`Right ${m.rightValue}${m.unit ? ' ' + m.unit : ''} · Left ${m.leftValue}${m.unit ? ' ' + m.unit : ''}`}>
                                        <div className="muscular-balance-split-right" style={{ width: `${rightShare}%` }} />
                                        <div className="muscular-balance-split-left" style={{ width: `${100 - rightShare}%` }} />
                                    </div>
                                ) : (
                                    <span className="muscular-balance-novalues">No comparable values</span>
                                )}
                                <span className="muscular-balance-value">{m.predominance ? PREDOMINANCE_LABELS[m.predominance] : '—'}</span>
                            </div>
                        )
                    })}
                    <div className="muscular-balance-legend">
                        <span><i className="muscular-balance-dot-right" /> Right</span>
                        <span><i className="muscular-balance-dot-left" /> Left</span>
                        <span>Share of total EMG amplitude</span>
                    </div>
                </div>
            )}

            <p className="chart-card-note">Apparent predominance (higher EMG amplitude). Not rated Good/Poor without a comparable signal and task criterion.</p>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

export default MuscularBalanceCard
