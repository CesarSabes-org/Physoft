// ============================================
// TYPES: Clinical Results (report boxes 2-9)
// ============================================
// Mirrors backend/src/domain/types/clinicalResults.ts. Raw values, sources
// and the reference values used are stored; classifications are derived
// in utils/clinicalScoring.ts. A missing value is always null, never 0.
// ============================================

export const RESULT_STATUSES = ['NOT_EVALUATED', 'EVALUATED', 'NOT_INTERPRETABLE', 'PENDING_VERIFICATION'] as const
export type ResultStatus = typeof RESULT_STATUSES[number]

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
    NOT_EVALUATED: 'Not evaluated',
    EVALUATED: 'Evaluated',
    NOT_INTERPRETABLE: 'Not interpretable',
    PENDING_VERIFICATION: 'Pending verification'
}

export type ObservationalRating = 'POOR' | 'AVERAGE' | 'EXCELLENT'
export type FallRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type Predominance = 'RIGHT' | 'LEFT' | 'BALANCED'
export type DominantSide = 'RIGHT' | 'LEFT' | 'AMBIDEXTROUS'

export const MOBILITY_MOVEMENT_IDS = [
    'shoulderInternalRotation',
    'shoulderExternalRotation',
    'shoulderFlexion',
    'trunkFlexion',
    'trunkExtension',
    'trunkRotation',
    'trunkLateralFlexion'
] as const
export type MobilityMovementId = typeof MOBILITY_MOVEMENT_IDS[number]

interface SectionBase {
    status: ResultStatus
    source: string | null
    notes: string | null
}

export interface ExplosiveResults extends SectionBase {
    cmjHeightCm: number | null
    powerW: number | null
    speedMs: number | null
    peakForceKn: number | null
}

export interface FatigueResults extends SectionBase {
    rating: ObservationalRating | null
}

export interface BalanceResults extends SectionBase {
    durationSec: number | null
    rightAreaMm2: number | null
    leftAreaMm2: number | null
    rightPathMm: number | null
    leftPathMm: number | null
    referenceP25AreaMm2: number | null
    referenceP75AreaMm2: number | null
}

export interface GaitResults extends SectionBase {
    speedMs: number | null
    cadenceStepsMin: number | null
    refSpeedMinMs: number | null
    refSpeedMaxMs: number | null
    refCadenceMin: number | null
    refCadenceMax: number | null
}

export interface MobilityItem {
    rightDeg: number | null
    leftDeg: number | null
    valueDeg: number | null
    referenceDeg: number | null
    functionalMinDeg: number | null
    excessiveLimitDeg: number | null
}

export interface MobilityResults extends SectionBase {
    items: Record<MobilityMovementId, MobilityItem>
}

export interface AsymmetryMuscle {
    muscle: string
    predominance: Predominance | null
    rightValue: number | null
    leftValue: number | null
    unit: string | null
}

export interface AsymmetryResults extends SectionBase {
    overall: Predominance | null
    muscles: AsymmetryMuscle[]
}

export interface FallRiskResults extends SectionBase {
    right: FallRiskLevel | null
    left: FallRiskLevel | null
}

export interface CompositionResults extends SectionBase {
    bodyFatPct: number | null
    skeletalMuscleKg: number | null
    bmi: number | null
    weightKg: number | null
}

export type TensionShorteningResults = SectionBase

/** One phase of the sport gesture: the device's force, or the IMU acceleration to compute F = m × a */
export interface InertialForcePhase {
    forceN: number | null
    accelerationMs2: number | null
}

export interface InertialForceResults extends SectionBase {
    /** Mass used for F = m × a (body, segment or implement — the evaluator states which in the notes) */
    massKg: number | null
    /** Always 4 phases; labels come from the assessment sport */
    phases: InertialForcePhase[]
}

export interface PatientSnapshot {
    weightLbs: number | null
    heightFt: number | null
    somatotype: string | null
    dominantSide: DominantSide | null
    /** Sport evaluated in this assessment (selects the report illustration) */
    sport: string | null
}

export interface ClinicalResults {
    version: 1
    snapshot: PatientSnapshot
    explosive: ExplosiveResults
    fatigue: FatigueResults
    balance: BalanceResults
    gait: GaitResults
    mobility: MobilityResults
    asymmetry: AsymmetryResults
    fallRisk: FallRiskResults
    composition: CompositionResults
    inertialForce: InertialForceResults
    tensionShortening: TensionShorteningResults
    /** Dotted field paths filled by AI extraction and not modified afterwards by the evaluator */
    aiExtractedFields: string[]
}

export type ClinicalSectionKey = Exclude<keyof ClinicalResults, 'version' | 'snapshot' | 'aiExtractedFields'>

/** Response of POST /claude/extract-clinical-results */
export interface ClinicalExtractionResult {
    values: Record<string, number | string>
    sources: Partial<Record<ClinicalSectionKey, string>>
    muscles: AsymmetryMuscle[]
    warnings: string[]
    tokensUsed: number
}
