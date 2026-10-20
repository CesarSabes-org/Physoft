// ============================================
// PROMPT: Clinical Results Extraction
// ============================================
// Used by POST /api/claude/extract-clinical-results to pre-fill the
// assessment form from device reports (BTS, InBody, EMG exports). The AI
// only transcribes values that are explicitly printed — the evaluator
// reviews every value and all classification happens with fixed rules
// on the client, never here.
// ============================================

import { MOBILITY_MOVEMENT_IDS, MobilityMovementId } from '../../../../../domain/types/clinicalResults'

export interface ExtractionNumberField {
    path: string
    description: string
}

const MOBILITY_LABELS: Record<MobilityMovementId, { label: string; bilateral: boolean }> = {
    shoulderInternalRotation: { label: 'Shoulder internal rotation ("giro hacia adentro")', bilateral: true },
    shoulderExternalRotation: { label: 'Shoulder external rotation ("giro hacia afuera")', bilateral: true },
    shoulderFlexion: { label: 'Shoulder forward elevation / flexion ("elevación hacia delante")', bilateral: true },
    trunkFlexion: { label: 'Trunk flexion', bilateral: false },
    trunkExtension: { label: 'Trunk extension', bilateral: false },
    trunkRotation: { label: 'Trunk rotation', bilateral: true },
    trunkLateralFlexion: { label: 'Trunk lateral flexion / inclination', bilateral: true }
}

function mobilityFields(): ExtractionNumberField[] {
    return MOBILITY_MOVEMENT_IDS.flatMap((id) => {
        const { label, bilateral } = MOBILITY_LABELS[id]
        const values: ExtractionNumberField[] = bilateral
            ? [
                { path: `mobility.items.${id}.rightDeg`, description: `${label}, RIGHT side, degrees` },
                { path: `mobility.items.${id}.leftDeg`, description: `${label}, LEFT side, degrees` }
            ]
            : [{ path: `mobility.items.${id}.valueDeg`, description: `${label}, degrees` }]
        return [
            ...values,
            { path: `mobility.items.${id}.referenceDeg`, description: `Reference value printed for ${label}, degrees` }
        ]
    })
}

/** Inertial force of the sport gesture, 4 phases in the order the report prints them */
function inertialForceFields(): ExtractionNumberField[] {
    const ordinals = ['FIRST', 'SECOND', 'THIRD', 'FOURTH']
    return ordinals.flatMap((ordinal, index) => [
        { path: `inertialForce.phases.${index}.forceN`, description: `Inertial force of the ${ordinal} phase of the sport gesture, in the order printed (e.g. golf: backswing, transition, impact, follow-through), newtons` },
        { path: `inertialForce.phases.${index}.accelerationMs2`, description: `IMU acceleration of the ${ordinal} phase of the sport gesture, in the order printed, m/s²` }
    ])
}

export const EXTRACTION_NUMBER_FIELDS: ExtractionNumberField[] = [
    { path: 'explosive.cmjHeightCm', description: 'Countermovement Jump (CMJ) jump height, centimeters' },
    { path: 'explosive.powerW', description: 'CMJ power, watts' },
    { path: 'explosive.speedMs', description: 'CMJ velocity, m/s' },
    { path: 'explosive.peakForceKn', description: 'CMJ maximum force, kN' },
    { path: 'balance.durationSec', description: 'Duration of each single-leg stance trial, seconds' },
    { path: 'balance.rightAreaMm2', description: 'Sway area during RIGHT single-leg support, mm²' },
    { path: 'balance.leftAreaMm2', description: 'Sway area during LEFT single-leg support, mm²' },
    { path: 'balance.rightPathMm', description: 'Sway path length during RIGHT single-leg support, mm' },
    { path: 'balance.leftPathMm', description: 'Sway path length during LEFT single-leg support, mm' },
    { path: 'gait.speedMs', description: 'Walking (gait) speed, m/s' },
    { path: 'gait.cadenceStepsMin', description: 'Walking cadence, steps/min' },
    { path: 'gait.refSpeedMinMs', description: 'Lower bound of the reference range printed for gait speed, m/s' },
    { path: 'gait.refSpeedMaxMs', description: 'Upper bound of the reference range printed for gait speed, m/s' },
    { path: 'gait.refCadenceMin', description: 'Lower bound of the reference range printed for cadence, steps/min' },
    { path: 'gait.refCadenceMax', description: 'Upper bound of the reference range printed for cadence, steps/min' },
    ...mobilityFields(),
    { path: 'composition.bodyFatPct', description: 'Percent body fat (PBF), %' },
    { path: 'composition.skeletalMuscleKg', description: 'Skeletal muscle mass (SMM), kg' },
    { path: 'composition.bmi', description: 'Body mass index (BMI), kg/m²' },
    { path: 'composition.weightKg', description: 'Body weight, kg' },
    ...inertialForceFields()
]

