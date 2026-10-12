import type { FlexibilityExerciseId, FlexibilityRating } from '@/services/api'
import type { FlexibilityAssessmentFormState } from '@/hooks/useFlexibilityAssessmentForm'
import { getEvidencePreviewSrc } from '@/hooks/useFlexibilityAssessmentForm'
import { computeFlexibilityScore, FLEXIBILITY_POINTS } from '@/utils/clinicalScoring'
import FlexibilityExerciseRow, { FlexibilityExercise } from './FlexibilityExerciseRow'
import './FlexibilityAssessmentSection.css'

import ej1Mal from '@/assets/Flexibility_Assessment/physoft_ej1_mal.webp'
import ej1Normal from '@/assets/Flexibility_Assessment/physoft_ej1_normal.webp'
import ej1Bien from '@/assets/Flexibility_Assessment/physoft_ej1_bien.webp'
import ej2Mal from '@/assets/Flexibility_Assessment/physoft_ej2_mal.webp'
import ej2Normal from '@/assets/Flexibility_Assessment/physoft_ej2_normal.webp'
import ej2Bien from '@/assets/Flexibility_Assessment/physoft_ej2_bien.webp'
import ej3Mal from '@/assets/Flexibility_Assessment/physoft_ej3_mal.webp'
import ej3Normal from '@/assets/Flexibility_Assessment/physoft_ej3_normal.webp'
import ej3Bien from '@/assets/Flexibility_Assessment/physoft_ej3_bien.webp'
import ej4Mal from '@/assets/Flexibility_Assessment/physoft_ej4_mal.webp'
import ej4Normal from '@/assets/Flexibility_Assessment/physoft_ej4_normal.webp'
import ej4Bien from '@/assets/Flexibility_Assessment/physoft_ej4_bien.webp'

export const FLEXIBILITY_EXERCISES: FlexibilityExercise[] = [
    {
        id: 'forwardFlexion',
        name: 'Forward Flexion Test',
        description: 'Can the patient touch the floor with straight knees?',
        images: { poor: ej1Mal, average: ej1Normal, excellent: ej1Bien }
    },
    {
        id: 'shoulderMobility',
        name: 'Shoulder Mobility Test',
        description: "Can the patient's hands meet behind the back?",
        images: { poor: ej2Mal, average: ej2Normal, excellent: ej2Bien }
    },
    {
        id: 'butterfly',
        name: 'Butterfly Test',
        description: 'How close are the knees to the floor while sitting?',
        images: { poor: ej3Mal, average: ej3Normal, excellent: ej3Bien }
    },
    {
        id: 'deepSquat',
        name: 'Deep Squat Test',
        description: 'Can the patient perform a full squat while keeping the heels on the ground?',
        images: { poor: ej4Mal, average: ej4Normal, excellent: ej4Bien }
    }
]

interface FlexibilityAssessmentSectionProps {
    items: FlexibilityAssessmentFormState
    onRatingSelect: (exerciseId: FlexibilityExerciseId, rating: FlexibilityRating) => void
    onEvidenceSelect: (exerciseId: FlexibilityExerciseId, file: File) => void
    onEvidenceRemove: (exerciseId: FlexibilityExerciseId) => void
    evidenceBusy?: Partial<Record<FlexibilityExerciseId, boolean>>
    evidenceErrors?: Partial<Record<FlexibilityExerciseId, string | null>>
}

function FlexibilityAssessmentSection({
    items,
    onRatingSelect,
    onEvidenceSelect,
    onEvidenceRemove,
    evidenceBusy,
    evidenceErrors
}: FlexibilityAssessmentSectionProps) {
    const flexScore = computeFlexibilityScore(
        Object.values(items).map((item) => ({ exerciseId: item.exerciseId, rating: item.rating, evidenceUrl: null }))
    )

    return (
        <div className="flexibility-assessment-section">
            {FLEXIBILITY_EXERCISES.map((exercise, index) => {
                const item = items[exercise.id]
                return (
                    <FlexibilityExerciseRow
                        key={exercise.id}
                        index={index + 1}
                        exercise={exercise}
                        rating={item.rating}
                        evidenceFileName={item.evidenceFile?.name ?? null}
                        evidencePreview={getEvidencePreviewSrc(item)}
                        evidenceBusy={evidenceBusy?.[exercise.id]}
                        evidenceError={evidenceErrors?.[exercise.id]}
                        onRatingSelect={(rating) => onRatingSelect(exercise.id, rating)}
                        onEvidenceSelect={(file) => onEvidenceSelect(exercise.id, file)}
                        onEvidenceRemove={() => onEvidenceRemove(exercise.id)}
                    />
                )
            })}

            <div className="flexibility-score-summary" aria-live="polite">
                <div>
                    <span className="flexibility-score-label">Flexibility Score</span>
                    <span className="flexibility-score-formula">
                        (P1 + P2 + P3 + P4) / 4 · Poor {FLEXIBILITY_POINTS.LOW} · Average {FLEXIBILITY_POINTS.MEDIUM} · Excellent {FLEXIBILITY_POINTS.HIGH} · Risk {FLEXIBILITY_POINTS.RISK}*
                    </span>
                </div>
                <span className="flexibility-score-value">
                    {flexScore.score !== null ? `${flexScore.score} / 100` : `Incomplete — ${flexScore.ratedCount}/4 tests rated`}
                </span>
            </div>
            {flexScore.riskExercises.length > 0 && (
                <p className="flexibility-score-warning">
                    * Risk adds no extra points: it keeps the maximum range score and raises a separate warning to review joint control.
                </p>
            )}
        </div>
    )
}

export default FlexibilityAssessmentSection
