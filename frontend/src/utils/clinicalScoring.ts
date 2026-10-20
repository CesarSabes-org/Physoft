// ============================================
// UTILS: Clinical scoring rules
// ============================================
// Every calculation and classification shown in the assessment report
// lives here as a pure, reproducible rule ("Physoft - Fuentes y criterios
// de calificación"). AI never classifies: it only transcribes values.
//
// Rules of thumb enforced throughout:
// - A missing value is null, never 0, and is shown as "Not evaluated".
// - No classification without an applicable reference: "Pending reference".
// - Measurement, estimate and observation are kept apart (see `kind`).
// ============================================

import type { FlexibilityAssessmentResult, FlexibilityExerciseId, FlexibilityRating } from '@/services/api'
import {
    MOBILITY_MOVEMENT_IDS,
    type ClinicalResults,
    type ClinicalSectionKey,
    type FallRiskLevel,
    type MobilityItem,
    type MobilityMovementId,
    type ObservationalRating,
    type Predominance,
    type ResultStatus
} from '@/types/clinicalResults.types'

// --------------------------------------------
// Box 1 - Flexibility (evaluator selection)
// --------------------------------------------

export const FLEXIBILITY_POINTS: Record<FlexibilityRating, number> = {
    LOW: 25,
    MEDIUM: 60,
    HIGH: 100,
    // Risk keeps the maximum range-of-motion score (no extra points) and
    // raises an independent warning. It does not automatically mean a
    // higher injury risk.
    RISK: 100
}

export const FLEXIBILITY_RATING_LABELS: Record<FlexibilityRating, string> = {
    LOW: 'Poor',
    MEDIUM: 'Average',
    HIGH: 'Excellent',
    RISK: 'Risk'
}

export const FLEXIBILITY_RATING_INTERPRETATION: Record<FlexibilityRating, string> = {
    LOW: 'Limited flexibility',
    MEDIUM: 'Average flexibility',
    HIGH: 'Optimal flexibility',
    RISK: 'Excessive flexibility — review joint control'
}

export const FLEXIBILITY_EXERCISE_LABELS: Record<FlexibilityExerciseId, string> = {
    forwardFlexion: 'Forward flexion',
    shoulderMobility: 'Shoulder mobility',
    butterfly: 'Butterfly',
    deepSquat: 'Deep squat'
}

const FLEXIBILITY_TEST_COUNT = 4

export interface FlexibilityScore {
    /** (P1 + P2 + P3 + P4) / 4 — only when all four tests were rated */
    score: number | null
    ratedCount: number
    tests: { exerciseId: FlexibilityExerciseId; rating: FlexibilityRating | null; points: number | null; evidenceUrl: string | null }[]
    riskExercises: FlexibilityExerciseId[]
}

export function computeFlexibilityScore(items: FlexibilityAssessmentResult[] | null | undefined): FlexibilityScore {
    const order: FlexibilityExerciseId[] = ['forwardFlexion', 'shoulderMobility', 'butterfly', 'deepSquat']
    const tests = order.map((exerciseId) => {
        const item = items?.find((i) => i.exerciseId === exerciseId)
        const rating = item?.rating ?? null
        return {
            exerciseId,
            rating,
            points: rating ? FLEXIBILITY_POINTS[rating] : null,
            evidenceUrl: item?.evidenceUrl ?? null
        }
    })

    const rated = tests.filter((t) => t.points !== null)
    const score = rated.length === FLEXIBILITY_TEST_COUNT
        ? round(rated.reduce((sum, t) => sum + (t.points as number), 0) / FLEXIBILITY_TEST_COUNT, 2)
        : null

    return {
        score,
        ratedCount: rated.length,
        tests,
        riskExercises: tests.filter((t) => t.rating === 'RISK').map((t) => t.exerciseId)
    }
}

// --------------------------------------------
// Box 3 - Fatigue / Endurance (EMG, observational)
// --------------------------------------------

