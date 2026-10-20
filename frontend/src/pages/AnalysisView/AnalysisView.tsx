import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IoTrash, IoCreate, IoDocumentTextOutline } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import { useAnalysisStore } from '@/store/analysisStore'
import { MESSAGES } from '@/constants'
import ReportPatientCard from '@/components/analysisReport/ReportPatientCard'
import ExecutiveSummaryCard from '@/components/analysisReport/ExecutiveSummaryCard'
import CapacityProfileSection from '@/components/analysisReport/CapacityProfileSection'
import KeyGraphsSection from '@/components/analysisReport/KeyGraphsSection'
import DetailedAnalysisSection from '@/components/analysisReport/DetailedAnalysisSection'
import { useAssessmentReport } from '@/hooks/useAssessmentReport'
import './AnalysisView.css'

function AnalysisView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteAnalysis } = useAnalysisStore()

  const { analysis, reportData, loading } = useAssessmentReport(id)
  const [deleting, setDeleting] = useState(false)

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
          <div className="page-actions" style={{ display: 'flex', gap: '1rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary analysis-pdf-button"
              onClick={() => navigate(`/analysis-view/${id}/report`)}
              title="Preview the report as a document and save it as PDF"
            >
              <IoDocumentTextOutline /> Download PDF
            </button>
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
        {/* Report built only from recorded data and the rules in utils/clinicalScoring.ts */}
        <ReportPatientCard data={reportData} />
        <ExecutiveSummaryCard data={reportData} />
        <CapacityProfileSection data={reportData} />
        <KeyGraphsSection data={reportData} />
        <DetailedAnalysisSection data={reportData} />
      </div>
    </PageTemplate>
  )
}

export default AnalysisView
