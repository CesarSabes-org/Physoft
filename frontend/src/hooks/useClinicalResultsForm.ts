import { useCallback, useEffect, useState } from 'react'
import type {
    AsymmetryMuscle,
    ClinicalExtractionResult,
    ClinicalResults,
    ClinicalSectionKey,
    ResultStatus
} from '@/types/clinicalResults.types'
import { createEmptyClinicalResults, defaultFunctionalMin, hydrateClinicalResults } from '@/utils/clinicalScoring'

type Path = string

function getIn(obj: unknown, path: Path): unknown {
    return path.split('.').reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), obj)
}

/** Immutable set by dotted path; numeric segments index arrays. */
function setIn<T>(obj: T, path: Path, value: unknown): T {
    const [head, ...rest] = path.split('.')
    const isArray = Array.isArray(obj)
    const container = (isArray ? [...(obj as unknown[])] : { ...(obj as Record<string, unknown>) }) as Record<string, unknown>
    container[head] = rest.length === 0 ? value : setIn(container[head] ?? {}, rest.join('.'), value)
    return container as T
}

function sectionOf(path: Path): ClinicalSectionKey | null {
    const head = path.split('.')[0]
    return head === 'snapshot' || head === 'clinicalNotes' || head === 'aiExtractedFields' || head === 'version' ? null : (head as ClinicalSectionKey)
}

function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || value === ''
}

export interface ApplyExtractionSummary {
    filledCount: number
    sections: ClinicalSectionKey[]
}

export interface UseClinicalResultsFormReturn {
    results: ClinicalResults
    /** Set one field by dotted path, e.g. 'gait.speedMs' or 'mobility.items.trunkRotation.leftDeg' */
    setField: (path: Path, value: unknown) => void
    setStatus: (section: ClinicalSectionKey, status: ResultStatus) => void
    isAiField: (path: Path) => boolean
    sectionHasAiFields: (section: ClinicalSectionKey) => boolean
    /** Evaluator confirms the AI-suggested values of a section */
    confirmSection: (section: ClinicalSectionKey) => void
    addMuscle: () => void
    removeMuscle: (index: number) => void
    applyExtraction: (extraction: ClinicalExtractionResult) => ApplyExtractionSummary
}

/**
 * Local form state for the measured/observed results (report boxes 2-9),
 * shared by NewAnalysis and EditAnalysis. Tracks which values came from AI
 * extraction so the evaluator can see and verify them: editing a field by
 * hand removes its AI mark, and AI-filled sections start as "Pending verification".
 */
export function useClinicalResultsForm(initial?: ClinicalResults | null): UseClinicalResultsFormReturn {
    const [results, setResults] = useState<ClinicalResults>(() => hydrateClinicalResults(initial))

    // `initial` arrives asynchronously in the edit flow
    useEffect(() => {
        if (initial) setResults(hydrateClinicalResults(initial))
    }, [initial])

    const setField = useCallback((path: Path, value: unknown) => {
        setResults((prev) => {
            let next = setIn(prev, path, value)

            // Keep the provisional "clearly limited" threshold in step with the
            // reference, unless the evaluator already changed it by hand.
            const refMatch = /^mobility\.items\.(\w+)\.referenceDeg$/.exec(path)
            if (refMatch) {
                const id = refMatch[1] as keyof ClinicalResults['mobility']['items']
                const previousItem = prev.mobility.items[id]
                if (previousItem.functionalMinDeg === null || previousItem.functionalMinDeg === defaultFunctionalMin(previousItem.referenceDeg)) {
                    next = setIn(next, `mobility.items.${id}.functionalMinDeg`, defaultFunctionalMin(value as number | null))
                }
            }

            const section = sectionOf(path)
            if (section && !isEmptyValue(value) && prev[section].status === 'NOT_EVALUATED') {
                next = setIn(next, `${section}.status`, 'EVALUATED')
            }

            if (prev.aiExtractedFields.includes(path)) {
                next = { ...next, aiExtractedFields: next.aiExtractedFields.filter((p) => p !== path) }
            }
            return next
        })
    }, [])

    const setStatus = useCallback((section: ClinicalSectionKey, status: ResultStatus) => {
        setResults((prev) => setIn(prev, `${section}.status`, status))
    }, [])

    const isAiField = useCallback((path: Path) => results.aiExtractedFields.includes(path), [results.aiExtractedFields])

    const sectionHasAiFields = useCallback(
        (section: ClinicalSectionKey) => results.aiExtractedFields.some((p) => p.startsWith(`${section}.`)),
        [results.aiExtractedFields]
    )

    const confirmSection = useCallback((section: ClinicalSectionKey) => {
        setResults((prev) => ({
            ...setIn(prev, `${section}.status`, 'EVALUATED'),
            aiExtractedFields: prev.aiExtractedFields.filter((p) => !p.startsWith(`${section}.`))
        }))
    }, [])

    const addMuscle = useCallback(() => {
        setResults((prev) => {
            const muscle: AsymmetryMuscle = { muscle: '', predominance: null, rightValue: null, leftValue: null, unit: null }
            return setIn(prev, 'asymmetry.muscles', [...prev.asymmetry.muscles, muscle])
        })
    }, [])

    const removeMuscle = useCallback((index: number) => {
        setResults((prev) => setIn(prev, 'asymmetry.muscles', prev.asymmetry.muscles.filter((_, i) => i !== index)))
    }, [])

    const applyExtraction = useCallback((extraction: ClinicalExtractionResult): ApplyExtractionSummary => {
        const touched = new Set<ClinicalSectionKey>()
        const template = createEmptyClinicalResults()
        let filledCount = 0
        let next = results
        const aiPaths = new Set(results.aiExtractedFields)

        for (const [path, value] of Object.entries(extraction.values)) {
            // Only known form fields; the backend already whitelists, this is a second guard
            if (getIn(template, path) === undefined) continue
            next = setIn(next, path, value)
            aiPaths.add(path)
            const section = sectionOf(path)
            if (section) touched.add(section)
            filledCount++
        }

        if (extraction.muscles.length > 0) {
            const kept = next.asymmetry.muscles.filter((m) => m.muscle.trim() !== '')
            next = setIn(next, 'asymmetry.muscles', [...kept, ...extraction.muscles])
            aiPaths.add('asymmetry.muscles')
            touched.add('asymmetry')
            filledCount += extraction.muscles.length
        }

        for (const [section, source] of Object.entries(extraction.sources) as [ClinicalSectionKey, string][]) {
            if (source && touched.has(section) && !next[section].source) {
                next = setIn(next, `${section}.source`, source)
                aiPaths.add(`${section}.source`)
            }
        }

        for (const section of touched) {
            next = setIn(next, `${section}.status`, 'PENDING_VERIFICATION')
        }

        setResults({ ...next, aiExtractedFields: Array.from(aiPaths) })
        return { filledCount, sections: Array.from(touched) }
    }, [results])

    return { results, setField, setStatus, isAiField, sectionHasAiFields, confirmSection, addMuscle, removeMuscle, applyExtraction }
}