export const OBSERVATIONAL_RATING_LABELS: Record<ObservationalRating, string> = {
    POOR: 'Poor',
    AVERAGE: 'Average',
    EXCELLENT: 'Excellent'
}

export const FATIGUE_CRITERIA: Record<ObservationalRating, string> = {
    POOR: 'Marked, sustained performance decline with evidence compatible with fatigue.',
    AVERAGE: 'Moderate performance decline during the test.',
    EXCELLENT: 'Stable performance, with little decline during the test.'
}

export const FATIGUE_SUMMARY_LABEL: Record<ObservationalRating, string> = {
    POOR: 'Evident fatigue',
    AVERAGE: 'Moderate fatigue',
    EXCELLENT: 'Good endurance'
}

// --------------------------------------------
// Box 4 - Stability & Balance (BTS single-leg stance)
// --------------------------------------------

/**
 * Lower sway generally means better postural control, but categories need
 * test-specific reference percentiles (P25 / P75 of sway area). Without
 * them the result is reported as "Pending reference".
 *   Excellent: area <= P25 · Average: P25 < area <= P75 · Poor: area > P75
 */
export function classifyBalanceArea(areaMm2: number | null, p25: number | null, p75: number | null): ObservationalRating | null {
    if (areaMm2 === null || p25 === null || p75 === null || p25 > p75) return null
    if (areaMm2 <= p25) return 'EXCELLENT'
    if (areaMm2 <= p75) return 'AVERAGE'
    return 'POOR'
}

export interface SideDifference {
    /** Side with the larger value */
    side: 'RIGHT' | 'LEFT' | 'EQUAL'
    /** Larger vs smaller, in % of the smaller side */
    pct: number
}

export function sideDifference(right: number | null, left: number | null): SideDifference | null {
    if (right === null || left === null || right <= 0 || left <= 0) return null
    if (right === left) return { side: 'EQUAL', pct: 0 }
    const larger = Math.max(right, left)
    const smaller = Math.min(right, left)
    return { side: left > right ? 'LEFT' : 'RIGHT', pct: round(((larger - smaller) / smaller) * 100, 1) }
}

/** Minimum sway-area difference shown as a side with higher stability demand on the compensation map. */
export const BALANCE_SIDE_DIFFERENCE_HIGHLIGHT_PCT = 10

// --------------------------------------------
// Box 5 - Gait speed (BTS Walk Test)
// --------------------------------------------

/** Reference intervals printed on the BTS report used for this protocol. Editable per assessment. */
export const DEFAULT_GAIT_REFERENCE = {
    speedMinMs: 1.12,
    speedMaxMs: 1.34,
    cadenceMin: 111,
    cadenceMax: 126.6
}

export type RangePosition = 'BELOW' | 'WITHIN' | 'ABOVE'

export const RANGE_POSITION_LABELS: Record<RangePosition, string> = {
    BELOW: 'Below reference',
    WITHIN: 'Within reference',
    ABOVE: 'Above reference'
}

export function classifyRange(value: number | null, min: number | null, max: number | null): RangePosition | null {
    if (value === null || min === null || max === null || min > max) return null
    if (value < min) return 'BELOW'
    if (value > max) return 'ABOVE'
    return 'WITHIN'
}

// --------------------------------------------
// Box 6 - Mobility range (BTS instrumented ROM, by movement and side)
// --------------------------------------------

export interface MobilityMovementDefinition {
    id: MobilityMovementId
    label: string
    region: 'shoulder' | 'trunk'
    bilateral: boolean
    /** Default reference (target) printed by BTS for this protocol; null = enter it from the report */
    defaultReferenceDeg: number | null
}

