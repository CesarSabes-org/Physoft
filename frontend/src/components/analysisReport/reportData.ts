// ============================================
// Report data assembly
// ============================================
// Turns a saved assessment into what the report renders, using only the
// rules in utils/clinicalScoring.ts. No simulated values: anything missing
// is "Not evaluated" and anything without a reference is "Pending reference".
// ============================================

import type { Analysis } from '@/services/api'
import type { ClinicalResults, ClinicalSectionKey, DominantSide, ResultStatus } from '@/types/clinicalResults.types'
import {
    CLINICAL_SECTIONS,
    FALL_RISK_LABELS,
    FATIGUE_SUMMARY_LABEL,
    FLEXIBILITY_EXERCISE_LABELS,
    MOBILITY_MOVEMENTS,
    PREDOMINANCE_LABELS,
    RANGE_POSITION_LABELS,
    bodyFatReference,
    classifyBalanceArea,
    classifyBmi,
    classifyRange,
    classifyRom,
    computeFlexibilityScore,
    deriveCompensationRegions,
    deriveFindings,
    effectiveStatus,
    hydrateClinicalResults,
    sectionHasData,
    sideDifference,
    type CompensationRegion,
    type Finding,
    type FlexibilityScore
} from '@/utils/clinicalScoring'

export type Tone = 'good' | 'mid' | 'bad' | 'warning' | 'neutral' | 'muted'

export interface ReportData {
    analysis: Analysis
    results: ClinicalResults
    flexibility: FlexibilityScore
    findings: Finding[]
    regions: CompensationRegion[]
    gender: string | null
    /** Earlier assessments of the same patient, at least a week before this one, newest first */
    prior: Analysis[]
}

/** Tests from the same week don't form a progress curve. */
const MIN_DAYS_BETWEEN_COMPARABLE_VISITS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function buildReportData(analysis: Analysis, athleteAnalyses: Analysis[]): ReportData {
    const results = hydrateClinicalResults(analysis.clinicalResults)
    const gender = analysis.athlete?.gender ?? null
    const current = new Date(analysis.evaluationDate).getTime()

    const prior = athleteAnalyses
        .filter((a) => a.id !== analysis.id && current - new Date(a.evaluationDate).getTime() >= MIN_DAYS_BETWEEN_COMPARABLE_VISITS * DAY_MS)
        .sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime())

    return {
        analysis,
        results,
        flexibility: computeFlexibilityScore(analysis.flexibilityAssessment),
        findings: deriveFindings(results, analysis.flexibilityAssessment, gender),
        regions: deriveCompensationRegions(results, analysis.flexibilityAssessment),
        gender,
        prior
    }
}

// --------------------------------------------
// Box overview (one card per report box)
// --------------------------------------------

export interface BoxSummary {
    key: ClinicalSectionKey | 'flexibility'
    box: number
    title: string
    value: string
    detail: string
    tone: Tone
    status: ResultStatus
    source: string | null
}

const NOT_EVALUATED = 'Not evaluated'

function toneForRating(rating: 'POOR' | 'AVERAGE' | 'EXCELLENT' | null): Tone {
    if (rating === 'POOR') return 'bad'
    if (rating === 'AVERAGE') return 'mid'
    if (rating === 'EXCELLENT') return 'good'
    return 'neutral'
}

function toneForRange(position: 'BELOW' | 'WITHIN' | 'ABOVE' | null): Tone {
    if (position === 'WITHIN') return 'good'
    if (position === null) return 'neutral'
    return 'bad'
}

