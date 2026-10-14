import { useMemo, useEffect } from 'react'
import PageTemplate from '../../components/templates/PageTemplate'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import MetricsOverview from '@/components/dashboard/MetricsOverview'
import RecentActivityCard from '@/components/dashboard/RecentActivityCard'
import PatientDistributionCard from '@/components/dashboard/PatientDistributionCard'
import AssessmentsTrendCard from '@/components/dashboard/AssessmentsTrendCard'
import { useAthleteStore } from '@/store/athleteStore'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis, Athlete } from '../../services/api'
import './Dashboard.css'

const TREND_DAYS = 30
const RECENT_ACTIVITY_LIMIT = 4
const FOLLOW_UP_STALE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

function Dashboard() {
    const { athletes, loading: athletesLoading, error: athletesError, fetchAthletes } = useAthleteStore()
    const { analyses, loading: analysesLoading, error: analysesError, fetchAnalyses } = useAnalysisStore()

    // Always refresh on mount; cached data stays on screen meanwhile
    useEffect(() => {
        fetchAthletes()
        fetchAnalyses()
    }, [fetchAthletes, fetchAnalyses])

    const loading = athletesLoading || analysesLoading
    const error = athletesError || analysesError ? 'Error loading dashboard data. The figures below may be incomplete.' : ''

    const athleteById = useMemo(() => {
        const map = new Map<string, Athlete>()
        athletes.forEach((athlete: Athlete) => map.set(athlete.id, athlete))
        return map
    }, [athletes])

    const latestAnalysisByAthlete = useMemo(() => {
        const map = new Map<string, Analysis>()
        analyses.forEach((analysis: Analysis) => {
            const current = map.get(analysis.athleteId)
            if (!current || new Date(analysis.evaluationDate) > new Date(current.evaluationDate)) {
                map.set(analysis.athleteId, analysis)
            }
        })
        return map
    }, [analyses])

    const assessmentsThisWeek = useMemo(() => {
        const now = Date.now()
        return analyses.filter((a: Analysis) => now - new Date(a.evaluationDate).getTime() <= 7 * DAY_MS).length
    }, [analyses])

    const pendingFollowUps = useMemo(() => {
        const now = Date.now()
        return athletes.filter((athlete: Athlete) => {
            const latest = latestAnalysisByAthlete.get(athlete.id)
            if (!latest) return true
            return now - new Date(latest.evaluationDate).getTime() > FOLLOW_UP_STALE_DAYS * DAY_MS
        }).length
    }, [athletes, latestAnalysisByAthlete])

    const recentActivity = useMemo(() => {
        return [...analyses]
            .sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime())
            .slice(0, RECENT_ACTIVITY_LIMIT)
            .map((analysis: Analysis) => {
                const athlete = athleteById.get(analysis.athleteId)
                return {
                    id: analysis.id,
                    athleteId: analysis.athleteId,
                    patientName: athlete?.name || analysis.athlete?.name || 'Unknown patient',
                    photo: athlete?.photo ?? analysis.athlete?.photo,
                    evaluationDate: analysis.evaluationDate,
                    classification: analysis.cohortClassification || analysis.globalClassification
                }
            })
    }, [analyses, athleteById])

    // Patient distribution: count each patient once, by the classification of
    // their most recent assessment (globalClassification → low / medium / high).
    // Patients whose latest assessment has no classification are not counted.
    const patientDistribution = useMemo(() => {
        const counts = { low: 0, medium: 0, high: 0 }
        latestAnalysisByAthlete.forEach((latest) => {
            const value = latest.globalClassification?.toLowerCase()
            if (value === 'low' || value === 'medium' || value === 'high') {
                counts[value]++
            }
        })
        return counts
    }, [latestAnalysisByAthlete])

    const trendData = useMemo(() => {
        const countsByDay = new Map<string, number>()
        analyses.forEach((analysis: Analysis) => {
            const day = new Date(analysis.evaluationDate)
            day.setHours(0, 0, 0, 0)
            const key = day.toISOString().slice(0, 10)
            countsByDay.set(key, (countsByDay.get(key) || 0) + 1)
        })

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        const days = []
        for (let i = TREND_DAYS - 1; i >= 0; i--) {
            const day = new Date(todayStart.getTime() - i * DAY_MS)
            const key = day.toISOString().slice(0, 10)
            days.push({
                date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                count: countsByDay.get(key) || 0
            })
        }
        return days
    }, [analyses])

    return (
        <PageTemplate className="dashboard">
            <DashboardHeader />

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <MetricsOverview
                totalPatients={athletes.length}
                totalAssessments={analyses.length}
                assessmentsThisWeek={assessmentsThisWeek}
                pendingFollowUps={pendingFollowUps}
                loading={loading}
            />

            <div className="dashboard-columns">
                <RecentActivityCard items={recentActivity} loading={loading} />
                <PatientDistributionCard
                    low={patientDistribution.low}
                    medium={patientDistribution.medium}
                    high={patientDistribution.high}
                    loading={loading}
                />
                <AssessmentsTrendCard data={trendData} loading={loading} />
            </div>
        </PageTemplate>
    )
}

export default Dashboard