export const MOBILITY_MOVEMENTS: MobilityMovementDefinition[] = [
    { id: 'shoulderInternalRotation', label: 'Shoulder internal rotation', region: 'shoulder', bilateral: true, defaultReferenceDeg: 65 },
    { id: 'shoulderExternalRotation', label: 'Shoulder external rotation', region: 'shoulder', bilateral: true, defaultReferenceDeg: 62 },
    { id: 'shoulderFlexion', label: 'Shoulder forward elevation', region: 'shoulder', bilateral: true, defaultReferenceDeg: 150 },
    { id: 'trunkFlexion', label: 'Trunk flexion', region: 'trunk', bilateral: false, defaultReferenceDeg: null },
    { id: 'trunkExtension', label: 'Trunk extension', region: 'trunk', bilateral: false, defaultReferenceDeg: null },
    { id: 'trunkRotation', label: 'Trunk rotation', region: 'trunk', bilateral: true, defaultReferenceDeg: null },
    { id: 'trunkLateralFlexion', label: 'Trunk lateral flexion', region: 'trunk', bilateral: true, defaultReferenceDeg: null }
]

/**
 * Provisional default for the "clearly limited" threshold: below this share
 * of the reference target a movement is Poor. The PDF does not give a
 * number, so it is pre-filled per movement and stored with the assessment
 * (functionalMinDeg) to keep the classification reproducible. Adjust it in
 * the form when a validated threshold is available.
 */
export const DEFAULT_FUNCTIONAL_FRACTION = 0.8

export const MOBILITY_LEVEL_LABELS: Record<ObservationalRating, string> = {
    POOR: 'Poor',
    AVERAGE: 'Average',
    EXCELLENT: 'Excellent'
}

export const MOBILITY_CRITERIA: Record<ObservationalRating, string> = {
    POOR: 'Clearly limited movement compared with the expected range.',
    AVERAGE: 'Within an acceptable functional range, but below the reference target.',
    EXCELLENT: 'Within the target range established for the test.'
}

export interface RomClassification {
    level: ObservationalRating | null
    /** Independent flag: above the established upper limit */
    excessive: boolean
}

export function classifyRom(valueDeg: number | null, item: MobilityItem): RomClassification {
    if (valueDeg === null) return { level: null, excessive: false }
    const excessive = item.excessiveLimitDeg !== null && valueDeg > item.excessiveLimitDeg
    if (item.referenceDeg === null) return { level: null, excessive }
    if (valueDeg >= item.referenceDeg) return { level: 'EXCELLENT', excessive }
    if (item.functionalMinDeg !== null && valueDeg >= item.functionalMinDeg) return { level: 'AVERAGE', excessive }
    if (item.functionalMinDeg === null) return { level: null, excessive }
    return { level: 'POOR', excessive }
}

export function defaultFunctionalMin(referenceDeg: number | null): number | null {
    return referenceDeg === null ? null : round(referenceDeg * DEFAULT_FUNCTIONAL_FRACTION, 1)
}

// --------------------------------------------
// Box 7 - Muscle asymmetry (bilateral EMG)
// --------------------------------------------

export const PREDOMINANCE_LABELS: Record<Predominance, string> = {
    RIGHT: 'Right predominance',
    LEFT: 'Left predominance',
    BALANCED: 'No clear predominance'
}

// --------------------------------------------
// Box 8 - Fall risk (copied from the BTS Balance Test, never computed)
// --------------------------------------------

export const FALL_RISK_LABELS: Record<FallRiskLevel, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High'
}

// --------------------------------------------
// Box 9 - Body composition (InBody)
// --------------------------------------------

/** InBody body-fat reference ranges by sex (%). Muscle mass is not rated without an appropriate reference. */
export const BODY_FAT_REFERENCE: Record<'Male' | 'Female', { min: number; max: number }> = {
    Male: { min: 10, max: 20 },
    Female: { min: 18, max: 28 }
}

export function bodyFatReference(gender: string | null | undefined): { min: number; max: number } | null {
    if (gender === 'Male' || gender === 'Female') return BODY_FAT_REFERENCE[gender]
    return null
}