export function summarizeBoxes(data: ReportData): BoxSummary[] {
    const { results, flexibility, gender } = data
    const status = (key: ClinicalSectionKey) => effectiveStatus(results, key)
    const summaries: BoxSummary[] = []

    // 1 · Flexibility
    summaries.push({
        key: 'flexibility',
        box: 1,
        title: 'Flexibility',
        value: flexibility.score !== null
            ? `${flexibility.score}/100`
            : flexibility.ratedCount === 0 ? NOT_EVALUATED : `Incomplete (${flexibility.ratedCount}/4)`,
        detail: flexibility.riskExercises.length > 0
            ? `⚠ Excessive flexibility in ${flexibility.riskExercises.length} test(s) — review joint control`
            : flexibility.score !== null ? 'Average of the 4 standardized tests' : 'Score needs all 4 tests rated',
        tone: flexibility.riskExercises.length > 0 ? 'warning' : flexibility.ratedCount === 0 ? 'muted' : 'neutral',
        status: flexibility.ratedCount === 0 ? 'NOT_EVALUATED' : 'EVALUATED',
        source: flexibility.ratedCount > 0 ? 'Form — evaluator selection' : null
    })

    // 2 · Explosive Performance
    const explosive = results.explosive
    summaries.push({
        key: 'explosive',
        box: 2,
        title: 'Explosive Performance',
        value: explosive.cmjHeightCm !== null ? `CMJ ${explosive.cmjHeightCm} cm` : status('explosive') === 'NOT_EVALUATED' ? NOT_EVALUATED : 'See measurements',
        detail: 'Classification: pending reference standards',
        tone: status('explosive') === 'NOT_EVALUATED' ? 'muted' : 'neutral',
        status: status('explosive'),
        source: explosive.source
    })

    // 3 · Fatigue / Endurance
    const fatigue = results.fatigue
    summaries.push({
        key: 'fatigue',
        box: 3,
        title: 'Fatigue / Endurance',
        value: fatigue.rating ? { POOR: 'Poor', AVERAGE: 'Average', EXCELLENT: 'Excellent' }[fatigue.rating] : NOT_EVALUATED,
        detail: fatigue.rating ? FATIGUE_SUMMARY_LABEL[fatigue.rating] : '',
        tone: fatigue.rating ? toneForRating(fatigue.rating) : 'muted',
        status: status('fatigue'),
        source: fatigue.source
    })

    // 4 · Stability & Balance
    const balance = results.balance
    const balanceDiff = sideDifference(balance.rightAreaMm2, balance.leftAreaMm2)
    const balanceLevels = [balance.rightAreaMm2, balance.leftAreaMm2]
        .map((area) => classifyBalanceArea(area, balance.referenceP25AreaMm2, balance.referenceP75AreaMm2))
    const worstBalance = balanceLevels.includes('POOR') ? 'POOR' : balanceLevels.includes('AVERAGE') ? 'AVERAGE' : balanceLevels.includes('EXCELLENT') ? 'EXCELLENT' : null
    summaries.push({
        key: 'balance',
        box: 4,
        title: 'Stability & Balance',
        value: balance.rightAreaMm2 !== null || balance.leftAreaMm2 !== null
            ? `R ${balance.rightAreaMm2 ?? '—'} · L ${balance.leftAreaMm2 ?? '—'} mm²`
            : NOT_EVALUATED,
        detail: balanceDiff && balanceDiff.side !== 'EQUAL'
            ? `+${balanceDiff.pct}% sway area on ${balanceDiff.side === 'LEFT' ? 'left' : 'right'} support${worstBalance ? '' : ' · pending reference percentiles'}`
            : worstBalance ? '' : status('balance') === 'NOT_EVALUATED' ? '' : 'Pending reference percentiles',
        tone: status('balance') === 'NOT_EVALUATED' ? 'muted' : worstBalance ? toneForRating(worstBalance) : 'neutral',
        status: status('balance'),
        source: balance.source
    })

    // 5 · Gait Speed
    const gait = results.gait
    const gaitSpeed = classifyRange(gait.speedMs, gait.refSpeedMinMs, gait.refSpeedMaxMs)
    const gaitCadence = classifyRange(gait.cadenceStepsMin, gait.refCadenceMin, gait.refCadenceMax)
    summaries.push({
        key: 'gait',
        box: 5,
        title: 'Gait Speed',
        value: gait.speedMs !== null ? `${gait.speedMs} m/s` : NOT_EVALUATED,
        detail: [
            gait.speedMs !== null ? (gaitSpeed ? RANGE_POSITION_LABELS[gaitSpeed] : 'Pending reference') : null,
            gait.cadenceStepsMin !== null ? `Cadence ${gait.cadenceStepsMin} steps/min${gaitCadence ? ` (${RANGE_POSITION_LABELS[gaitCadence].toLowerCase()})` : ''}` : null
        ].filter(Boolean).join(' · '),
        tone: status('gait') === 'NOT_EVALUATED' ? 'muted' : toneForRange(gaitSpeed),
        status: status('gait'),
        source: gait.source
    })

    // 6 · Mobility Range
    const romLevels = MOBILITY_MOVEMENTS.flatMap((m) => {
        const item = results.mobility.items[m.id]
        const values = m.bilateral ? [item.rightDeg, item.leftDeg] : [item.valueDeg]
        return values.filter((v): v is number => v !== null).map((v) => classifyRom(v, item))
    })
    const romCount = (level: 'POOR' | 'AVERAGE' | 'EXCELLENT') => romLevels.filter((c) => c.level === level).length
    const excessiveCount = romLevels.filter((c) => c.excessive).length
    summaries.push({
        key: 'mobility',
        box: 6,
        title: 'Mobility Range',
        value: romLevels.length === 0 ? NOT_EVALUATED : `${romLevels.length} measurement(s)`,
        detail: romLevels.length === 0 ? '' : [
            romCount('POOR') > 0 ? `${romCount('POOR')} Poor` : null,
            romCount('AVERAGE') > 0 ? `${romCount('AVERAGE')} Average` : null,
            romCount('EXCELLENT') > 0 ? `${romCount('EXCELLENT')} Excellent` : null,
            romLevels.some((c) => c.level === null) ? `${romLevels.filter((c) => c.level === null).length} pending reference` : null,
            excessiveCount > 0 ? `${excessiveCount} excessive ROM` : null
        ].filter(Boolean).join(' · '),
        tone: romLevels.length === 0 ? 'muted' : romCount('POOR') > 0 ? 'bad' : romCount('AVERAGE') > 0 ? 'mid' : romCount('EXCELLENT') > 0 ? 'good' : 'neutral',
        status: status('mobility'),
        source: results.mobility.source
    })

    // 7 · Muscle Asymmetry
    const asymmetry = results.asymmetry
    summaries.push({
        key: 'asymmetry',
        box: 7,
        title: 'Muscle Asymmetry',
        value: asymmetry.overall ? PREDOMINANCE_LABELS[asymmetry.overall] : asymmetry.muscles.length > 0 ? `${asymmetry.muscles.length} muscle(s)` : NOT_EVALUATED,
        detail: status('asymmetry') === 'NOT_EVALUATED' ? '' : 'Apparent predominance (EMG amplitude) — not rated Good/Poor',
        tone: status('asymmetry') === 'NOT_EVALUATED' ? 'muted' : 'neutral',
        status: status('asymmetry'),
        source: asymmetry.source
    })

    // 8 · Fall Risk
    const fallRisk = results.fallRisk
    const fallLevels = [fallRisk.right, fallRisk.left]
    summaries.push({
        key: 'fallRisk',
        box: 8,
        title: 'Fall Risk',
        value: fallRisk.right || fallRisk.left
            ? fallRisk.right === fallRisk.left
                ? `${FALL_RISK_LABELS[fallRisk.right!]} (both supports)`
                : `R ${fallRisk.right ? FALL_RISK_LABELS[fallRisk.right] : '—'} · L ${fallRisk.left ? FALL_RISK_LABELS[fallRisk.left] : '—'}`
            : NOT_EVALUATED,
        detail: fallRisk.right || fallRisk.left ? 'Device classification · refers to falls, not general injury risk' : '',
        tone: fallLevels.includes('HIGH') ? 'bad' : fallLevels.includes('MEDIUM') ? 'mid' : fallLevels.includes('LOW') ? 'good' : 'muted',
        status: status('fallRisk'),
        source: fallRisk.source
    })

    // 9 · Body Composition – InBody
    const composition = results.composition
    const fatRef = bodyFatReference(gender)
    const fatPosition = fatRef ? classifyRange(composition.bodyFatPct, fatRef.min, fatRef.max) : null
    const bmiCategory = classifyBmi(composition.bmi)
    summaries.push({
        key: 'composition',
        box: 9,
        title: 'Body Composition – InBody',
        value: [
            composition.bodyFatPct !== null ? `Fat ${composition.bodyFatPct}%` : null,
            composition.bmi !== null ? `BMI ${composition.bmi}` : null
        ].filter(Boolean).join(' · ') || (status('composition') === 'NOT_EVALUATED' ? NOT_EVALUATED : 'See parameters'),
        detail: [
            fatPosition ? `Fat ${RANGE_POSITION_LABELS[fatPosition].toLowerCase()}` : composition.bodyFatPct !== null ? 'Fat: pending reference' : null,
            bmiCategory ? `${bmiCategory} (WHO)` : null
        ].filter(Boolean).join(' · '),
        tone: status('composition') === 'NOT_EVALUATED'
            ? 'muted'
            : fatPosition === 'ABOVE' || (bmiCategory && bmiCategory !== 'Normal weight') ? 'bad' : fatPosition === 'WITHIN' ? 'good' : 'neutral',
        status: status('composition'),
        source: composition.source
    })

    return summaries
}

