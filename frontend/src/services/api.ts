import axios from 'axios'
import { getToken, clearToken } from '../utils/tokenStorage'
import type { ClinicalResults, ClinicalExtractionResult } from '../types/clinicalResults.types'

// Base Axios configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Create configured axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor (global error handling)
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const isLoginRequest = typeof error.config?.url === 'string' && error.config.url.includes('/auth/login')

    if (error.response?.status === 401 && !isLoginRequest) {
      // Session expired or invalid — clear it and send the user back to
      // Login. A hard navigation is deliberate here: this interceptor runs
      // outside the React tree (no router hooks available) and a full
      // reload guarantees a clean state reset.
      clearToken()
      window.location.assign('/login')
    }

    if (error.response) {
      console.error('Server error:', error.response.status)
    } else if (error.request) {
      console.error('Network error: Could not connect to server')
    } else {
      console.error('Error:', error.message)
    }
    return Promise.reject(error)
  }
)

// ============================================
// ATHLETE API
// ============================================

export interface Athlete {
  id: string  // UUID
  accessCode: string
  photo?: string | null
  cloudinaryPublicId?: string | null
  name: string
  patientType?: string | null
  gender: string
  birthDate?: string | null
  nationality?: string | null
  sport: string
  club?: string | null
  position?: string | null
  bodyType: string
  height: number
  weight: number
  email?: string | null
  phone?: string | null
  syncedAt: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  deviceId?: string | null
}

export interface CreateAthleteDTO {
  photo?: File | null
  name: string
  patientType?: string
  gender: string
  birthDate?: string
  nationality?: string
  sport: string
  club?: string
  position?: string
  bodyType: string
  height: number
  weight: number
  email?: string
  phone?: string
  deviceId?: string
}

// Optional profile fields accept null to clear them (undefined = leave unchanged)
type ClearableAthleteField = 'birthDate' | 'nationality' | 'club' | 'position' | 'email' | 'phone'
export type UpdateAthleteDTO =
  Partial<Omit<CreateAthleteDTO, 'photo' | ClearableAthleteField>> &
  { [K in ClearableAthleteField]?: string | null }

export interface AthleteFilters {
  name?: string
  gender?: string
  sport?: string
  bodyType?: string
  nationality?: string
  patientType?: string
}

