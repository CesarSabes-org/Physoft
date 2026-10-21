// ============================================
// TYPES - Clinical Results (report boxes 2-9)
// ============================================
// Measured / observed results captured in the New/Edit Assessment form
// (manually, or pre-filled by AI extraction and reviewed by the evaluator),
// persisted as one JSON object on Analysis.clinicalResults.
//
// Only raw values, their source and the reference values used are stored.
// Classifications are derived from these with reproducible rules on the
// client (frontend/src/utils/clinicalScoring.ts), never stored or invented.
// A missing value is always null — never 0.
// ============================================

export class ClinicalResultsValidationError extends Error {}

export const RESULT_STATUSES = ['NOT_EVALUATED', 'EVALUATED', 'NOT_INTERPRETABLE', 'PENDING_VERIFICATION'] as const
export type ResultStatus = typeof RESULT_STATUSES[number]

// Evaluator's observational category (Fatigue / Endurance)
export const OBSERVATIONAL_RATINGS = ['POOR', 'AVERAGE', 'EXCELLENT'] as const
export type ObservationalRating = typeof OBSERVATIONAL_RATINGS[number]

// Category reported by the BTS Balance Test, copied as-is (never computed)
export const FALL_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const
export type FallRiskLevel = typeof FALL_RISK_LEVELS[number]

export const PREDOMINANCE_VALUES = ['RIGHT', 'LEFT', 'BALANCED'] as const
export type Predominance = typeof PREDOMINANCE_VALUES[number]

export const DOMINANT_SIDES = ['RIGHT', 'LEFT', 'AMBIDEXTROUS'] as const
export type DominantSide = typeof DOMINANT_SIDES[number]

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

/** One phase of the sport gesture: the device's force, or the IMU acceleration for F = m × a */
export interface InertialForcePhase {
    forceN: number | null
    accelerationMs2: number | null
}

export interface InertialForceResults extends SectionBase {
    /** Mass used for F = m × a, kg */
    massKg: number | null
    /** Always INERTIAL_PHASE_COUNT phases, in gesture order */
    phases: InertialForcePhase[]
}

export const INERTIAL_PHASE_COUNT = 4

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
    /** Evaluator's free-text clinical notes / detected conditions */
    clinicalNotes: string | null
    /** Dotted field paths filled by AI extraction and not modified afterwards by the evaluator */
    aiExtractedFields: string[]
}

const MAX_TEXT_LENGTH = 5000
const MAX_SHORT_TEXT_LENGTH = 200
const MAX_MUSCLES = 30
const MAX_AI_FIELDS = 300

type Raw = Record<string, unknown>

function asObject(value: unknown, path: string): Raw {
    if (value === null || value === undefined) return {}
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new ClinicalResultsValidationError(`${path} must be an object`)
    }
    return value as Raw
}

function num(value: unknown, path: string): number | null {
    if (value === null || value === undefined || value === '') return null
    const parsed = typeof value === 'string' ? Number(value) : value
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
        throw new ClinicalResultsValidationError(`${path} must be a number`)
    }
    if (parsed < 0) {
        throw new ClinicalResultsValidationError(`${path} cannot be negative`)
    }
    return parsed
}

function text(value: unknown, path: string, maxLength = MAX_TEXT_LENGTH): string | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'string') {
        throw new ClinicalResultsValidationError(`${path} must be text`)
    }
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    if (trimmed.length > maxLength) {
        throw new ClinicalResultsValidationError(`${path} is too long (max ${maxLength} characters)`)
    }
    return trimmed
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, path: string): T | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
        throw new ClinicalResultsValidationError(`${path} must be one of: ${allowed.join(', ')}`)
    }
    return value as T
}

function sectionBase(raw: Raw, path: string): SectionBase {
    return {
        status: oneOf(RESULT_STATUSES, raw.status, `${path}.status`) ?? 'NOT_EVALUATED',
        source: text(raw.source, `${path}.source`, MAX_SHORT_TEXT_LENGTH),
        notes: text(raw.notes, `${path}.notes`)
    }
}

