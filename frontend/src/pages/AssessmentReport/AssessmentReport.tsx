import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoDownloadOutline, IoPrintOutline, IoAlertCircleOutline } from 'react-icons/io5'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import ReportPatientCard from '@/components/analysisReport/ReportPatientCard'
import ExecutiveSummaryCard from '@/components/analysisReport/ExecutiveSummaryCard'
import CapacityProfileSection from '@/components/analysisReport/CapacityProfileSection'
import KeyGraphsSection from '@/components/analysisReport/KeyGraphsSection'
import DetailedAnalysisSection from '@/components/analysisReport/DetailedAnalysisSection'
import { useAssessmentReport } from '@/hooks/useAssessmentReport'
import { formatDate } from '@/utils/date.utils'
import { exportReportPdf } from '@/utils/exportReportPdf'
import physoftLogo from '@/assets/physoft.png'
import './AssessmentReport.css'

/** Safe file name for the browser's "Save as PDF" default. */
function fileNameFor(name: string, date: string): string {
    const safeName = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
    const day = new Date(date)
    const stamp = isNaN(day.getTime()) ? '' : `_${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    return `Physoft_Assessment_${safeName || 'Patient'}${stamp}`
}

/**
 * Printable assessment report. Same sections and rules as the on-screen
 * report (AnalysisView), laid out as a light A4 document: patient header on
 * top, results below. "Download PDF" generates the file in the browser and
 * downloads it directly; "Print" keeps the browser print dialog available.
 */
function AssessmentReport() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { analysis, reportData, loading } = useAssessmentReport(id)
    const docRef = useRef<HTMLElement>(null)
    const [exporting, setExporting] = useState(false)
    const [exportError, setExportError] = useState(false)

    // The document title is what the browser proposes as the PDF file name
    useEffect(() => {
        if (!analysis) return
        const previousTitle = document.title
        document.title = fileNameFor(analysis.athlete?.name ?? 'Patient', analysis.evaluationDate)
        return () => {
            document.title = previousTitle
        }
    }, [analysis])

    const handleBack = () => navigate(`/analysis-view/${id}`)

    const handleDownload = async () => {
        if (!docRef.current || !analysis || exporting) return
        setExporting(true)
        setExportError(false)
        try {
            await exportReportPdf(
                docRef.current,
                fileNameFor(analysis.athlete?.name ?? 'Patient', analysis.evaluationDate),
                `Physoft · Clinical & Sports Assessment Report · #${analysis.id}`
            )
        } catch (error) {
            console.error('Error generating PDF:', error)
            setExportError(true)
        } finally {
            setExporting(false)
        }
    }

    if (loading) {
        return (
            <div className="report-screen">
                <LoadingSpinner message="Preparing report..." />
            </div>
        )
    }

    if (!analysis || !reportData) {
        return (
            <div className="report-screen report-screen-empty">
                <p>Assessment not found</p>
                <button className="btn-primary" onClick={() => navigate('/analysis')}>Back to assessments</button>
            </div>
        )
    }

    return (
        <div className="report-screen">
            {/* Toolbar — screen only */}
            <div className="report-toolbar">
                <button className="report-toolbar-back" onClick={handleBack}>
                    <IoArrowBack /> Back to analysis
                </button>
                {exportError && (
                    <div className="report-toolbar-error" role="alert">
                        <IoAlertCircleOutline />
                        <span>The PDF couldn't be generated. Try again, or use Print → Save as PDF.</span>
                    </div>
                )}
                <div className="report-toolbar-actions">
                    <button className="report-toolbar-print" onClick={() => window.print()} disabled={exporting} title="Open the browser print dialog">
                        <IoPrintOutline /> <span>Print</span>
                    </button>
                    <button className="report-toolbar-download" onClick={handleDownload} disabled={exporting}>
                        {exporting ? <ButtonLoadingContent text="Generating PDF..." /> : <><IoDownloadOutline /> Download PDF</>}
                    </button>
                </div>
            </div>

            <article className="report-doc" ref={docRef}>
                {/* Brand header */}
                <header className="report-doc-header">
                    <div className="report-doc-brand">
                        <img src={physoftLogo} alt="Physoft" />
                        <div>
                            <span className="report-doc-brand-name">PHYSOFT</span>
                            <span className="report-doc-brand-tagline">Clinical &amp; Sports Assessment Report</span>
                        </div>
                    </div>
                    <dl className="report-doc-meta">
                        <div><dt>Evaluation date</dt><dd>{formatDate(analysis.evaluationDate, 'long')}</dd></div>
                        <div><dt>Report ID</dt><dd>#{analysis.id}</dd></div>
                        <div><dt>Generated</dt><dd>{formatDate(new Date(), 'long')}</dd></div>
                    </dl>
                </header>

                {/* Report body — the same components as the on-screen report */}
                <div className="report-doc-body">
                    <ReportPatientCard data={reportData} />
                    <ExecutiveSummaryCard data={reportData} />
                    <CapacityProfileSection data={reportData} />
                    <KeyGraphsSection data={reportData} />
                    <DetailedAnalysisSection data={reportData} />
                </div>

                {/* Closing */}
                <footer className="report-doc-footer">
                    <div className="report-doc-footer-text">
                        <p>
                            Classifications follow reproducible rules from the recorded data. Values not measured are shown as
                            "Not evaluated" and never as zero. This report supports, and does not replace, the professional's clinical judgment.
                        </p>
                        <p className="report-doc-footer-brand">Physoft DataSoftware · Report #{analysis.id}</p>
                    </div>
                    <div className="report-doc-signature">
                        <span className="report-doc-signature-line" />
                        <span>Evaluating professional — signature</span>
                    </div>
                </footer>
            </article>
        </div>
    )
}

export default AssessmentReport