export const EXTRACTION_ENUM_FIELDS: { path: string; description: string; values: readonly string[] }[] = [
    { path: 'fallRisk.right', description: 'Fall risk category printed by the balance test for RIGHT support', values: ['LOW', 'MEDIUM', 'HIGH'] },
    { path: 'fallRisk.left', description: 'Fall risk category printed by the balance test for LEFT support', values: ['LOW', 'MEDIUM', 'HIGH'] }
]

export const EXTRACTION_SOURCE_SECTIONS = ['explosive', 'balance', 'gait', 'mobility', 'asymmetry', 'fallRisk', 'composition', 'inertialForce'] as const

export const EXTRACTION_TOOL_NAME = 'record_extracted_values'

export function buildExtractionTool() {
    const properties: Record<string, unknown> = {}

    for (const field of EXTRACTION_NUMBER_FIELDS) {
        properties[field.path] = { type: 'number', description: field.description }
    }
    for (const field of EXTRACTION_ENUM_FIELDS) {
        properties[field.path] = { type: 'string', enum: field.values, description: field.description }
    }

    properties.sources = {
        type: 'object',
        description: 'For each result group found, the device/test name exactly as identified in the document (e.g. "BTS Walk Test", "InBody570").',
        properties: Object.fromEntries(EXTRACTION_SOURCE_SECTIONS.map((key) => [key, { type: 'string' }]))
    }

    properties.muscles = {
        type: 'array',
        description: 'Bilateral EMG rows, only for muscles explicitly reported with right/left values or an explicit side predominance.',
        items: {
            type: 'object',
            properties: {
                muscle: { type: 'string' },
                predominance: { type: 'string', enum: ['RIGHT', 'LEFT', 'BALANCED'] },
                rightValue: { type: 'number' },
                leftValue: { type: 'number' },
                unit: { type: 'string' }
            },
            required: ['muscle']
        }
    }

    properties.warnings = {
        type: 'array',
        items: { type: 'string' },
        description: 'Short notes about anything ambiguous or unreadable that was therefore left out.'
    }

    return {
        name: EXTRACTION_TOOL_NAME,
        description: 'Record the values explicitly printed in the attached assessment reports.',
        input_schema: {
            type: 'object' as const,
            properties
        }
    }
}

export const EXTRACTION_SYSTEM_PROMPT = `You transcribe measured values from clinical/sports assessment device reports (for example BTS motion analysis, InBody body composition, EMG exports) into a structured form for a physiotherapist, who reviews every value afterwards.

Strict rules:
- Only record a field when its value is explicitly printed in the attached documents/images. If it is not printed, omit the field entirely. Never estimate, infer, average, round differently or fill a typical value.
- Never compute derived values (no differences, percentages, scores or classifications) unless the document prints that exact field.
- Units: record the value in the unit the field asks for. Only convert when the conversion is exact and unambiguous (e.g. m to cm, N to kN). If the unit is unclear, omit the field and add a warning.
- Right/left: only assign a side when the document labels it (D/R/Derecho = right, I/L/Izquierdo = left). If unclear, omit and warn.
- Reference values: only record a reference when it is printed next to that specific measurement.
- Fall risk: copy the category printed by the device; do not judge it yourself.
- EMG: only list muscles that are explicitly reported; do not interpret fatigue or quality.
- Inertial force: record the force (N) or the IMU acceleration (m/s²) printed for each phase of the sport gesture, in the order the report prints the phases. Never compute force from acceleration and never invent a phase that is not printed.
- Read numbers carefully. Use the document's context to tell decimal from thousands separators (e.g. a sway area of "2,908 mm²" next to a bar labelled 2908 is 2908, while "0,7 m/s" is 0.7). If it stays ambiguous, omit the field and add a warning.
- Always respond by calling the ${EXTRACTION_TOOL_NAME} tool.`
