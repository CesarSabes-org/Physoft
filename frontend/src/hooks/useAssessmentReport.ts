import { useEffect, useMemo, useState } from 'react'
import { analysisAPI, Analysis } from '@/services/api'
import { buildReportData } from '@/components/analysisReport/reportData'

/**
 * Loads one assessment plus the patient's earlier visits and assembles the
 * report data. Shared by the on-screen report (AnalysisView) and the
 * printable PDF version (AssessmentReport) so both always show the same thing.
 */
export function useAssessmentReport(id: string | undefined) {
    const [analysis, setAnalysis] = useState<Analysis | null>(null)
    const [athleteAnalyses, setAthleteAnalyses] = useState<Analysis[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadAnalysis = async () => {
            if (!id) return

            try {
                setLoading(true)

                // Always read the report from the API: the store copy may lack the
                // full patient record (sex, profile) the report rules need.
                const response = await analysisAPI.getById(parseInt(id))
                setAnalysis(response.data)

                // Earlier visits for Progress Over Time — non-fatal if unavailable
                try {
                    const history = await analysisAPI.getByAthleteId(response.data.athleteId)
                    setAthleteAnalyses(history.data)
                } catch (historyError) {
                    console.error('Error loading previous assessments:', historyError)
                    setAthleteAnalyses([])
                }
            } catch (error) {
                console.error('Error loading analysis:', error)
                setAnalysis(null)
            } finally {
                setLoading(false)
            }
        }

        loadAnalysis()
    }, [id])

    const reportData = useMemo(
        () => (analysis ? buildReportData(analysis, athleteAnalyses) : null),
        [analysis, athleteAnalyses]
    )

    return { analysis, reportData, loading }
}
