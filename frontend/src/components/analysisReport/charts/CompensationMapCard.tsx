import { IoAlertCircleOutline, IoWarningOutline } from 'react-icons/io5'
import type { CompensationRegion } from '@/utils/clinicalScoring'
import ReportCard, { TONE_COLORS } from './ReportCard'
import './CompensationMapCard.css'

/**
 * Movement Compensation Map — only regions with a measured limitation or a
 * detected stability difference appear, each with the evidence behind it.
 * Clinical orientation only; not a direct pressure or load map.
 */
function CompensationMapCard({ regions }: { regions: CompensationRegion[] }) {
    return (
        <ReportCard title="Movement Compensation Map" subtitle="Regions with measured limitations or stability differences">
            {regions.length === 0 ? (
                <p className="chart-card-empty">No measured limitations or stability differences recorded</p>
            ) : (
                <ul className="compensation-list">
                    {regions.map((region) => {
                        const color = region.level === 'limitation' ? TONE_COLORS.bad : TONE_COLORS.warning
                        return (
                            <li key={region.id} style={{ borderLeftColor: color }}>
                                <div className="compensation-title">
                                    {region.level === 'limitation'
                                        ? <IoAlertCircleOutline style={{ color }} />
                                        : <IoWarningOutline style={{ color }} />}
                                    <strong>{region.label}</strong>
                                    <span style={{ color }}>{region.level === 'limitation' ? 'Measured limitation' : 'Higher demand / warning'}</span>
                                </div>
                                <ul>
                                    {region.evidence.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </li>
                        )
                    })}
                </ul>
            )}
            <p className="chart-card-note">Clinical orientation estimate. It does not represent a direct pressure or load map.</p>
        </ReportCard>
    )
}

export default CompensationMapCard