export const athleteAPI = {
  // Get all athletes with optional filters
  getAll: async (filters?: AthleteFilters) => {
    const params = new URLSearchParams()
    if (filters?.name) params.append('name', filters.name)
    if (filters?.gender) params.append('gender', filters.gender)
    if (filters?.sport) params.append('sport', filters.sport)
    if (filters?.bodyType) params.append('bodyType', filters.bodyType)
    if (filters?.nationality) params.append('nationality', filters.nationality)
    if (filters?.patientType) params.append('patientType', filters.patientType)

    const response = await apiClient.get<{ success: boolean; data: Athlete[]; total: number }>(
      `/athletes?${params.toString()}`
    )
    return response.data
  },

  // Get athlete by ID
  getById: async (id: string) => {
    const response = await apiClient.get<{ success: boolean; data: Athlete }>(
      `/athletes/${id}`
    )
    return response.data
  },

  // Create new athlete with photo
  create: async (athlete: CreateAthleteDTO) => {
    const formData = new FormData()

    // Append all fields
    formData.append('name', athlete.name)
    if (athlete.patientType) formData.append('patientType', athlete.patientType)
    formData.append('gender', athlete.gender)
    formData.append('sport', athlete.sport)
    formData.append('bodyType', athlete.bodyType)
    formData.append('height', athlete.height.toString())
    formData.append('weight', athlete.weight.toString())

    // Optional fields
    if (athlete.birthDate) formData.append('birthDate', athlete.birthDate)
    if (athlete.nationality) formData.append('nationality', athlete.nationality)
    if (athlete.club) formData.append('club', athlete.club)
    if (athlete.position) formData.append('position', athlete.position)
    if (athlete.email) formData.append('email', athlete.email)
    if (athlete.phone) formData.append('phone', athlete.phone)
    if (athlete.deviceId) formData.append('deviceId', athlete.deviceId)

    // Append photo if present
    if (athlete.photo) {
      formData.append('photo', athlete.photo)
    }

    const response = await apiClient.post<{ success: boolean; data: Athlete; message: string }>(
      '/athletes',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Update athlete
  update: async (id: string, athlete: UpdateAthleteDTO) => {
    const response = await apiClient.put<{ success: boolean; data: Athlete; message: string }>(
      `/athletes/${id}`,
      athlete
    )
    return response.data
  },

  // Upload or update athlete photo
  uploadPhoto: async (id: string, photo: File) => {
    const formData = new FormData()
    formData.append('photo', photo)

    const response = await apiClient.post<{
      success: boolean
      data: Athlete
      message: string
      cloudinaryStatus?: 'uploaded' | 'offline_mode'
    }>(
      `/athletes/${id}/photo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Delete athlete
  delete: async (id: string) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/athletes/${id}`
    )
    return response.data
  }
}

// Helper function to get full photo URL
export function getPhotoUrl(photo: string | null | undefined): string {
  // If no photo, return the default placeholder
  if (!photo || photo === 'default-avatar.png' || photo === '/default-avatar.png') {
    return './default-avatar.png'  // Relative path for Electron
  }

  // If it's a full URL (Cloudinary), return as is
  if (photo.startsWith('http://') || photo.startsWith('https://')) {
    return photo
  }

  // For local files, prepend the backend base URL (without /api)
  const baseUrl = API_URL.replace('/api', '')
  return `${baseUrl}${photo}`
}

// ============================================
// ANALYSIS API
// ============================================

// Flexibility Assessment (New Assessment, Section 2 - 4 standardized tests)
export const FLEXIBILITY_EXERCISE_IDS = ['forwardFlexion', 'shoulderMobility', 'butterfly', 'deepSquat'] as const
export type FlexibilityExerciseId = typeof FLEXIBILITY_EXERCISE_IDS[number]

// Internal storage values. The UI labels these Poor/Average/Excellent/Risk.
// RISK = excessive flexibility: scores like HIGH but raises a separate warning.
export type FlexibilityRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'RISK'

export interface FlexibilityAssessmentResult {
  exerciseId: FlexibilityExerciseId
  rating: FlexibilityRating | null
  evidenceUrl: string | null
}

export interface Analysis {
  id: number
  athleteId: string
  evaluationDate: string
  graphImages?: string | null  // JSON array of URLs
  weakPoints?: string | null  // JSON array of strings
  power?: number | null
  endurance?: number | null
  strength?: number | null
  flexibility?: number | null
  speed?: number | null
  globalClassification?: string | null  // "low", "medium", "high" - Calculated by comparing with same sport/bodyType
  cohortClassification?: string | null  // "ELITE", "AVANZADO", "INTERMEDIO", "PRINCIPIANTE", "ATENCION_REQUERIDA"
  coachRecommendations?: string | null
  flexibilityAssessment?: FlexibilityAssessmentResult[] | null  // Flexibility Assessment ratings + evidence (native JSON column)
  clinicalResults?: ClinicalResults | null  // Measured/observed results for report boxes 2-9 (native JSON column)
  createdAt: string
  updatedAt: string
  athlete?: {
    id: string
    accessCode: string
    name: string
    sport: string
    photo?: string | null
    gender?: string
    birthDate?: string | null
    height?: number
    weight?: number
    bodyType?: string
  }
}

export interface CreateAnalysisDTO {
  athleteId: string
  evaluationDate: string
  weakPoints?: string  // JSON stringified array
  power?: number
  endurance?: number
  strength?: number
  flexibility?: number
  speed?: number
  globalClassification?: string
  coachRecommendations?: string
  graphs?: File[]  // Graph images to upload
  // Flexibility Assessment: ratings for the exercises the user touched (create
  // and rating-only update), plus, on create only, the evidence photo picked
  // locally for each exercise (keyed by exerciseId).
  flexibilityAssessment?: { exerciseId: FlexibilityExerciseId; rating: FlexibilityRating | null; evidenceUrl?: string | null }[]
  flexibilityEvidenceFiles?: Partial<Record<FlexibilityExerciseId, File>>
  // null clears the stored results (update only)
  clinicalResults?: ClinicalResults | null
}

export const analysisAPI = {
  // Get all analyses with optional filters
  getAll: async (filters?: { athleteId?: string; globalClassification?: string; startDate?: string; endDate?: string }) => {
    const params = new URLSearchParams()
    if (filters?.athleteId) params.append('athleteId', filters.athleteId)
    if (filters?.globalClassification) params.append('globalClassification', filters.globalClassification)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const response = await apiClient.get<{ success: boolean; data: Analysis[]; total: number }>(
      `/analyses?${params.toString()}`
    )
    return response.data
  },

  // Get analysis by ID
  getById: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: Analysis }>(
      `/analyses/${id}`
    )
    return response.data
  },

  // Get analyses by athlete ID
  getByAthleteId: async (athleteId: string) => {
    const response = await apiClient.get<{ success: boolean; data: Analysis[]; total: number }>(
      `/athletes/${athleteId}/analyses`
    )
    return response.data
  },

  // Create new analysis with graph images
  create: async (analysis: CreateAnalysisDTO) => {
    const formData = new FormData()

    // Append required fields
    formData.append('athleteId', analysis.athleteId)
    formData.append('evaluationDate', analysis.evaluationDate)

    // Append optional textual analyses

    // Append weak points as JSON string
    if (analysis.weakPoints) formData.append('weakPoints', analysis.weakPoints)

    // Append physical capacities
    if (analysis.power !== undefined) formData.append('power', analysis.power.toString())
    if (analysis.endurance !== undefined) formData.append('endurance', analysis.endurance.toString())
    if (analysis.strength !== undefined) formData.append('strength', analysis.strength.toString())
    if (analysis.flexibility !== undefined) formData.append('flexibility', analysis.flexibility.toString())
    if (analysis.speed !== undefined) formData.append('speed', analysis.speed.toString())

    // Append global classification and recommendations
    if (analysis.globalClassification) formData.append('globalClassification', analysis.globalClassification)
    if (analysis.coachRecommendations) formData.append('coachRecommendations', analysis.coachRecommendations)

    // Append graph images
    if (analysis.graphs && analysis.graphs.length > 0) {
      analysis.graphs.forEach((file) => {
        formData.append('graphs', file)
      })
    }

    // Append Flexibility Assessment ratings (native Json column) and, per
    // exercise, its evidence photo under its own field name so the backend
    // can match each file back to the exercise it belongs to.
    if (analysis.flexibilityAssessment && analysis.flexibilityAssessment.length > 0) {
      formData.append(
        'flexibilityAssessment',
        JSON.stringify(analysis.flexibilityAssessment.map(({ exerciseId, rating }) => ({ exerciseId, rating })))
      )
    }
    if (analysis.flexibilityEvidenceFiles) {
      for (const exerciseId of FLEXIBILITY_EXERCISE_IDS) {
        const file = analysis.flexibilityEvidenceFiles[exerciseId]
        if (file) formData.append(`flexibilityEvidence_${exerciseId}`, file)
      }
    }

    // Measured/observed results (native Json column on the backend)
    if (analysis.clinicalResults) {
      formData.append('clinicalResults', JSON.stringify(analysis.clinicalResults))
    }

    const response = await apiClient.post<{ success: boolean; data: Analysis; message: string }>(
      '/analyses',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Update analysis
  update: async (id: number, analysis: Partial<CreateAnalysisDTO>) => {
    const response = await apiClient.put<{ success: boolean; data: Analysis; message: string }>(
      `/analyses/${id}`,
      analysis
    )
    return response.data
  },

  // Upload (or replace) the evidence photo for one Flexibility Assessment exercise
  uploadFlexibilityEvidence: async (id: number, exerciseId: FlexibilityExerciseId, evidence: File) => {
    const formData = new FormData()
    formData.append('exerciseId', exerciseId)
    formData.append('evidence', evidence)

    const response = await apiClient.post<{ success: boolean; data: Analysis; message: string }>(
      `/analyses/${id}/flexibility-evidence`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  // Remove the evidence photo for one Flexibility Assessment exercise (keeps the rating)
  deleteFlexibilityEvidence: async (id: number, exerciseId: FlexibilityExerciseId) => {
    const response = await apiClient.delete<{ success: boolean; data: Analysis; message: string }>(
      `/analyses/${id}/flexibility-evidence/${exerciseId}`
    )
    return response.data
  },

  // Delete analysis
  delete: async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/analyses/${id}`
    )
    return response.data
  }
}

// ============================================
// CLAUDE API (AI autocomplete of measured results)
// ============================================

export const claudeAPI = {
  // Suggest values for the measured results from device reports (BTS, InBody, EMG).
  // Nothing is saved — the evaluator reviews the suggestions in the form.
  extractClinicalResults: async (files: File[]): Promise<{ success: boolean; data?: ClinicalExtractionResult; error?: string }> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    try {
      const response = await apiClient.post<{ success: boolean; data: ClinicalExtractionResult }>(
        '/claude/extract-clinical-results',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          // Reading multi-page device reports can take longer than the default 30s
          timeout: 120000
        }
      )
      return response.data
    } catch (error: any) {
      if (error.response?.status === 413) {
        return { success: false, error: 'The files are too large to upload. Try fewer files or smaller images.' }
      }
      const message = error.response?.data?.error || error.message || 'Error reading the reports'
      return { success: false, error: message }
    }
  }
}