/** WHO adult BMI categories */
export function classifyBmi(bmi: number | null): string | null {
    if (bmi === null) return null
    if (bmi < 18.5) return 'Underweight'
    if (bmi < 25) return 'Normal weight'
    if (bmi < 30) return 'Overweight'
    if (bmi < 35) return 'Obesity class I'
    if (bmi < 40) return 'Obesity class II'
    return 'Obesity class III'
}

// --------------------------------------------
// Sections, statuses and the empty template
// --------------------------------------------

export const CLINICAL_SECTIONS: { key: ClinicalSectionKey; box: number | null; title: string; defaultSourceHint: string }[] = [
    { key: 'explosive', box: 2, title: 'Explosive Performance', defaultSourceHint: 'e.g. BTS — Countermovement Jump (CMJ)' },
    { key: 'fatigue', box: 3, title: 'Fatigue / Endurance', defaultSourceHint: 'e.g. Standardized task + processed EMG' },
    { key: 'balance', box: 4, title: 'Stability & Balance', defaultSourceHint: 'e.g. BTS Balance Test — single-leg, eyes open' },
    { key: 'gait', box: 5, title: 'Gait Speed', defaultSourceHint: 'e.g. BTS Walk Test' },
    { key: 'mobility', box: 6, title: 'Mobility Range', defaultSourceHint: 'e.g. BTS instrumented ROM' },
    { key: 'asymmetry', box: 7, title: 'Muscle Asymmetry', defaultSourceHint: 'e.g. Bilateral EMG during the task' },
    { key: 'fallRisk', box: 8, title: 'Fall Risk', defaultSourceHint: 'e.g. BTS Balance Test classification' },
    { key: 'composition', box: 9, title: 'Body Composition – InBody', defaultSourceHint: 'e.g. InBody570' },
    { key: 'inertialForce', box: null, title: 'Inertial Force', defaultSourceHint: 'e.g. BTS G-Sensor — sport gesture' },
    { key: 'tensionShortening', box: null, title: 'Muscle Tension / Shortening', defaultSourceHint: 'Specific evaluation used' }
]

export function sectionTitle(key: ClinicalSectionKey): string {
    return CLINICAL_SECTIONS.find((s) => s.key === key)?.title ?? key
}

function emptyMobilityItem(definition: MobilityMovementDefinition): MobilityItem {
    return {
        rightDeg: null,
        leftDeg: null,
        valueDeg: null,
        referenceDeg: definition.defaultReferenceDeg,
        functionalMinDeg: defaultFunctionalMin(definition.defaultReferenceDeg),
        excessiveLimitDeg: null
    }
}

// --------------------------------------------
// Inertial force (sport gesture, 4 phases)
// --------------------------------------------

export const INERTIAL_PHASE_COUNT = 4

function emptyInertialPhases() {
    return Array.from({ length: INERTIAL_PHASE_COUNT }, () => ({ forceN: null, accelerationMs2: null }))
}

export type InertialForceMethod = 'measured' | 'calculated'

export interface InertialPhaseForce {
    forceN: number | null
    /** measured = the device's force; calculated = F = m × a from the IMU acceleration */
    method: InertialForceMethod | null
}

/**
 * Force of one phase: the device's value when recorded; otherwise
 * F = m × a when both the mass and the IMU acceleration are known.
 * No other formula is applied.
 */
export function inertialPhaseForce(phase: { forceN: number | null; accelerationMs2: number | null }, massKg: number | null): InertialPhaseForce {
    if (phase.forceN !== null) return { forceN: phase.forceN, method: 'measured' }
    if (massKg !== null && massKg > 0 && phase.accelerationMs2 !== null) {
        return { forceN: Math.round(massKg * phase.accelerationMs2), method: 'calculated' }
    }
    return { forceN: null, method: null }
}

export interface InertialForceSummary {
    phases: InertialPhaseForce[]
    /** Highest phase force and its 0-based phase index */
    peak: { forceN: number; phaseIndex: number } | null
    /** Mean of the phases with a force; null when none */
    averageN: number | null
    phasesWithForce: number
    /** Phases with an acceleration but no mass to convert it */
    missingMass: boolean
}

