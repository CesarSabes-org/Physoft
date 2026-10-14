import { create } from 'zustand'
import { analysisAPI, Analysis } from '../services/api'

interface AnalysisStore {
    /** Every assessment in the clinic, newest evaluation first */
    analyses: Analysis[]
    /** True only while nothing has been loaded yet (background refreshes keep showing cached data) */
    loading: boolean
    loaded: boolean
    error: string | null

    // Actions
    fetchAnalyses: () => Promise<void>
    addAnalysis: (analysis: Analysis) => void
    updateAnalysis: (id: number, analysis: Analysis) => void
    deleteAnalysis: (id: number) => Promise<void>
    removeAnalysesForAthlete: (athleteId: string) => void
}

const byEvaluationDateDesc = (a: Analysis, b: Analysis) =>
    new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime()

/**
 * Global list of all assessments. It is only ever replaced by a full
 * fetch (never by a single patient's subset), and pages call
 * fetchAnalyses() on every mount so data from other sessions/devices
 * shows up without a full page reload.
 */
export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
    analyses: [],
    loading: false,
    loaded: false,
    error: null,

    fetchAnalyses: async () => {
        set({ loading: !get().loaded, error: null })
        try {
            const response = await analysisAPI.getAll()
            set({ analyses: [...response.data].sort(byEvaluationDateDesc), loading: false, loaded: true })
        } catch (error: any) {
            set({ error: error.response?.data?.error || error.message || 'Error loading assessments', loading: false })
        }
    },

    addAnalysis: (analysis: Analysis) => {
        set((state) => ({
            analyses: [analysis, ...state.analyses.filter((a) => a.id !== analysis.id)].sort(byEvaluationDateDesc)
        }))
    },

    updateAnalysis: (id: number, updatedAnalysis: Analysis) => {
        set((state) => ({
            // Merge so fields the update response doesn't include (e.g. athlete photo) are kept
            analyses: state.analyses
                .map((a) => (a.id === id ? { ...a, ...updatedAnalysis, athlete: { ...a.athlete, ...updatedAnalysis.athlete } as Analysis['athlete'] } : a))
                .sort(byEvaluationDateDesc)
        }))
    },

    deleteAnalysis: async (id: number) => {
        set({ error: null })
        try {
            await analysisAPI.delete(id)
            set((state) => ({
                analyses: state.analyses.filter((a) => a.id !== id)
            }))
        } catch (error: any) {
            set({ error: error.message })
            throw error
        }
    },

    // Deleting a patient also deletes their assessments on the backend
    removeAnalysesForAthlete: (athleteId: string) => {
        set((state) => ({
            analyses: state.analyses.filter((a) => a.athleteId !== athleteId)
        }))
    }
}))
