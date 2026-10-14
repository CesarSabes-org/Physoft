import { create } from 'zustand'
import { athleteAPI, Athlete } from '../services/api'
import { useAnalysisStore } from './analysisStore'

interface AthleteStore {
    /** Every active patient, newest first (same order as the backend) */
    athletes: Athlete[]
    /** True only while nothing has been loaded yet (background refreshes keep showing cached data) */
    loading: boolean
    loaded: boolean
    error: string | null

    // Actions
    fetchAthletes: () => Promise<void>
    addAthlete: (athlete: Athlete) => void
    updateAthlete: (id: string, athlete: Athlete) => void
    deleteAthlete: (id: string) => Promise<void>
}

/**
 * Global list of all patients. Pages call fetchAthletes() on every mount,
 * so the list is always refreshed from the API instead of trusting
 * whatever happened to be cached earlier in the session.
 */
export const useAthleteStore = create<AthleteStore>((set, get) => ({
    athletes: [],
    loading: false,
    loaded: false,
    error: null,

    fetchAthletes: async () => {
        set({ loading: !get().loaded, error: null })
        try {
            const response = await athleteAPI.getAll()
            set({ athletes: response.data, loading: false, loaded: true })
        } catch (error: any) {
            set({ error: error.response?.data?.error || error.message || 'Error loading patients', loading: false })
        }
    },

    addAthlete: (athlete: Athlete) => {
        set((state) => ({
            athletes: [athlete, ...state.athletes.filter((a) => a.id !== athlete.id)]
        }))
    },

    updateAthlete: (id: string, updatedAthlete: Athlete) => {
        set((state) => ({
            athletes: state.athletes.map((a) =>
                a.id === id ? updatedAthlete : a
            )
        }))
    },

    deleteAthlete: async (id: string) => {
        set({ error: null })
        try {
            await athleteAPI.delete(id)
            set((state) => ({
                athletes: state.athletes.filter((a) => a.id !== id)
            }))
            // The backend deletes the patient's assessments too
            useAnalysisStore.getState().removeAnalysesForAthlete(id)
        } catch (error: any) {
            set({ error: error.message })
            throw error
        }
    }
}))