export function summarizeInertialForce(section: { massKg: number | null; phases: { forceN: number | null; accelerationMs2: number | null }[] }): InertialForceSummary {
    const phases = section.phases.map((p) => inertialPhaseForce(p, section.massKg))
    const withForce = phases.map((p, i) => ({ ...p, i })).filter((p): p is InertialPhaseForce & { i: number; forceN: number } => p.forceN !== null)
    const peak = withForce.reduce<{ forceN: number; phaseIndex: number } | null>(
        (best, p) => (best === null || p.forceN > best.forceN ? { forceN: p.forceN, phaseIndex: p.i } : best), null
    )
    return {
        phases,
        peak,
        averageN: withForce.length > 0 ? Math.round(withForce.reduce((sum, p) => sum + p.forceN, 0) / withForce.length) : null,
        phasesWithForce: withForce.length,
        missingMass: section.phases.some((p) => p.forceN === null && p.accelerationMs2 !== null) && !(section.massKg !== null && section.massKg > 0)
    }
}

export function createEmptyClinicalResults(): ClinicalResults {
    const base = { status: 'NOT_EVALUATED' as ResultStatus, source: null, notes: null }
    return {
        version: 1,
        snapshot: { weightLbs: null, heightFt: null, somatotype: null, dominantSide: null, sport: null },
        explosive: { ...base, cmjHeightCm: null, powerW: null, speedMs: null, peakForceKn: null },
        fatigue: { ...base, rating: null },
        balance: {
            ...base,
            durationSec: null,
            rightAreaMm2: null,
            leftAreaMm2: null,
            rightPathMm: null,
            leftPathMm: null,
            referenceP25AreaMm2: null,
            referenceP75AreaMm2: null
        },
        gait: {
            ...base,
            speedMs: null,
            cadenceStepsMin: null,
            refSpeedMinMs: DEFAULT_GAIT_REFERENCE.speedMinMs,
            refSpeedMaxMs: DEFAULT_GAIT_REFERENCE.speedMaxMs,
            refCadenceMin: DEFAULT_GAIT_REFERENCE.cadenceMin,
            refCadenceMax: DEFAULT_GAIT_REFERENCE.cadenceMax
        },
        mobility: {
            ...base,
            items: Object.fromEntries(MOBILITY_MOVEMENTS.map((m) => [m.id, emptyMobilityItem(m)])) as Record<MobilityMovementId, MobilityItem>
        },
        asymmetry: { ...base, overall: null, muscles: [] },
        fallRisk: { ...base, right: null, left: null },
        composition: { ...base, bodyFatPct: null, skeletalMuscleKg: null, bmi: null, weightKg: null },
        inertialForce: { ...base, massKg: null, phases: emptyInertialPhases() },
        tensionShortening: { ...base },
        aiExtractedFields: []
    }
}

/**
 * Fills any missing part of a stored payload with the empty template, so
 * older assessments (or partial payloads) can be edited and rendered safely.
 * Stored references are kept as-is — never replaced with today's defaults.
 */
