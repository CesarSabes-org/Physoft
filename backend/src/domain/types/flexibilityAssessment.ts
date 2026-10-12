// ============================================
// TYPES - Flexibility Assessment
// ============================================
// The 4 standardized flexibility tests shown in the New/Edit Assessment
// form's "Flexibility Assessment" section. Each exercise stores a
// LOW/MEDIUM/HIGH/RISK rating (the UI shows Poor/Average/Excellent/Risk) and
// an optional evidence photo, persisted as a JSON array on Analysis.flexibilityAssessment.
// RISK = excessive flexibility: scores like HIGH but raises a separate warning.
// ============================================

export const FLEXIBILITY_EXERCISE_IDS = ['forwardFlexion', 'shoulderMobility', 'butterfly', 'deepSquat'] as const
export type FlexibilityExerciseId = typeof FLEXIBILITY_EXERCISE_IDS[number]

export const FLEXIBILITY_RATINGS = ['LOW', 'MEDIUM', 'HIGH', 'RISK'] as const
export type FlexibilityRating = typeof FLEXIBILITY_RATINGS[number]

export interface FlexibilityAssessmentItem {
    exerciseId: FlexibilityExerciseId
    rating: FlexibilityRating | null
    evidenceUrl: string | null
    evidencePublicId: string | null
}

export function isFlexibilityExerciseId(value: unknown): value is FlexibilityExerciseId {
    return typeof value === 'string' && (FLEXIBILITY_EXERCISE_IDS as readonly string[]).includes(value)
}

export function isFlexibilityRating(value: unknown): value is FlexibilityRating {
    return typeof value === 'string' && (FLEXIBILITY_RATINGS as readonly string[]).includes(value)
}

/**
 * Validates and normalizes a flexibilityAssessment payload coming from the
 * client (create/update) or from a previously-stored Json column (read
 * paths for the evidence upload/delete endpoints). Throws on the first
 * invalid entry, matching this controller's existing validation style
 * (e.g. physical capacities range checks).
 */
export function normalizeFlexibilityAssessment(input: unknown): FlexibilityAssessmentItem[] {
    if (input === null || input === undefined) return []
    if (!Array.isArray(input)) {
        throw new Error('flexibilityAssessment must be an array')
    }

    return input.map((raw) => {
        if (!raw || typeof raw !== 'object') {
            throw new Error('Each flexibilityAssessment entry must be an object')
        }
        const { exerciseId, rating, evidenceUrl, evidencePublicId } = raw as Record<string, unknown>

        if (!isFlexibilityExerciseId(exerciseId)) {
            throw new Error(`Invalid flexibility exerciseId: ${String(exerciseId)}`)
        }
        if (rating !== null && rating !== undefined && !isFlexibilityRating(rating)) {
            throw new Error(`Invalid flexibility rating for ${exerciseId}: ${String(rating)}`)
        }

        return {
            exerciseId,
            rating: (rating as FlexibilityRating | null | undefined) ?? null,
            evidenceUrl: typeof evidenceUrl === 'string' ? evidenceUrl : null,
            evidencePublicId: typeof evidencePublicId === 'string' ? evidencePublicId : null
        }
    })
}