function normalizeMobilityItem(value: unknown, path: string): MobilityItem {
    const raw = asObject(value, path)
    return {
        rightDeg: num(raw.rightDeg, `${path}.rightDeg`),
        leftDeg: num(raw.leftDeg, `${path}.leftDeg`),
        valueDeg: num(raw.valueDeg, `${path}.valueDeg`),
        referenceDeg: num(raw.referenceDeg, `${path}.referenceDeg`),
        functionalMinDeg: num(raw.functionalMinDeg, `${path}.functionalMinDeg`),
        excessiveLimitDeg: num(raw.excessiveLimitDeg, `${path}.excessiveLimitDeg`)
    }
}

function normalizeMuscles(value: unknown): AsymmetryMuscle[] {
    if (value === null || value === undefined) return []
    if (!Array.isArray(value)) {
        throw new ClinicalResultsValidationError('asymmetry.muscles must be an array')
    }
    if (value.length > MAX_MUSCLES) {
        throw new ClinicalResultsValidationError(`asymmetry.muscles allows at most ${MAX_MUSCLES} entries`)
    }
    return value
        .map((entry, index) => {
            const path = `asymmetry.muscles.${index}`
            const raw = asObject(entry, path)
            return {
                muscle: text(raw.muscle, `${path}.muscle`, MAX_SHORT_TEXT_LENGTH) ?? '',
                predominance: oneOf(PREDOMINANCE_VALUES, raw.predominance, `${path}.predominance`),
                rightValue: num(raw.rightValue, `${path}.rightValue`),
                leftValue: num(raw.leftValue, `${path}.leftValue`),
                unit: text(raw.unit, `${path}.unit`, 40)
            }
        })
        // A row with no muscle name and no data is an empty form row, not a result
        .filter((m) => m.muscle !== '' || m.rightValue !== null || m.leftValue !== null || m.predominance !== null)
}

function normalizeInertialPhases(value: unknown): InertialForcePhase[] {
    if (value !== null && value !== undefined && !Array.isArray(value)) {
        throw new ClinicalResultsValidationError('inertialForce.phases must be an array')
    }
    const list = Array.isArray(value) ? value : []
    // Always exactly INERTIAL_PHASE_COUNT phases: missing ones are empty, extra ones dropped
    return Array.from({ length: INERTIAL_PHASE_COUNT }, (_, index) => {
        const raw = asObject(list[index], `inertialForce.phases.${index}`)
        return {
            forceN: num(raw.forceN, `inertialForce.phases.${index}.forceN`),
            accelerationMs2: num(raw.accelerationMs2, `inertialForce.phases.${index}.accelerationMs2`)
        }
    })
}

function normalizeAiFields(value: unknown): string[] {
    if (value === null || value === undefined) return []
    if (!Array.isArray(value)) {
        throw new ClinicalResultsValidationError('aiExtractedFields must be an array')
    }
    return value
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0 && entry.length <= 100)
        .slice(0, MAX_AI_FIELDS)
}

/**
 * Validates and normalizes a clinicalResults payload (create/update body,
 * JSON string over multipart or a plain object). Unknown keys are dropped,
 * missing values become null. Throws ClinicalResultsValidationError (→ HTTP 400).
 */