export function hydrateClinicalResults(stored: ClinicalResults | null | undefined): ClinicalResults {
    const empty = createEmptyClinicalResults()
    if (!stored) return empty

    const items = Object.fromEntries(
        MOBILITY_MOVEMENT_IDS.map((id) => [id, { ...empty.mobility.items[id], ...(stored.mobility?.items?.[id] ?? {}) }])
    ) as Record<MobilityMovementId, MobilityItem>

    return {
        version: 1,
        snapshot: { ...empty.snapshot, ...stored.snapshot },
        explosive: { ...empty.explosive, ...stored.explosive },
        fatigue: { ...empty.fatigue, ...stored.fatigue },
        balance: { ...empty.balance, ...stored.balance },
        gait: { ...empty.gait, ...stored.gait },
        mobility: { ...empty.mobility, ...stored.mobility, items },
        asymmetry: { ...empty.asymmetry, ...stored.asymmetry, muscles: stored.asymmetry?.muscles ?? [] },
        fallRisk: { ...empty.fallRisk, ...stored.fallRisk },
        composition: { ...empty.composition, ...stored.composition },
        inertialForce: {
            ...empty.inertialForce,
            ...stored.inertialForce,
            phases: empty.inertialForce.phases.map((phase, i) => ({ ...phase, ...(stored.inertialForce?.phases?.[i] ?? {}) }))
        },
        tensionShortening: { ...empty.tensionShortening, ...stored.tensionShortening },
        aiExtractedFields: stored.aiExtractedFields ?? []
    }
}

/** True when the section holds any measured/observed value (references alone don't count). */
export function sectionHasData(results: ClinicalResults, key: ClinicalSectionKey): boolean {
    switch (key) {
        case 'explosive': {
            const s = results.explosive
            return [s.cmjHeightCm, s.powerW, s.speedMs, s.peakForceKn].some(isSet)
        }
        case 'fatigue':
            return results.fatigue.rating !== null
        case 'balance': {
            const s = results.balance
            return [s.rightAreaMm2, s.leftAreaMm2, s.rightPathMm, s.leftPathMm].some(isSet)
        }
        case 'gait':
            return isSet(results.gait.speedMs) || isSet(results.gait.cadenceStepsMin)
        case 'mobility':
            return Object.values(results.mobility.items).some((i) => isSet(i.rightDeg) || isSet(i.leftDeg) || isSet(i.valueDeg))
        case 'asymmetry':
            return results.asymmetry.overall !== null || results.asymmetry.muscles.some((m) => m.muscle.trim() !== '')
        case 'fallRisk':
            return results.fallRisk.right !== null || results.fallRisk.left !== null
        case 'composition': {
            const s = results.composition
            return [s.bodyFatPct, s.skeletalMuscleKg, s.bmi, s.weightKg].some(isSet)
        }
        case 'inertialForce':
            // The mass alone is not a result: at least one phase must be recorded
            return results.inertialForce.phases.some((p) => isSet(p.forceN) || isSet(p.accelerationMs2))
        case 'tensionShortening':
            return (results.tensionShortening.notes ?? '').trim() !== ''
    }
}

/** Status to display: a section without data is always "Not evaluated", whatever was stored. */
export function effectiveStatus(results: ClinicalResults, key: ClinicalSectionKey): ResultStatus {
    const stored = results[key].status
    if (!sectionHasData(results, key)) return stored === 'NOT_INTERPRETABLE' ? stored : 'NOT_EVALUATED'
    return stored === 'NOT_EVALUATED' ? 'EVALUATED' : stored
}

// --------------------------------------------
// Report: documented findings and compensation regions
// --------------------------------------------

export type FindingLevel = 'limitation' | 'warning' | 'within'

export interface Finding {
    section: ClinicalSectionKey | 'flexibility'
    level: FindingLevel
    text: string
    source: string | null
}

