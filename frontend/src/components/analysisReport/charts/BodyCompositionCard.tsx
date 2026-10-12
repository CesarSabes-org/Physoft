import type { ClinicalResults } from '@/types/clinicalResults.types'
import { RANGE_POSITION_LABELS, bodyFatReference, classifyBmi, classifyRange, effectiveStatus, formatValue } from '@/utils/clinicalScoring'
import ReportCard, { ToneText } from './ReportCard'

/**
 * Box 9 — each InBody parameter on its own. Body fat against the InBody
 * reference by sex, BMI by WHO category, skeletal muscle reported without
 * a rating (no appropriate reference).
 */
function BodyCompositionCard({ results, gender }: { results: ClinicalResults; gender: string | null }) {
    const s = results.composition
    const fatRef = bodyFatReference(gender)
    const fat = fatRef ? classifyRange(s.bodyFatPct, fatRef.min, fatRef.max) : null
    const bmiCategory = classifyBmi(s.bmi)

    return (
        <ReportCard title="9 · Body Composition – InBody" subtitle="Each parameter on its own" source={s.source} status={effectiveStatus(results, 'composition')}>
            <dl className="report-kv">
                <div>
                    <dt>Body fat</dt>
                    <dd>
                        {formatValue(s.bodyFatPct, '%')}
                        {s.bodyFatPct !== null && (
                            <small>
                                {fat && fatRef
                                    ? <><ToneText tone={fat === 'WITHIN' ? 'good' : 'bad'}>{RANGE_POSITION_LABELS[fat]}</ToneText> · InBody {gender?.toLowerCase()} {fatRef.min}–{fatRef.max}%</>
                                    : 'Pending reference (sex-specific)'}
                            </small>
                        )}
                    </dd>
                </div>
                <div>
                    <dt>BMI</dt>
                    <dd>
                        {formatValue(s.bmi, 'kg/m²')}
                        {bmiCategory && <small><ToneText tone={bmiCategory === 'Normal weight' ? 'good' : 'bad'}>{bmiCategory}</ToneText> · WHO adult category</small>}
                    </dd>
                </div>
                <div>
                    <dt>Skeletal muscle (estimated)</dt>
                    <dd>
                        {formatValue(s.skeletalMuscleKg, 'kg')}
                        {s.skeletalMuscleKg !== null && <small>Not rated without an appropriate reference</small>}
                    </dd>
                </div>
                <div>
                    <dt>Weight</dt>
                    <dd>{formatValue(s.weightKg, 'kg')}</dd>
                </div>
            </dl>
            {s.notes && <p className="chart-card-note">{s.notes}</p>}
        </ReportCard>
    )
}

export default BodyCompositionCard