export function normalizeClinicalResults(input: unknown): ClinicalResults {
    let parsed: unknown = input
    if (typeof input === 'string') {
        try {
            parsed = JSON.parse(input)
        } catch {
            throw new ClinicalResultsValidationError('clinicalResults is not valid JSON')
        }
    }
    const root = asObject(parsed, 'clinicalResults')

    const snapshot = asObject(root.snapshot, 'snapshot')
    const explosive = asObject(root.explosive, 'explosive')
    const fatigue = asObject(root.fatigue, 'fatigue')
    const balance = asObject(root.balance, 'balance')
    const gait = asObject(root.gait, 'gait')
    const mobility = asObject(root.mobility, 'mobility')
    const mobilityItems = asObject(mobility.items, 'mobility.items')
    const asymmetry = asObject(root.asymmetry, 'asymmetry')
    const fallRisk = asObject(root.fallRisk, 'fallRisk')
    const composition = asObject(root.composition, 'composition')
    const inertialForce = asObject(root.inertialForce, 'inertialForce')
    const tensionShortening = asObject(root.tensionShortening, 'tensionShortening')

    return {
        version: 1,
        snapshot: {
            weightLbs: num(snapshot.weightLbs, 'snapshot.weightLbs'),
            heightFt: num(snapshot.heightFt, 'snapshot.heightFt'),
            somatotype: text(snapshot.somatotype, 'snapshot.somatotype', 40),
            dominantSide: oneOf(DOMINANT_SIDES, snapshot.dominantSide, 'snapshot.dominantSide'),
            sport: text(snapshot.sport, 'snapshot.sport', 60)
        },
        explosive: {
            ...sectionBase(explosive, 'explosive'),
            cmjHeightCm: num(explosive.cmjHeightCm, 'explosive.cmjHeightCm'),
            powerW: num(explosive.powerW, 'explosive.powerW'),
            speedMs: num(explosive.speedMs, 'explosive.speedMs'),
            peakForceKn: num(explosive.peakForceKn, 'explosive.peakForceKn')
        },
        fatigue: {
            ...sectionBase(fatigue, 'fatigue'),
            rating: oneOf(OBSERVATIONAL_RATINGS, fatigue.rating, 'fatigue.rating')
        },
        balance: {
            ...sectionBase(balance, 'balance'),
            durationSec: num(balance.durationSec, 'balance.durationSec'),
            rightAreaMm2: num(balance.rightAreaMm2, 'balance.rightAreaMm2'),
            leftAreaMm2: num(balance.leftAreaMm2, 'balance.leftAreaMm2'),
            rightPathMm: num(balance.rightPathMm, 'balance.rightPathMm'),
            leftPathMm: num(balance.leftPathMm, 'balance.leftPathMm'),
            referenceP25AreaMm2: num(balance.referenceP25AreaMm2, 'balance.referenceP25AreaMm2'),
            referenceP75AreaMm2: num(balance.referenceP75AreaMm2, 'balance.referenceP75AreaMm2')
        },
        gait: {
            ...sectionBase(gait, 'gait'),
            speedMs: num(gait.speedMs, 'gait.speedMs'),
            cadenceStepsMin: num(gait.cadenceStepsMin, 'gait.cadenceStepsMin'),
            refSpeedMinMs: num(gait.refSpeedMinMs, 'gait.refSpeedMinMs'),
            refSpeedMaxMs: num(gait.refSpeedMaxMs, 'gait.refSpeedMaxMs'),
            refCadenceMin: num(gait.refCadenceMin, 'gait.refCadenceMin'),
            refCadenceMax: num(gait.refCadenceMax, 'gait.refCadenceMax')
        },
        mobility: {
            ...sectionBase(mobility, 'mobility'),
            items: Object.fromEntries(
                MOBILITY_MOVEMENT_IDS.map((id) => [id, normalizeMobilityItem(mobilityItems[id], `mobility.items.${id}`)])
            ) as Record<MobilityMovementId, MobilityItem>
        },
        asymmetry: {
            ...sectionBase(asymmetry, 'asymmetry'),
            overall: oneOf(PREDOMINANCE_VALUES, asymmetry.overall, 'asymmetry.overall'),
            muscles: normalizeMuscles(asymmetry.muscles)
        },
        fallRisk: {
            ...sectionBase(fallRisk, 'fallRisk'),
            right: oneOf(FALL_RISK_LEVELS, fallRisk.right, 'fallRisk.right'),
            left: oneOf(FALL_RISK_LEVELS, fallRisk.left, 'fallRisk.left')
        },
        composition: {
            ...sectionBase(composition, 'composition'),
            bodyFatPct: num(composition.bodyFatPct, 'composition.bodyFatPct'),
            skeletalMuscleKg: num(composition.skeletalMuscleKg, 'composition.skeletalMuscleKg'),
            bmi: num(composition.bmi, 'composition.bmi'),
            weightKg: num(composition.weightKg, 'composition.weightKg')
        },
        inertialForce: {
            ...sectionBase(inertialForce, 'inertialForce'),
            massKg: num(inertialForce.massKg, 'inertialForce.massKg'),
            phases: normalizeInertialPhases(inertialForce.phases)
        },
        tensionShortening: sectionBase(tensionShortening, 'tensionShortening'),
        clinicalNotes: text(root.clinicalNotes, 'clinicalNotes', MAX_TEXT_LENGTH),
        aiExtractedFields: normalizeAiFields(root.aiExtractedFields)
    }
}
