import { useState, type ReactNode } from 'react'
import { IoAdd, IoCheckmarkCircleOutline, IoSparkles, IoTrashOutline } from 'react-icons/io5'
import AnalysisFileUpload from '@/components/analysis/AnalysisFileUpload'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import { claudeAPI } from '@/services/api'
import type { UseClinicalResultsFormReturn } from '@/hooks/useClinicalResultsForm'
import {
    RESULT_STATUSES,
    RESULT_STATUS_LABELS,
    type ClinicalSectionKey,
    type ObservationalRating,
    type ResultStatus
} from '@/types/clinicalResults.types'
import {
    CLINICAL_SECTIONS,
    FALL_RISK_LABELS,
    FATIGUE_CRITERIA,
    MOBILITY_LEVEL_LABELS,
    MOBILITY_MOVEMENTS,
    OBSERVATIONAL_RATING_LABELS,
    PREDOMINANCE_LABELS,
    RANGE_POSITION_LABELS,
    bodyFatReference,
    classifyBalanceArea,
    classifyBmi,
    classifyRange,
    classifyRom,
    sectionTitle,
    sideDifference,
    summarizeInertialForce
} from '@/utils/clinicalScoring'
import { inertialPhaseLabels } from '@/components/analysisReport/sportAssets'
import { NumberField, ResultPreview, SelectField, TextField } from './ResultFields'
import './ClinicalResultsSection.css'

const FALL_RISK_OPTIONS = (['LOW', 'MEDIUM', 'HIGH'] as const).map((v) => ({ value: v, label: FALL_RISK_LABELS[v] }))
const PREDOMINANCE_OPTIONS = (['RIGHT', 'LEFT', 'BALANCED'] as const).map((v) => ({ value: v, label: PREDOMINANCE_LABELS[v] }))

interface ClinicalResultsSectionProps {
    form: UseClinicalResultsFormReturn
    /** Patient sex, used to pick the InBody body-fat reference */
    gender?: string | null
    disabled?: boolean
}

