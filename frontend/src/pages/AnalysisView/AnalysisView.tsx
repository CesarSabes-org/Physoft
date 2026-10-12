import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IoPerson, IoTrash, IoCreate, IoSparklesOutline } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import MiniChatPanel from '@/components/analysis/MiniChatPanel'
import { analysisAPI, Analysis } from '../../services/api'
import { useAnalysisStore } from '@/store/analysisStore'
import { MESSAGES } from '@/constants'
import ExecutiveSummaryCard from '@/components/analysisReport/ExecutiveSummaryCard'
import ResultsOverviewGrid from '@/components/analysisReport/ResultsOverviewGrid'
import MainChartsSection from '@/components/analysisReport/MainChartsSection'
import SportReportSection from '@/components/analysisReport/SportReportSection'
import { hasSportReport } from '@/components/analysisReport/sportAssets'
import DetailedAnalysisSection from '@/components/analysisReport/DetailedAnalysisSection'
import { buildReportData } from '@/components/analysisReport/reportData'
import { translateBodyType } from '@/utils/translation.utils'
import './AnalysisView.css'

const DOMINANT_SIDE_LABELS: Record<string, string> = {
  RIGHT: 'Right',
  LEFT: 'Left',
  AMBIDEXTROUS: 'Ambidextrous'
}

function AnalysisView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteAnalysis } = useAnalysisStore()

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [athleteAnalyses, setAthleteAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!id || !analysis) return

    if (!window.confirm(MESSAGES.CONFIRM.DELETE_ANALYSIS)) {
      return
    }

    setDeleting(true)
    try {
      await deleteAnalysis(parseInt(id))
      navigate('/analysis')
    } catch (error) {
      console.error('Error deleting analysis:', error)
      alert(MESSAGES.ERROR.DELETING_ANALYSIS)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageTemplate title="Loading..." subtitle="">
        <LoadingSpinner message="Loading analysis..." />
      </PageTemplate>
    )
  }

  if (!analysis || !reportData) {
    return (
      <PageTemplate title="Error" subtitle="">
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Analysis not found</p>
          <button
            onClick={() => navigate('/analysis')}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            Back
          </button>
        </div>
      </PageTemplate>
    )
  }

  return (
    <PageTemplate
      title={`Analysis for ${analysis.athlete?.name || 'Patient'}`}
      subtitle={`Evaluation performed on ${new Date(analysis.evaluationDate).toLocaleDateString('en-US')}`}
      className="analysis-view-page"
      showBackButton={true}
      showAddButton={false}
    >
      {/* Custom Action Buttons */}
      <div className="page-header">
        <div className="page-title-section">
          <div className="page-actions" style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
            <button
              className="btn-primary btn-primary-large"
              onClick={() => navigate(`/analysis/edit/${id}`)}
            >
              <IoCreate /> Edit Analysis
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!deleting) e.currentTarget.style.backgroundColor = '#dc2626'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444'
              }}
            >
              {deleting ? <ButtonLoadingContent text="Deleting..." /> : <><IoTrash /> Delete Analysis</>}
            </button>
          </div>
        </div>
      </div>

      <div className="analysis-view-container">
        {/* Patient Information */}
        {analysis.athlete && (
          <section className="analysis-section">
            <h2>
              <IoPerson /> Patient Information
            </h2>
            <div className="athlete-info-grid">
              <div>
                <strong>Name:</strong> {analysis.athlete.name}
              </div>
              <div>
                <strong>Code:</strong> {analysis.athlete.accessCode}
              </div>
              <div>
                <strong>Sport:</strong> {analysis.athlete.sport}
              </div>
              {reportData.results.snapshot.sport && (
                <div>
                  <strong>Assessment sport:</strong> {reportData.results.snapshot.sport}
                </div>
              )}
              {(() => {
                // Values recorded at this evaluation; older assessments fall back to the current profile
                const snapshot = reportData.results.snapshot
                const hasSnapshot = snapshot.weightLbs !== null || snapshot.heightFt !== null || snapshot.somatotype !== null
                const weight = hasSnapshot ? snapshot.weightLbs : analysis.athlete?.weight ?? null
                const height = hasSnapshot ? snapshot.heightFt : analysis.athlete?.height ?? null
                const somatotype = hasSnapshot ? snapshot.somatotype : analysis.athlete?.bodyType ?? null
                const suffix = hasSnapshot ? '' : ' (current profile)'
                return (
                  <>
                    <div>
                      <strong>Weight:</strong> {weight !== null ? `${weight} lbs${suffix}` : 'Not recorded'}
                    </div>
                    <div>
                      <strong>Height:</strong> {height !== null ? `${height} ft${suffix}` : 'Not recorded'}
                    </div>
                    <div>
                      <strong>Somatotype:</strong> {somatotype ? `${translateBodyType(somatotype)}${suffix}` : 'Not recorded'}
                    </div>
                    <div>
                      <strong>Dominant side (declared):</strong>{' '}
                      {snapshot.dominantSide ? DOMINANT_SIDE_LABELS[snapshot.dominantSide] : 'Not declared'}
                    </div>
                  </>
                )
              })()}
            </div>
          </section>
        )}

        {/* Report built only from recorded data and the rules in utils/clinicalScoring.ts */}
        <ExecutiveSummaryCard data={reportData} />
        <ResultsOverviewGrid data={reportData} />
        <MainChartsSection data={reportData} />
        {/* Sport chosen for this assessment; older assessments fall back to the patient's profile sport */}
        {(() => {
          const reportSport = reportData.results.snapshot.sport ?? analysis.athlete?.sport
          return hasSportReport(reportSport) && <SportReportSection sport={reportSport} />
        })()}
        <DetailedAnalysisSection data={reportData} />

        {analysis.aiAnalysisResults && analysis.aiAnalysisResults.length > 0 && (
          <section className="analysis-section">
            <h2>
              <IoSparklesOutline /> AI-Assisted Textual Analysis
            </h2>
            <p className="analysis-section-note">
              AI-generated explanations of the attached data, kept separate from the measured results above. Review before sharing.
            </p>
            <div className="analysis-ai-results">
              {analysis.aiAnalysisResults.map((result) => (
                <MiniChatPanel key={result.id} result={result} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PageTemplate>
  )
}

export default AnalysisView