// --------------------------------------------
// Progress over time (comparable visits only)
// --------------------------------------------

interface ProgressMetric {
    label: string
    unit: string
    section: ClinicalSectionKey | 'flexibility'
    read: (analysis: Analysis) => number | null
}

const PROGRESS_METRICS: ProgressMetric[] = [
    { label: 'Flexibility score', unit: '/100', section: 'flexibility', read: (a) => computeFlexibilityScore(a.flexibilityAssessment).score },
    { label: 'CMJ height', unit: 'cm', section: 'explosive', read: (a) => a.clinicalResults?.explosive?.cmjHeightCm ?? null },
    { label: 'Gait speed', unit: 'm/s', section: 'gait', read: (a) => a.clinicalResults?.gait?.speedMs ?? null },
    { label: 'Cadence', unit: 'steps/min', section: 'gait', read: (a) => a.clinicalResults?.gait?.cadenceStepsMin ?? null },
    { label: 'Sway area, right support', unit: 'mm²', section: 'balance', read: (a) => a.clinicalResults?.balance?.rightAreaMm2 ?? null },
    { label: 'Sway area, left support', unit: 'mm²', section: 'balance', read: (a) => a.clinicalResults?.balance?.leftAreaMm2 ?? null },
    { label: 'Body fat', unit: '%', section: 'composition', read: (a) => a.clinicalResults?.composition?.bodyFatPct ?? null },
    { label: 'BMI', unit: 'kg/m²', section: 'composition', read: (a) => a.clinicalResults?.composition?.bmi ?? null }
]

