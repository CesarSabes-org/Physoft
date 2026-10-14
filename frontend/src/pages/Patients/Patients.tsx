import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoFootball } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import { ConsentModal, useConsentGate } from '@/components/ConsentModal'
import AthleteCard from '../../components/athlete/AthleteCard'
import AthleteModal from '../../components/athlete/AthleteModal'
import { SearchBar } from '@/components/common/data-display/SearchBar'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import EmptyState from '@/components/common/feedback/EmptyState'
import ConfirmModal from '@/components/common/feedback/ConfirmModal'
import Toast, { ToastType } from '@/components/common/feedback/Toast'
import { useDebounce } from '../../hooks'
import { calculateAge } from '../../utils/date.utils'
import { getPhotoUrl, Analysis, Athlete } from '../../services/api'
import { useAthleteStore } from '@/store/athleteStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { ROUTES, MESSAGES } from '../../constants'
import type { AthleteDisplay } from '../../types/athlete.types'
import './Patients.css'

function Patients() {
    const navigate = useNavigate()
    const location = useLocation()
    // Patient consent must be accepted before opening the Create Patient form.
    const addPatientConsent = useConsentGate(ROUTES.ADD_ATHLETE)
    const { athletes, loading, error: athletesError, fetchAthletes, deleteAthlete } = useAthleteStore()
    const { analyses: allAnalyses, fetchAnalyses } = useAnalysisStore()

    // Local state
    const [searchTerm, setSearchTerm] = useState('')
    const [sportFilter, setSportFilter] = useState('All')
    const [selectedAthlete, setSelectedAthlete] = useState<AthleteDisplay | null>(null)
    const error = athletesError ? 'Error loading patients. Check your connection and reload the page.' : ''
    const [athleteToDelete, setAthleteToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)

    // A page that just created/updated a patient (e.g. AddAthlete) can hand
    // off a toast to show here via router state, since it navigates away
    // before any locally-rendered toast would be visible.
    useEffect(() => {
        const incomingToast = (location.state as { toast?: { type: ToastType; message: string } } | null)?.toast
        if (incomingToast) {
            setToast(incomingToast)
            navigate(location.pathname, { replace: true, state: {} })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Debounce search for better performance
    const debouncedSearch = useDebounce(searchTerm, 300)

    // Always refresh on mount; cached data stays on screen meanwhile
    useEffect(() => {
        fetchAthletes()
        fetchAnalyses()
    }, [fetchAthletes, fetchAnalyses])

    // Latest assessment per patient (the store keeps analyses newest first)
    const latestAnalysisByAthlete = useMemo(() => {
        const map = new Map<string, Analysis>()
        allAnalyses.forEach((analysis: Analysis) => {
            if (!map.has(analysis.athleteId)) map.set(analysis.athleteId, analysis)
        })
        return map
    }, [allAnalyses])

    // Transform athletes for display - memoized to avoid recalculation
    const athletesDisplay = useMemo((): AthleteDisplay[] => {
        return athletes.map((athlete: Athlete) => {
            const latestAnalysis = latestAnalysisByAthlete.get(athlete.id)

            return {
                id: athlete.id,
                name: athlete.name,
                photo: getPhotoUrl(athlete.photo),
                sport: athlete.sport,
                age: calculateAge(athlete.birthDate),
                nationality: athlete.nationality || 'Not specified',
                height: athlete.height,
                weight: athlete.weight,
                club: athlete.club || athlete.position || 'No team',
                bodyType: athlete.bodyType,
                accessCode: athlete.accessCode,
                capacities: {
                    power: latestAnalysis?.power || 0,
                    strength: latestAnalysis?.strength || 0,
                    speed: latestAnalysis?.speed || 0,
                    flexibility: latestAnalysis?.flexibility || 0,
                    endurance: latestAnalysis?.endurance || 0
                }
            }
        })
    }, [athletes, latestAnalysisByAthlete])

    // Filter athletes - memoized
    const filteredAthletes = useMemo(() => {
        return athletesDisplay.filter(athlete => {
            const matchesName = athlete.name.toLowerCase().includes(debouncedSearch.toLowerCase())
            const matchesSport = sportFilter === 'All' || athlete.sport === sportFilter
            return matchesName && matchesSport
        })
    }, [athletesDisplay, debouncedSearch, sportFilter])

    // Get unique sports - memoized
    const sports = useMemo(() => {
        return ['All', ...Array.from(new Set(athletesDisplay.map(a => a.sport)))]
    }, [athletesDisplay])

    const handleAthleteClick = useCallback((athlete: AthleteDisplay) => {
        setSelectedAthlete(athlete)
    }, [])

    const handleDeleteAthlete = useCallback((id: string) => {
        setAthleteToDelete(id)
    }, [])

    const confirmDeleteAthlete = useCallback(async () => {
        if (!athleteToDelete) return
        const id = athleteToDelete

        setIsDeleting(true)
        try {
            await deleteAthlete(id)
            setSelectedAthlete(null)
            setAthleteToDelete(null)
            setToast({ type: 'success', message: MESSAGES.SUCCESS.ATHLETE_DELETED })
        } catch (err: any) {
            console.error('Error deleting athlete:', err)
            const backendMessage = err.response?.data?.error
            setToast({ type: 'error', message: backendMessage || MESSAGES.ERROR.DELETING_ATHLETE })
            setAthleteToDelete(null)
        } finally {
            setIsDeleting(false)
        }
    }, [deleteAthlete, athleteToDelete])

    return (
        <PageTemplate
            title="All Patients"
            subtitle="Browse, search and manage every patient in your clinic"
            className="patients-page"
        >
            {/* Filters */}
            <div className="patients-toolbar">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search patients by name..."
                />

                <select
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    className="patients-sport-select"
                >
                    {sports.map(sport => (
                        <option key={sport} value={sport}>{sport === 'All' ? 'All' : sport}</option>
                    ))}
                </select>

                <button
                    className="patients-add-btn"
                    onClick={addPatientConsent.requestAccess}
                    title="Add Patient"
                >
                    <IoFootball />
                    Add Patient
                </button>
            </div>

            {error && (
                <div className="patients-error-message">
                    {error}
                </div>
            )}

            {loading ? (
                <LoadingSpinner message="Loading patients..." />
            ) : filteredAthletes.length > 0 ? (
                <div className="patients-grid">
                    {filteredAthletes.map((athlete) => (
                        <AthleteCard
                            key={athlete.id}
                            athlete={athlete}
                            onClick={() => handleAthleteClick(athlete)}
                        />
                    ))}
                </div>
            ) : error && athletes.length === 0 ? null : (
                // A failed load is reported above, not shown as "no patients"
                <EmptyState
                    icon={<IoFootball />}
                    title="No Patients Found"
                    message="Try different search criteria or add a new patient"
                    action={{
                        label: "Add Patient",
                        onClick: addPatientConsent.requestAccess
                    }}
                />
            )}

            <AthleteModal
                athlete={selectedAthlete}
                onClose={() => setSelectedAthlete(null)}
                onDelete={handleDeleteAthlete}
                onViewDetails={(id) => navigate(`/athlete-detail/${id}`)}
                onEdit={(id) => navigate(`/athletes/edit/${id}`)}
            />

            <ConsentModal
                isOpen={addPatientConsent.isOpen}
                onCancel={addPatientConsent.cancel}
                onAccept={addPatientConsent.accept}
            />

            <ConfirmModal
                isOpen={athleteToDelete !== null}
                title="Delete patient"
                message={MESSAGES.CONFIRM.DELETE_ATHLETE}
                confirmLabel="Delete"
                danger
                loading={isDeleting}
                onConfirm={confirmDeleteAthlete}
                onCancel={() => setAthleteToDelete(null)}
            />

            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </PageTemplate>
    )
}

export default Patients