export function deriveFindings(
    results: ClinicalResults,
    flexibility: FlexibilityAssessmentResult[] | null | undefined,
    gender: string | null | undefined
): Finding[] {
    const findings: Finding[] = []
    const flex = computeFlexibilityScore(flexibility)

    for (const test of flex.tests) {
        if (test.rating === 'LOW') {
            findings.push({ section: 'flexibility', level: 'limitation', text: `${FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]}: limited flexibility (Poor).`, source: 'Form — evaluator selection' })
        }
        if (test.rating === 'RISK') {
            findings.push({ section: 'flexibility', level: 'warning', text: `${FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]}: excessive flexibility — review joint control.`, source: 'Form — evaluator selection' })
        }
    }

    if (effectiveStatus(results, 'fatigue') === 'EVALUATED' && results.fatigue.rating === 'POOR') {
        findings.push({ section: 'fatigue', level: 'limitation', text: FATIGUE_CRITERIA.POOR, source: results.fatigue.source })
    }

    const balance = results.balance
    if (sectionHasData(results, 'balance')) {
        const diff = sideDifference(balance.rightAreaMm2, balance.leftAreaMm2)
        if (diff && diff.side !== 'EQUAL' && diff.pct >= BALANCE_SIDE_DIFFERENCE_HIGHLIGHT_PCT) {
            findings.push({
                section: 'balance',
                level: 'warning',
                text: `Greater sway during ${diff.side === 'LEFT' ? 'left' : 'right'} single-leg support (+${diff.pct}% sway area). Difference in this trial; it does not mean ${diff.pct}% less balance.`,
                source: balance.source
            })
        }
        for (const [side, area] of [['Right', balance.rightAreaMm2], ['Left', balance.leftAreaMm2]] as const) {
            if (classifyBalanceArea(area, balance.referenceP25AreaMm2, balance.referenceP75AreaMm2) === 'POOR') {
                findings.push({ section: 'balance', level: 'limitation', text: `${side} support: sway area above the reference 75th percentile.`, source: balance.source })
            }
        }
    }

    const gait = results.gait
    if (sectionHasData(results, 'gait')) {
        const speed = classifyRange(gait.speedMs, gait.refSpeedMinMs, gait.refSpeedMaxMs)
        const cadence = classifyRange(gait.cadenceStepsMin, gait.refCadenceMin, gait.refCadenceMax)
        if (speed === 'BELOW') {
            findings.push({ section: 'gait', level: 'limitation', text: `Gait speed ${gait.speedMs} m/s, below the reference interval (${gait.refSpeedMinMs}–${gait.refSpeedMaxMs} m/s). Verify the recording is representative.`, source: gait.source })
        }
        if (cadence === 'BELOW') {
            findings.push({ section: 'gait', level: 'limitation', text: `Cadence ${gait.cadenceStepsMin} steps/min, below the reference interval (${gait.refCadenceMin}–${gait.refCadenceMax} steps/min).`, source: gait.source })
        }
    }

    if (sectionHasData(results, 'mobility')) {
        for (const movement of MOBILITY_MOVEMENTS) {
            const item = results.mobility.items[movement.id]
            const sides: [string, number | null][] = movement.bilateral
                ? [['R', item.rightDeg], ['L', item.leftDeg]]
                : [['', item.valueDeg]]
            const limited = sides.filter(([, v]) => {
                const level = classifyRom(v, item).level
                return level === 'POOR' || level === 'AVERAGE'
            })
            if (limited.length > 0 && item.referenceDeg !== null) {
                const values = limited.map(([side, v]) => `${side ? side + ' ' : ''}${v}°`).join(', ')
                findings.push({ section: 'mobility', level: 'limitation', text: `${movement.label} below the reference (${values} vs ${item.referenceDeg}°).`, source: results.mobility.source })
            }
            const excessive = sides.filter(([, v]) => classifyRom(v, item).excessive)
            if (excessive.length > 0) {
                findings.push({ section: 'mobility', level: 'warning', text: `${movement.label}: excessive ROM (above ${item.excessiveLimitDeg}°).`, source: results.mobility.source })
            }
        }
    }

    const composition = results.composition
    if (sectionHasData(results, 'composition')) {
        const fatRef = bodyFatReference(gender)
        const fat = fatRef ? classifyRange(composition.bodyFatPct, fatRef.min, fatRef.max) : null
        if (fat === 'ABOVE') {
            findings.push({ section: 'composition', level: 'limitation', text: `Body fat ${composition.bodyFatPct}%, above the InBody reference (${fatRef!.min}–${fatRef!.max}%).`, source: composition.source })
        }
        const bmiCategory = classifyBmi(composition.bmi)
        if (bmiCategory && bmiCategory !== 'Normal weight') {
            findings.push({ section: 'composition', level: 'limitation', text: `BMI ${composition.bmi}: ${bmiCategory.toLowerCase()} (WHO category).`, source: composition.source })
        }
    }

    const fallRisk = results.fallRisk
    for (const [side, level] of [['right', fallRisk.right], ['left', fallRisk.left]] as const) {
        if (level === 'MEDIUM' || level === 'HIGH') {
            findings.push({ section: 'fallRisk', level: 'warning', text: `Fall risk ${FALL_RISK_LABELS[level].toLowerCase()} on ${side} support (device classification; refers to falls, not general injury risk).`, source: fallRisk.source })
        }
    }

    return findings
}