function sourceOf(analysis: Analysis, section: ClinicalSectionKey | 'flexibility'): string | null {
    if (section === 'flexibility') return 'form'
    return analysis.clinicalResults?.[section]?.source?.trim().toLowerCase() || null
}

export interface ProgressRow {
    label: string
    unit: string
    points: { date: string; value: number }[]
    change: number | null
}

/**
 * Same variable, same unit and — when both visits record it — the same
 * source/protocol. Visits less than a week apart are excluded upstream.
 */
export function buildProgressRows(data: ReportData): ProgressRow[] {
    return PROGRESS_METRICS.flatMap((metric) => {
        const currentValue = metric.read(data.analysis)
        if (currentValue === null) return []
        const currentSource = sourceOf(data.analysis, metric.section)

        const previous = data.prior
            .filter((a) => {
                if (metric.read(a) === null) return false
                const priorSource = sourceOf(a, metric.section)
                return !currentSource || !priorSource || priorSource === currentSource
            })
            .slice(0, 3)
            .reverse()

        if (previous.length === 0) return []

        const points = [...previous, data.analysis].map((a) => ({ date: a.evaluationDate, value: metric.read(a) as number }))
        const last = previous[previous.length - 1]
        return [{
            label: metric.label,
            unit: metric.unit,
            points,
            change: Math.round((currentValue - (metric.read(last) as number)) * 100) / 100
        }]
    })
}

// --------------------------------------------
// Patient values recorded at this evaluation
// --------------------------------------------

export interface PatientSnapshotView {
    weightLbs: number | null
    heightFt: number | null
    somatotype: string | null
    dominantSide: DominantSide | null
    /** Sport chosen for this assessment; older assessments fall back to the patient's profile sport */
    reportSport: string | null
    /** True when weight/height/somatotype come from the current profile, not from this evaluation */
    fromProfile: boolean
}

export const DOMINANT_SIDE_LABELS: Record<string, string> = {
    RIGHT: 'Right',
    LEFT: 'Left',
    AMBIDEXTROUS: 'Ambidextrous'
}