function ResultBox({ form, sectionKey, children, disabled }: {
    form: UseClinicalResultsFormReturn
    sectionKey: ClinicalSectionKey
    children: ReactNode
    disabled?: boolean
}) {
    const definition = CLINICAL_SECTIONS.find((s) => s.key === sectionKey)!
    const status = form.results[sectionKey].status
    const needsVerification = status === 'PENDING_VERIFICATION' || form.sectionHasAiFields(sectionKey)

    return (
        <div className={`cr-box ${needsVerification ? 'cr-box-pending' : ''}`}>
            <div className="cr-box-header">
                <h4>
                    {definition.box !== null && <span className="cr-box-number">{definition.box}</span>}
                    {definition.title}
                </h4>
                <div className="cr-box-header-actions">
                    {needsVerification && (
                        <button
                            type="button"
                            className="cr-verify-btn"
                            onClick={() => form.confirmSection(sectionKey)}
                            disabled={disabled}
                            title="Confirm you reviewed the AI-suggested values of this box"
                        >
                            <IoCheckmarkCircleOutline /> Mark as verified
                        </button>
                    )}
                    <select
                        className={`cr-status cr-status-${status.toLowerCase()}`}
                        value={status}
                        disabled={disabled}
                        aria-label={`${definition.title} status`}
                        onChange={(e) => form.setStatus(sectionKey, e.target.value as ResultStatus)}
                    >
                        {RESULT_STATUSES.map((s) => (
                            <option key={s} value={s}>{RESULT_STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                </div>
            </div>

            <TextField form={form} path={`${sectionKey}.source`} label="Source / test" placeholder={definition.defaultSourceHint} disabled={disabled} />

            {children}

            {sectionKey !== 'tensionShortening' && (
                <TextField form={form} path={`${sectionKey}.notes`} label="Notes (optional)" multiline disabled={disabled} />
            )}
        </div>
    )
}

function RatingButtons({ value, onSelect, disabled, criteria }: {
    value: ObservationalRating | null
    onSelect: (rating: ObservationalRating | null) => void
    disabled?: boolean
    criteria: Record<ObservationalRating, string>
}) {
    return (
        <div className="cr-rating-group" role="radiogroup">
            {(['POOR', 'AVERAGE', 'EXCELLENT'] as const).map((rating) => (
                <button
                    key={rating}
                    type="button"
                    role="radio"
                    aria-checked={value === rating}
                    className={`cr-rating cr-rating-${rating.toLowerCase()} ${value === rating ? 'selected' : ''}`}
                    disabled={disabled}
                    onClick={() => onSelect(value === rating ? null : rating)}
                >
                    <strong>{OBSERVATIONAL_RATING_LABELS[rating]}</strong>
                    <span>{criteria[rating]}</span>
                </button>
            ))}
        </div>
    )
}

function AiAutofillPanel({ form, disabled }: { form: UseClinicalResultsFormReturn; disabled?: boolean }) {
    const [files, setFiles] = useState<File[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [summary, setSummary] = useState<{ filledCount: number; sections: ClinicalSectionKey[]; warnings: string[] } | null>(null)

    const handleExtract = async () => {
        setLoading(true)
        setError(null)
        setSummary(null)
        const response = await claudeAPI.extractClinicalResults(files)
        setLoading(false)

        if (!response.success || !response.data) {
            setError(response.error || 'Could not read the reports')
            return
        }

        const applied = form.applyExtraction(response.data)
        setSummary({ ...applied, warnings: response.data.warnings })
        if (applied.filledCount > 0) setFiles([])
    }

    return (
        <div className="cr-ai-panel">
            <div className="cr-ai-panel-text">
                <h4><IoSparkles /> Auto-fill from device reports</h4>
                <p>
                    Upload the BTS, InBody or EMG reports (PDF, images or Excel exports). The AI only transcribes values that are explicitly
                    printed — it never estimates or classifies. Suggested values are marked <strong>AI</strong> and their boxes
                    are set to <em>Pending verification</em> until you review them.
                </p>
            </div>

            <AnalysisFileUpload files={files} onChange={setFiles} disabled={disabled || loading} />

            <button
                type="button"
                className="cr-ai-btn"
                disabled={disabled || loading || files.length === 0}
                onClick={handleExtract}
            >
                {loading ? <ButtonLoadingContent text="Reading reports..." /> : <><IoSparkles /> Auto-fill with AI</>}
            </button>

            {error && <p className="cr-ai-error" role="alert">{error}</p>}

            {summary && (
                <div className="cr-ai-summary" role="status">
                    {summary.filledCount > 0 ? (
                        <p>
                            {summary.filledCount} value(s) suggested in: {summary.sections.map(sectionTitle).join(', ')}.
                            Review each one before saving.
                        </p>
                    ) : (
                        <p>No values matching the form were found in these files. Nothing was changed.</p>
                    )}
                    {summary.warnings.length > 0 && (
                        <ul>
                            {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

function ClinicalResultsSection({ form, gender, disabled }: ClinicalResultsSectionProps) {
    const { results } = form
    const balance = results.balance
    const gait = results.gait
    const composition = results.composition
    const fatRef = bodyFatReference(gender)
    const balanceDiff = sideDifference(balance.rightAreaMm2, balance.leftAreaMm2)
    const inertial = results.inertialForce
    const inertialSummary = summarizeInertialForce(inertial)
    const phaseLabels = inertialPhaseLabels(results.snapshot.sport)
    // Body weight recorded at this evaluation, offered as the mass for F = m × a
    const bodyMassKg = composition.weightKg ?? (results.snapshot.weightLbs !== null ? Math.round(results.snapshot.weightLbs * 0.453592 * 10) / 10 : null)

    return (
        <div className="clinical-results-section">
            <AiAutofillPanel form={form} disabled={disabled} />

            {/* 2 · Explosive Performance */}
            <ResultBox form={form} sectionKey="explosive" disabled={disabled}>
                <div className="cr-grid">
                    <NumberField form={form} path="explosive.cmjHeightCm" label="CMJ height" unit="cm" disabled={disabled} />
                    <NumberField form={form} path="explosive.powerW" label="Power" unit="W" disabled={disabled} />
                    <NumberField form={form} path="explosive.speedMs" label="Speed" unit="m/s" disabled={disabled} />
                    <NumberField form={form} path="explosive.peakForceKn" label="Maximum force" unit="kN" disabled={disabled} />
                </div>
                <ResultPreview>Classification: <strong>Pending reference standards</strong> — reported as a table of measurements only.</ResultPreview>
            </ResultBox>

            {/* 3 · Fatigue / Endurance */}
            <ResultBox form={form} sectionKey="fatigue" disabled={disabled}>
                <p className="cr-help">Evaluator category from the standardized task, processed EMG signal and recorded performance.</p>
                <RatingButtons
                    value={results.fatigue.rating}
                    criteria={FATIGUE_CRITERIA}
                    disabled={disabled}
                    onSelect={(rating) => form.setField('fatigue.rating', rating)}
                />
            </ResultBox>

            {/* 4 · Stability & Balance */}
            <ResultBox form={form} sectionKey="balance" disabled={disabled}>
                <div className="cr-grid">
                    <NumberField form={form} path="balance.durationSec" label="Duration per side" unit="s" disabled={disabled} />
                </div>
                <table className="cr-table">
                    <thead>
                        <tr><th /><th>Right support</th><th>Left support</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th scope="row">Sway area (mm²)</th>
                            <td><NumberField compact form={form} path="balance.rightAreaMm2" ariaLabel="Right sway area (mm²)" disabled={disabled} /></td>
                            <td><NumberField compact form={form} path="balance.leftAreaMm2" ariaLabel="Left sway area (mm²)" disabled={disabled} /></td>
                        </tr>
                        <tr>
                            <th scope="row">Sway path (mm)</th>
                            <td><NumberField compact form={form} path="balance.rightPathMm" ariaLabel="Right sway path (mm)" disabled={disabled} /></td>
                            <td><NumberField compact form={form} path="balance.leftPathMm" ariaLabel="Left sway path (mm)" disabled={disabled} /></td>
                        </tr>
                    </tbody>
                </table>
                <div className="cr-grid">
                    <NumberField form={form} path="balance.referenceP25AreaMm2" label="Reference P25 sway area" unit="mm²" placeholder="Not available" disabled={disabled} />
                    <NumberField form={form} path="balance.referenceP75AreaMm2" label="Reference P75 sway area" unit="mm²" placeholder="Not available" disabled={disabled} />
                </div>
                <ResultPreview>
                    {balanceDiff && balanceDiff.side !== 'EQUAL' && (
                        <div>+{balanceDiff.pct}% sway area on {balanceDiff.side === 'LEFT' ? 'left' : 'right'} support (difference in this trial; it does not mean {balanceDiff.pct}% less balance).</div>
                    )}
                    {(['right', 'left'] as const).map((side) => {
                        const area = side === 'right' ? balance.rightAreaMm2 : balance.leftAreaMm2
                        if (area === null) return null
                        const level = classifyBalanceArea(area, balance.referenceP25AreaMm2, balance.referenceP75AreaMm2)
                        return (
                            <div key={side}>
                                {side === 'right' ? 'Right' : 'Left'} support: <strong>{level ? OBSERVATIONAL_RATING_LABELS[level] : 'Pending reference percentiles'}</strong>
                            </div>
                        )
                    })}
                    {balance.rightAreaMm2 === null && balance.leftAreaMm2 === null && 'Excellent ≤ P25 · Average P25–P75 · Poor > P75 (lower sway = better postural control).'}
                </ResultPreview>
            </ResultBox>

            {/* 5 · Gait Speed */}
            <ResultBox form={form} sectionKey="gait" disabled={disabled}>
                <div className="cr-grid">
                    <NumberField form={form} path="gait.speedMs" label="Gait speed" unit="m/s" disabled={disabled} />
                    <NumberField form={form} path="gait.cadenceStepsMin" label="Cadence" unit="steps/min" disabled={disabled} />
                </div>
                <div className="cr-grid">
                    <NumberField form={form} path="gait.refSpeedMinMs" label="Reference speed min" unit="m/s" disabled={disabled} />
                    <NumberField form={form} path="gait.refSpeedMaxMs" label="Reference speed max" unit="m/s" disabled={disabled} />
                    <NumberField form={form} path="gait.refCadenceMin" label="Reference cadence min" unit="steps/min" disabled={disabled} />
                    <NumberField form={form} path="gait.refCadenceMax" label="Reference cadence max" unit="steps/min" disabled={disabled} />
                </div>
                <p className="cr-help">References are the intervals printed on the report — verify they apply to this protocol and person.</p>
                <ResultPreview>
                    {(() => {
                        const speed = classifyRange(gait.speedMs, gait.refSpeedMinMs, gait.refSpeedMaxMs)
                        const cadence = classifyRange(gait.cadenceStepsMin, gait.refCadenceMin, gait.refCadenceMax)
                        return (
                            <>
                                <div>Speed: <strong>{gait.speedMs === null ? 'Not evaluated' : speed ? RANGE_POSITION_LABELS[speed] : 'Pending reference'}</strong></div>
                                <div>Cadence: <strong>{gait.cadenceStepsMin === null ? 'Not evaluated' : cadence ? RANGE_POSITION_LABELS[cadence] : 'Pending reference'}</strong></div>
                            </>
                        )
                    })()}
                </ResultPreview>
            </ResultBox>

            {/* 6 · Mobility Range */}
            <ResultBox form={form} sectionKey="mobility" disabled={disabled}>
                <p className="cr-help">
                    Excellent ≥ reference · Average between the “clearly limited” threshold and the reference · Poor below that threshold.
                    The threshold is pre-filled at 80% of the reference (provisional) — adjust it if you have a validated value.
                    “Excessive” flags ROM above the upper limit, if one is set.
                </p>
                <div className="cr-table-scroll">
                    <table className="cr-table cr-table-mobility">
                        <thead>
                            <tr>
                                <th>Movement</th>
                                <th>Right (°)</th>
                                <th>Left (°)</th>
                                <th>Reference (°)</th>
                                <th>Clearly limited below (°)</th>
                                <th>Excessive above (°)</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOBILITY_MOVEMENTS.map((movement) => {
                                const item = results.mobility.items[movement.id]
                                const base = `mobility.items.${movement.id}`
                                const values = movement.bilateral
                                    ? [['R', item.rightDeg], ['L', item.leftDeg]] as const
                                    : [['', item.valueDeg]] as const
                                return (
                                    <tr key={movement.id}>
                                        <th scope="row">{movement.label}</th>
                                        {movement.bilateral ? (
                                            <>
                                                <td><NumberField compact form={form} path={`${base}.rightDeg`} ariaLabel={`${movement.label} right`} disabled={disabled} /></td>
                                                <td><NumberField compact form={form} path={`${base}.leftDeg`} ariaLabel={`${movement.label} left`} disabled={disabled} /></td>
                                            </>
                                        ) : (
                                            <td colSpan={2}><NumberField compact form={form} path={`${base}.valueDeg`} ariaLabel={movement.label} disabled={disabled} /></td>
                                        )}
                                        <td><NumberField compact form={form} path={`${base}.referenceDeg`} ariaLabel={`${movement.label} reference`} placeholder="From report" disabled={disabled} /></td>
                                        <td><NumberField compact form={form} path={`${base}.functionalMinDeg`} ariaLabel={`${movement.label} clearly limited threshold`} disabled={disabled} /></td>
                                        <td><NumberField compact form={form} path={`${base}.excessiveLimitDeg`} ariaLabel={`${movement.label} excessive limit`} placeholder="Not set" disabled={disabled} /></td>
                                        <td className="cr-result-cell">
                                            {values.map(([side, v]) => {
                                                if (v === null) return null
                                                const c = classifyRom(v, item)
                                                return (
                                                    <div key={side}>
                                                        {side && `${side}: `}
                                                        <strong>{c.level ? MOBILITY_LEVEL_LABELS[c.level] : 'Pending reference'}</strong>
                                                        {c.excessive && <span className="cr-flag"> · Excessive ROM</span>}
                                                    </div>
                                                )
                                            })}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </ResultBox>

            {/* 7 · Muscle Asymmetry */}
            <ResultBox form={form} sectionKey="asymmetry" disabled={disabled}>
                <p className="cr-help">
                    Records apparent predominance (higher EMG amplitude) for the channels recorded. A Good/Poor rating needs a comparable
                    signal and a task criterion, so none is assigned.
                </p>
                <div className="cr-grid">
                    <SelectField form={form} path="asymmetry.overall" label="Overall apparent predominance" options={PREDOMINANCE_OPTIONS} disabled={disabled} />
                </div>
                {results.asymmetry.muscles.length > 0 && (
                    <div className="cr-table-scroll">
                        <table className="cr-table">
                            <thead>
                                <tr><th>Muscle</th><th>Predominance</th><th>Right</th><th>Left</th><th>Unit</th><th /></tr>
                            </thead>
                            <tbody>
                                {results.asymmetry.muscles.map((muscle, index) => {
                                    const base = `asymmetry.muscles.${index}`
                                    return (
                                        <tr key={index}>
                                            <td>
                                                <input
                                                    className="cr-input"
                                                    value={muscle.muscle}
                                                    placeholder="e.g. Triceps"
                                                    aria-label="Muscle"
                                                    disabled={disabled}
                                                    onChange={(e) => form.setField(`${base}.muscle`, e.target.value)}
                                                />
                                            </td>
                                            <td><SelectField compact form={form} path={`${base}.predominance`} options={PREDOMINANCE_OPTIONS} emptyLabel="—" ariaLabel="Predominance" disabled={disabled} /></td>
                                            <td><NumberField compact form={form} path={`${base}.rightValue`} ariaLabel="Right value" disabled={disabled} /></td>
                                            <td><NumberField compact form={form} path={`${base}.leftValue`} ariaLabel="Left value" disabled={disabled} /></td>
                                            <td>
                                                <input
                                                    className="cr-input cr-input-unit"
                                                    value={muscle.unit ?? ''}
                                                    placeholder="µV"
                                                    aria-label="Unit"
                                                    disabled={disabled}
                                                    onChange={(e) => form.setField(`${base}.unit`, e.target.value === '' ? null : e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <button type="button" className="cr-icon-btn" onClick={() => form.removeMuscle(index)} disabled={disabled} aria-label="Remove muscle">
                                                    <IoTrashOutline />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <button type="button" className="cr-add-btn" onClick={form.addMuscle} disabled={disabled}>
                    <IoAdd /> Add muscle
                </button>
            </ResultBox>

            {/* 8 · Fall Risk */}
            <ResultBox form={form} sectionKey="fallRisk" disabled={disabled}>
                <p className="cr-help">Copy the category reported by the Balance Test — no invented score. It refers to falls, not general injury risk.</p>
                <div className="cr-grid">
                    <SelectField form={form} path="fallRisk.right" label="Right support" options={FALL_RISK_OPTIONS} disabled={disabled} />
                    <SelectField form={form} path="fallRisk.left" label="Left support" options={FALL_RISK_OPTIONS} disabled={disabled} />
                </div>
            </ResultBox>

            {/* 9 · Body Composition – InBody */}
            <ResultBox form={form} sectionKey="composition" disabled={disabled}>
                <div className="cr-grid">
                    <NumberField form={form} path="composition.bodyFatPct" label="Body fat" unit="%" disabled={disabled} />
                    <NumberField form={form} path="composition.skeletalMuscleKg" label="Skeletal muscle (estimated)" unit="kg" disabled={disabled} />
                    <NumberField form={form} path="composition.bmi" label="BMI" unit="kg/m²" disabled={disabled} />
                    <NumberField form={form} path="composition.weightKg" label="Weight" unit="kg" disabled={disabled} />
                </div>
                <ResultPreview>
                    <div>
                        Body fat: <strong>
                            {composition.bodyFatPct === null
                                ? 'Not evaluated'
                                : fatRef
                                    ? `${RANGE_POSITION_LABELS[classifyRange(composition.bodyFatPct, fatRef.min, fatRef.max)!]} (InBody ${gender?.toLowerCase()} ${fatRef.min}–${fatRef.max}%)`
                                    : 'Pending reference (no sex-specific InBody reference for this patient)'}
                        </strong>
                    </div>
                    <div>BMI: <strong>{composition.bmi === null ? 'Not evaluated' : `${classifyBmi(composition.bmi)} (WHO)`}</strong></div>
                    <div>Skeletal muscle: <strong>{composition.skeletalMuscleKg === null ? 'Not evaluated' : 'Reported without rating (no appropriate reference)'}</strong></div>
                </ResultPreview>
            </ResultBox>

            {/* Inertial Force of the sport gesture (report card 9) */}
            <ResultBox form={form} sectionKey="inertialForce" disabled={disabled}>
                <p className="cr-help">
                    For each phase of the {results.snapshot.sport ? `${results.snapshot.sport} ` : ''}gesture, enter the force reported by the device (N).
                    If the device only gives the IMU acceleration, enter it (m/s²) together with the mass used, and the force is calculated as F = m × a.
                    A force entered directly always takes precedence.
                </p>
                <div className="cr-grid">
                    <NumberField form={form} path="inertialForce.massKg" label="Mass used for F = m × a" unit="kg" placeholder="Only for acceleration" disabled={disabled} />
                </div>
                {bodyMassKg !== null && inertial.massKg !== bodyMassKg && (
                    <button type="button" className="cr-add-btn" disabled={disabled} onClick={() => form.setField('inertialForce.massKg', bodyMassKg)}>
                        Use body weight ({bodyMassKg} kg)
                    </button>
                )}
                <table className="cr-table">
                    <thead>
                        <tr><th>Phase</th><th>Force (N)</th><th>or IMU acceleration (m/s²)</th><th>Result</th></tr>
                    </thead>
                    <tbody>
                        {phaseLabels.map((label, index) => {
                            const phase = inertialSummary.phases[index]
                            return (
                                <tr key={label}>
                                    <th scope="row">{label}</th>
                                    <td><NumberField compact form={form} path={`inertialForce.phases.${index}.forceN`} ariaLabel={`${label} force (N)`} disabled={disabled} /></td>
                                    <td><NumberField compact form={form} path={`inertialForce.phases.${index}.accelerationMs2`} ariaLabel={`${label} acceleration (m/s²)`} disabled={disabled} /></td>
                                    <td>
                                        {phase.forceN === null ? '—' : <strong>{phase.forceN} N</strong>}
                                        {phase.method === 'calculated' && <small> · F = m × a</small>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                <ResultPreview>
                    {inertialSummary.missingMass && <div>Enter the mass to convert the accelerations into force.</div>}
                    <div>
                        Peak: <strong>
                            {inertialSummary.peak ? `${inertialSummary.peak.forceN} N (${phaseLabels[inertialSummary.peak.phaseIndex]})` : 'Not evaluated'}
                        </strong>
                    </div>
                    <div>
                        Average: <strong>
                            {inertialSummary.averageN !== null ? `${inertialSummary.averageN} N (${inertialSummary.phasesWithForce} of 4 phases)` : 'Not evaluated'}
                        </strong>
                    </div>
                    <div>Classification: <strong>Pending reference standards</strong></div>
                </ResultPreview>
            </ResultBox>

            {/* Detailed analysis input: only with a specific evaluation */}
            <ResultBox form={form} sectionKey="tensionShortening" disabled={disabled}>
                <TextField
                    form={form}
                    path="tensionShortening.notes"
                    label="Findings"
                    placeholder="Only fill in when a specific tension/shortening evaluation was performed"
                    multiline
                    disabled={disabled}
                />
            </ResultBox>
        </div>
    )
}

export default ClinicalResultsSection
