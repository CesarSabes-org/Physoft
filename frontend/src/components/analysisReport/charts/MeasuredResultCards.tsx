import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ClinicalResults } from '@/types/clinicalResults.types'
import {
    FALL_RISK_LABELS,
    FATIGUE_CRITERIA,
    FATIGUE_SUMMARY_LABEL,
    OBSERVATIONAL_RATING_LABELS,
    RANGE_POSITION_LABELS,
    classifyBalanceArea,
    classifyRange,
    effectiveStatus,
    formatValue,
    sideDifference
} from '@/utils/clinicalScoring'
import ReportCard, { TONE_COLORS, ToneText } from './ReportCard'
import type { Tone } from '../reportData'

const RATING_TONE: Record<'POOR' | 'AVERAGE' | 'EXCELLENT', Tone> = { POOR: 'bad', AVERAGE: 'mid', EXCELLENT: 'good' }

function rangeTone(position: 'BELOW' | 'WITHIN' | 'ABOVE' | null): Tone {
    return position === 'WITHIN' ? 'good' : position === null ? 'neutral' : 'bad'
}

/** Box 2 — measurements only; no classification until reference standards exist. */
export function ExplosivePerformanceCard({ results }: { results: ClinicalResults }) {
    const s = results.explosive
    return (
        <ReportCard title="2 · Explosive Performance" subtitle="Countermovement Jump (CMJ)" source={s.source} status={effectiveStatus(results, 'explosive')}>
            <dl className="report-kv">
                <div><dt>Height</dt><dd>{formatValue(s.cmjHeightCm, 'cm')}</dd></div>
                <div><dt>Power</dt><dd>{formatValue(s.powerW, 'W')}</dd></div>
                <div><dt>Speed</dt><dd>{formatValue(s.speedMs, 'm/s')}</dd></div>
                <div><dt>Maximum force</dt><dd>{formatValue(s.peakForceKn, 'kN')}</dd></div>
            </dl>
            <p className="chart-card-note">Classification: <strong>Pending reference standards</strong>.</p>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

/** Box 3 — evaluator category from task + processed EMG + recorded performance. */
export function FatigueCard({ results }: { results: ClinicalResults }) {
    const s = results.fatigue
    return (
        <ReportCard title="3 · Fatigue / Endurance" subtitle="Standardized task, processed EMG and recorded performance" source={s.source} status={effectiveStatus(results, 'fatigue')}>
            {s.rating && (
                <>
                    <div className="report-rating-row">
                        {(['POOR', 'AVERAGE', 'EXCELLENT'] as const).map((rating) => (
                            <div
                                key={rating}
                                className={`report-rating-pill ${s.rating === rating ? 'active' : ''}`}
                                style={s.rating === rating ? { borderColor: TONE_COLORS[RATING_TONE[rating]], color: TONE_COLORS[RATING_TONE[rating]] } : undefined}
                            >
                                <strong>{OBSERVATIONAL_RATING_LABELS[rating]}</strong>
                                <span>{FATIGUE_SUMMARY_LABEL[rating]}</span>
                            </div>
                        ))}
                    </div>
                    <p className="chart-card-note">{FATIGUE_CRITERIA[s.rating]}</p>
                </>
            )}
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

function BalanceTooltip({ active, payload, label }: any) {
    if (!active || !payload || payload.length === 0) return null
    return (
        <div className="chart-card-tooltip">
            <div style={{ fontWeight: 700 }}>{label}</div>
            <div>{payload[0].value} mm²</div>
        </div>
    )
}

/** Box 4 — single-leg stance sway; categories only with reference percentiles. */
export function BalanceCard({ results }: { results: ClinicalResults }) {
    const s = results.balance
    const diff = sideDifference(s.rightAreaMm2, s.leftAreaMm2)
    const chartData = [
        { side: 'Right', value: s.rightAreaMm2 },
        { side: 'Left', value: s.leftAreaMm2 }
    ].filter((d): d is { side: string; value: number } => d.value !== null)

    return (
        <ReportCard
            title="4 · Stability & Balance"
            subtitle={`Single-leg stance, eyes open${s.durationSec !== null ? `, ${s.durationSec} s per side` : ''}`}
            source={s.source}
            status={effectiveStatus(results, 'balance')}
        >
            {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border-color)" strokeOpacity={0.5} />
                        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} unit=" mm²" />
                        <YAxis type="category" dataKey="side" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} width={44} />
                        <Tooltip content={<BalanceTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Bar dataKey="value" name="Sway area" radius={[0, 4, 4, 0]} barSize={22}>
                            {chartData.map((entry) => (
                                <Cell key={entry.side} fill={entry.side === 'Right' ? '#14b8a6' : '#3b82f6'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}

            <dl className="report-kv">
                {(['right', 'left'] as const).map((side) => {
                    const area = side === 'right' ? s.rightAreaMm2 : s.leftAreaMm2
                    const path = side === 'right' ? s.rightPathMm : s.leftPathMm
                    const level = classifyBalanceArea(area, s.referenceP25AreaMm2, s.referenceP75AreaMm2)
                    return (
                        <div key={side}>
                            <dt>{side === 'right' ? 'Right' : 'Left'} support</dt>
                            <dd>
                                {area !== null ? `${area} mm²` : 'Not evaluated'}
                                <small>
                                    {path !== null ? `Sway path ${path} mm · ` : ''}
                                    {area === null ? '' : level ? <ToneText tone={RATING_TONE[level]}>{OBSERVATIONAL_RATING_LABELS[level]}</ToneText> : 'Pending reference percentiles'}
                                </small>
                            </dd>
                        </div>
                    )
                })}
            </dl>

            {diff && diff.side !== 'EQUAL' && (
                <p className="chart-card-note">
                    <strong>+{diff.pct}%</strong> sway area on {diff.side === 'LEFT' ? 'left' : 'right'} support. Difference in this trial; it does not mean {diff.pct}% less balance.
                </p>
            )}
            <p className="chart-card-note">Lower sway generally indicates better postural control. Excellent ≤ P25 · Average P25–P75 · Poor &gt; P75 of the reference.</p>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

/** Box 5 — below / within / above the applicable reference interval. */
export function GaitSpeedCard({ results }: { results: ClinicalResults }) {
    const s = results.gait
    const speed = classifyRange(s.speedMs, s.refSpeedMinMs, s.refSpeedMaxMs)
    const cadence = classifyRange(s.cadenceStepsMin, s.refCadenceMin, s.refCadenceMax)
    const anyBelow = speed === 'BELOW' || cadence === 'BELOW'

    return (
        <ReportCard title="5 · Gait Speed" subtitle="Walk test" source={s.source} status={effectiveStatus(results, 'gait')}>
            <dl className="report-kv">
                <div>
                    <dt>Speed</dt>
                    <dd>
                        {formatValue(s.speedMs, 'm/s')}
                        {s.speedMs !== null && (
                            <small>
                                {speed ? <ToneText tone={rangeTone(speed)}>{RANGE_POSITION_LABELS[speed]}</ToneText> : 'Pending reference'}
                                {s.refSpeedMinMs !== null && s.refSpeedMaxMs !== null && ` · ref. ${s.refSpeedMinMs}–${s.refSpeedMaxMs} m/s`}
                            </small>
                        )}
                    </dd>
                </div>
                <div>
                    <dt>Cadence</dt>
                    <dd>
                        {formatValue(s.cadenceStepsMin, 'steps/min')}
                        {s.cadenceStepsMin !== null && (
                            <small>
                                {cadence ? <ToneText tone={rangeTone(cadence)}>{RANGE_POSITION_LABELS[cadence]}</ToneText> : 'Pending reference'}
                                {s.refCadenceMin !== null && s.refCadenceMax !== null && ` · ref. ${s.refCadenceMin}–${s.refCadenceMax} steps/min`}
                            </small>
                        )}
                    </dd>
                </div>
            </dl>
            <p className="chart-card-note">
                References are the intervals printed on the report and must be verified for the protocol and the person.
                {anyBelow && ' Verify that the recording is representative.'}
            </p>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

/** Box 8 — category copied from the Balance Test; no invented score. */
export function FallRiskCard({ results }: { results: ClinicalResults }) {
    const s = results.fallRisk
    const tone = (level: 'LOW' | 'MEDIUM' | 'HIGH'): Tone => (level === 'HIGH' ? 'bad' : level === 'MEDIUM' ? 'mid' : 'good')

    return (
        <ReportCard title="8 · Fall Risk" subtitle="Balance Test classification" source={s.source} status={effectiveStatus(results, 'fallRisk')}>
            <dl className="report-kv">
                <div><dt>Right support</dt><dd>{s.right ? <ToneText tone={tone(s.right)}>{FALL_RISK_LABELS[s.right]}</ToneText> : 'Not evaluated'}</dd></div>
                <div><dt>Left support</dt><dd>{s.left ? <ToneText tone={tone(s.left)}>{FALL_RISK_LABELS[s.left]}</ToneText> : 'Not evaluated'}</dd></div>
            </dl>
            <p className="chart-card-note">Copied from the device. It refers to falls, not to general injury risk.</p>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}