/** Values recorded at this evaluation; older assessments fall back to the current profile. */
export function resolvePatientSnapshot(data: ReportData): PatientSnapshotView {
    const { snapshot } = data.results
    const athlete = data.analysis.athlete
    const hasSnapshot = snapshot.weightLbs !== null || snapshot.heightFt !== null || snapshot.somatotype !== null

    return {
        weightLbs: hasSnapshot ? snapshot.weightLbs : athlete?.weight ?? null,
        heightFt: hasSnapshot ? snapshot.heightFt : athlete?.height ?? null,
        somatotype: hasSnapshot ? snapshot.somatotype : athlete?.bodyType ?? null,
        dominantSide: snapshot.dominantSide,
        reportSport: snapshot.sport ?? athlete?.sport ?? null,
        fromProfile: !hasSnapshot
    }
}

// --------------------------------------------
// Completeness of the evaluation
// --------------------------------------------

export interface EvaluationCoverage {
    /** Report boxes (1-9) with at least one recorded value */
    evaluated: number
    total: number
    /** Distinct data sources behind the evaluated boxes */
    sources: string[]
    /** Boxes filled by AI that still await the evaluator's check */
    pendingVerification: string[]
}

export function evaluationCoverage(data: ReportData): EvaluationCoverage {
    const { results, flexibility } = data
    const boxes = CLINICAL_SECTIONS.filter((s) => s.box !== null)
    const evaluatedBoxes = boxes.filter((s) => effectiveStatus(results, s.key) !== 'NOT_EVALUATED')
    const sources = new Set(
        [flexibility.ratedCount > 0 ? 'Evaluator form' : null, ...evaluatedBoxes.map((s) => results[s.key].source)]
            .filter((s): s is string => Boolean(s && s.trim()))
    )
    return {
        evaluated: evaluatedBoxes.length + (flexibility.ratedCount > 0 ? 1 : 0),
        total: boxes.length + 1,
        sources: [...sources],
        pendingVerification: boxes.filter((s) => effectiveStatus(results, s.key) === 'PENDING_VERIFICATION').map((s) => s.title)
    }
}

// --------------------------------------------
// Strengths: the findings' rules, read the other way
// --------------------------------------------

/**
 * Results that meet their reference, using the same rules that produce the
 * findings. Nothing is listed without a classification behind it.
 */
export function deriveStrengths(data: ReportData): string[] {
    const { results, flexibility, gender } = data
    const strengths: string[] = []

    const excellentTests = flexibility.tests.filter((t) => t.rating === 'HIGH').map((t) => FLEXIBILITY_EXERCISE_LABELS[t.exerciseId])
    if (excellentTests.length > 0) {
        strengths.push(`Optimal flexibility (Excellent): ${excellentTests.join(', ')}.`)
    }

    if (effectiveStatus(results, 'fatigue') === 'EVALUATED' && results.fatigue.rating === 'EXCELLENT') {
        strengths.push('Good endurance: performance maintained during the fatigue test.')
    }

    const balance = results.balance
    const balanceLevels = [balance.rightAreaMm2, balance.leftAreaMm2]
        .map((area) => classifyBalanceArea(area, balance.referenceP25AreaMm2, balance.referenceP75AreaMm2))
    if (balanceLevels.every((level) => level === 'EXCELLENT')) {
        strengths.push('Excellent postural control on both single-leg supports (sway at or below the reference 25th percentile).')
    }

    const gait = results.gait
    if (sectionHasData(results, 'gait')) {
        const speed = classifyRange(gait.speedMs, gait.refSpeedMinMs, gait.refSpeedMaxMs)
        const cadence = classifyRange(gait.cadenceStepsMin, gait.refCadenceMin, gait.refCadenceMax)
        if (speed === 'WITHIN' && cadence !== 'BELOW' && cadence !== 'ABOVE') {
            strengths.push(`Gait speed ${gait.speedMs} m/s within the reference interval${cadence === 'WITHIN' ? ', cadence also within reference' : ''}.`)
        }
    }

    if (sectionHasData(results, 'mobility')) {
        const withinTarget = MOBILITY_MOVEMENTS.filter((m) => {
            const item = results.mobility.items[m.id]
            const values = (m.bilateral ? [item.rightDeg, item.leftDeg] : [item.valueDeg]).filter((v): v is number => v !== null)
            return values.length > 0 && values.every((v) => {
                const c = classifyRom(v, item)
                return c.level === 'EXCELLENT' && !c.excessive
            })
        }).map((m) => m.label.toLowerCase())
        if (withinTarget.length > 0) {
            strengths.push(`Range of motion within the target: ${withinTarget.join(', ')}.`)
        }
    }

    if (sectionHasData(results, 'asymmetry') && results.asymmetry.overall === 'BALANCED') {
        strengths.push('No clear muscle predominance between sides (EMG).')
    }

    if (results.fallRisk.right === 'LOW' && results.fallRisk.left === 'LOW') {
        strengths.push('Low fall risk on both supports (device classification).')
    }

    const composition = results.composition
    if (sectionHasData(results, 'composition')) {
        const fatRef = bodyFatReference(gender)
        const fat = fatRef ? classifyRange(composition.bodyFatPct, fatRef.min, fatRef.max) : null
        const bmiNormal = classifyBmi(composition.bmi) === 'Normal weight'
        if (fat === 'WITHIN' && bmiNormal) strengths.push(`Body fat (${composition.bodyFatPct}%) and BMI (${composition.bmi}) within reference.`)
        else if (fat === 'WITHIN') strengths.push(`Body fat ${composition.bodyFatPct}% within the InBody reference.`)
        else if (bmiNormal) strengths.push(`BMI ${composition.bmi}: normal weight (WHO category).`)
    }

    return strengths
}