export interface CompensationRegion {
    id: string
    label: string
    level: 'limitation' | 'warning'
    evidence: string[]
}

/**
 * Body regions with measured limitations or detected stability differences.
 * A region only appears when there is a documented finding behind it.
 */
export function deriveCompensationRegions(
    results: ClinicalResults,
    flexibility: FlexibilityAssessmentResult[] | null | undefined
): CompensationRegion[] {
    const regions = new Map<string, CompensationRegion>()
    const add = (id: string, label: string, level: CompensationRegion['level'], evidence: string) => {
        const region = regions.get(id) ?? { id, label, level, evidence: [] }
        if (level === 'limitation') region.level = 'limitation'
        region.evidence.push(evidence)
        regions.set(id, region)
    }

    const flex = computeFlexibilityScore(flexibility)
    const flexRegion: Record<FlexibilityExerciseId, [string, string]> = {
        forwardFlexion: ['posteriorChain', 'Posterior chain (hamstrings / lumbar)'],
        shoulderMobility: ['shoulders', 'Shoulders'],
        butterfly: ['hips', 'Hips / adductors'],
        deepSquat: ['hipsAnkles', 'Hips, knees and ankles']
    }
    for (const test of flex.tests) {
        const [id, label] = flexRegion[test.exerciseId]
        if (test.rating === 'LOW') add(id, label, 'limitation', `${FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]} test: Poor`)
        if (test.rating === 'RISK') add(id, label, 'warning', `${FLEXIBILITY_EXERCISE_LABELS[test.exerciseId]} test: excessive flexibility`)
    }

    if (sectionHasData(results, 'mobility')) {
        for (const movement of MOBILITY_MOVEMENTS) {
            const item = results.mobility.items[movement.id]
            const values = movement.bilateral ? [item.rightDeg, item.leftDeg] : [item.valueDeg]
            const limited = values.some((v) => {
                const level = classifyRom(v, item).level
                return level === 'POOR' || level === 'AVERAGE'
            })
            if (limited) {
                add(movement.region === 'shoulder' ? 'shoulders' : 'trunk', movement.region === 'shoulder' ? 'Shoulders' : 'Trunk', 'limitation', `${movement.label} below reference`)
            }
        }
    }

    const diff = sideDifference(results.balance.rightAreaMm2, results.balance.leftAreaMm2)
    if (diff && diff.side !== 'EQUAL' && diff.pct >= BALANCE_SIDE_DIFFERENCE_HIGHLIGHT_PCT) {
        const side = diff.side === 'LEFT' ? 'left' : 'right'
        add(`${side}Support`, `${side === 'left' ? 'Left' : 'Right'} support (foot / ankle)`, 'warning', `Higher stability demand: +${diff.pct}% sway area vs the other side`)
    }

    return Array.from(regions.values())
}

// --------------------------------------------
// Helpers
// --------------------------------------------

function isSet(value: number | null | undefined): boolean {
    return value !== null && value !== undefined
}

export function round(value: number, decimals: number): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

/** Display helper: value with unit, or "Not evaluated" for null. */
export function formatValue(value: number | null | undefined, unit = ''): string {
    if (value === null || value === undefined) return 'Not evaluated'
    return unit ? `${value} ${unit}` : String(value)
}