// --------------------------------------------
// Capacity profile (7 cards)
// --------------------------------------------

export type CapacityKey = 'mobility' | 'explosive' | 'fatigue' | 'balance' | 'fallRisk' | 'asymmetry' | 'composition'

export interface CapacityCard {
    key: CapacityKey
    title: string
    value: string
    /** Short classification chip; null when there is no rule to rate it */
    rating: string | null
    detail: string
    tone: Tone
    /** 0-100 only where the client defined a score (Flexibility Score) */
    score: number | null
}

const RATING_BY_TONE: Partial<Record<Tone, string>> = {
    good: 'Good',
    mid: 'Moderate',
    bad: 'Limited',
    warning: 'Review'
}

/**
 * The seven capacities of the client's report layout, built from the nine
 * report boxes. No 0-100 score is invented: only Flexibility has one, and
 * it is shown without a category because the client defined none.
 */
export function buildCapacityProfile(data: ReportData): CapacityCard[] {
    const boxes = summarizeBoxes(data)
    const box = (key: BoxSummary['key']) => boxes.find((b) => b.key === key) as BoxSummary
    const card = (key: CapacityKey, source: BoxSummary, title: string, rating?: string | null): CapacityCard => ({
        key,
        title,
        value: source.value,
        rating: source.tone === 'muted' ? null : rating !== undefined ? rating : RATING_BY_TONE[source.tone] ?? null,
        detail: source.detail,
        tone: source.tone,
        score: null
    })

    const flexibility = box('flexibility')
    const mobility = box('mobility')
    const fallLevels = [data.results.fallRisk.right, data.results.fallRisk.left]
    const fallRating = fallLevels.includes('HIGH') ? 'High risk' : fallLevels.includes('MEDIUM') ? 'Medium risk' : fallLevels.includes('LOW') ? 'Low risk' : null

    return [
        {
            ...card('mobility', flexibility, 'Mobility / Flexibility', data.flexibility.riskExercises.length > 0 ? 'Review' : null),
            detail: [flexibility.detail, mobility.status !== 'NOT_EVALUATED' && mobility.detail ? `ROM: ${mobility.detail}` : null]
                .filter(Boolean).join(' · '),
            score: data.flexibility.score
        },
        card('explosive', box('explosive'), 'Explosive Output', null),
        card('fatigue', box('fatigue'), 'Fatigue / Resistance'),
        card('balance', box('balance'), 'Stability & Balance'),
        card('fallRisk', box('fallRisk'), 'Fall Risk', fallRating),
        card('asymmetry', box('asymmetry'), 'Muscular Symmetry (EMG)', null),
        card('composition', box('composition'), 'Body Composition')
    ]
}
