import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoDownloadOutline, IoSparklesOutline, IoPrintOutline, IoAlertCircleOutline } from 'react-icons/io5'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import ExecutiveSummaryCard from '@/components/analysisReport/ExecutiveSummaryCard'
import ResultsOverviewGrid from '@/components/analysisReport/ResultsOverviewGrid'
import MainChartsSection from '@/components/analysisReport/MainChartsSection'
import SportReportSection from '@/components/analysisReport/SportReportSection'
import DetailedAnalysisSection from '@/components/analysisReport/DetailedAnalysisSection'
import { hasSportReport } from '@/components/analysisReport/sportAssets'
import { DOMINANT_SIDE_LABELS, resolvePatientSnapshot } from '@/components/analysisReport/reportData'
import { CHECKLIST_LABELS } from '@/components/analysis/checklistTypes'
import { useAssessmentReport } from '@/hooks/useAssessmentReport'
import { translateBodyType } from '@/utils/translation.utils'
import { calculateAge, formatBirthDateMMDDYYYY, formatDate } from '@/utils/date.utils'
import { exportReportPdf } from '@/utils/exportReportPdf'
import physoftLogo from '@/assets/physoft.png'
import './AssessmentReport.css'

// Same label as the on-screen report (one shared helper)
const somatotypeLabel = translateBodyType

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
}

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

    const athlete = analysis.athlete
    const patient = resolvePatientSnapshot(reportData)
    const age = athlete?.birthDate ? calculateAge(athlete.birthDate) : null
    const profileNote = patient.fromProfile ? ' *' : ''
    const aiResults = analysis.aiAnalysisResults ?? []

    const patientFields: { label: string; value: string }[] = [
        { label: 'Patient code', value: athlete?.accessCode ?? '—' },
        { label: 'Sex', value: athlete?.gender || 'Not recorded' },
        {
            label: 'Age',
            value: age !== null && age > 0 ? `${age} years (${formatBirthDateMMDDYYYY(athlete?.birthDate)})` : 'Not recorded'
        },
        { label: 'Sport (profile)', value: athlete?.sport && athlete.sport !== 'None' ? athlete.sport : 'Not an athlete' },
        { label: 'Assessment sport', value: reportData.results.snapshot.sport ?? 'Not selected' },
        { label: 'Weight', value: patient.weightLbs !== null ? `${patient.weightLbs} lbs${profileNote}` : 'Not recorded' },
        { label: 'Height', value: patient.heightFt !== null ? `${patient.heightFt} ft${profileNote}` : 'Not recorded' },
        { label: 'Somatotype', value: patient.somatotype ? `${somatotypeLabel(patient.somatotype)}${profileNote}` : 'Not recorded' },
        { label: 'Dominant side (declared)', value: patient.dominantSide ? DOMINANT_SIDE_LABELS[patient.dominantSide] : 'Not declared' }
    ]

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

                {/* Patient */}
                <section className="report-doc-patient">
                    <div className="report-doc-patient-identity">
                        {athlete?.photo ? (
                            <img src={athlete.photo} alt={athlete.name} className="report-doc-avatar" />
                        ) : (
                            <span className="report-doc-avatar report-doc-avatar-initials">{initials(athlete?.name ?? 'P')}</span>
                        )}
                        <div>
                            <span className="report-doc-eyebrow">Patient</span>
                            <h1>{athlete?.name ?? 'Patient'}</h1>
                        </div>
                    </div>
                    <dl className="report-doc-patient-grid">
                        {patientFields.map((field) => (
                            <div key={field.label}>
                                <dt>{field.label}</dt>
                                <dd>{field.value}</dd>
                            </div>
                        ))}
                    </dl>
                    {patient.fromProfile && (
                        <p className="report-doc-footnote">* Not recorded at this evaluation — taken from the current patient profile.</p>
                    )}
                </section>

                {/* Report body — the same components as the on-screen report */}
                <div className="report-doc-body">
                    <ExecutiveSummaryCard data={reportData} />
                    <ResultsOverviewGrid data={reportData} />
                    <MainChartsSection data={reportData} />
                    {hasSportReport(patient.reportSport) && <SportReportSection sport={patient.reportSport} />}
                    <DetailedAnalysisSection data={reportData} />

                    {aiResults.length > 0 && (
                        <section className="analysis-section report-doc-ai">
                            <h2>
                                <IoSparklesOutline /> AI-Assisted Textual Analysis
                            </h2>
                            <p className="analysis-section-note">
                                AI-generated explanations of the attached data, reviewed by the professional. Kept separate from the measured results above.
                            </p>
                            {aiResults.map((result) => (
                                <div key={result.id} className="report-doc-ai-item">
                                    <h3>{CHECKLIST_LABELS[result.checkboxType] ?? 'Textual Analysis'}</h3>
                                    <p>{result.aiResponse}</p>
                                </div>
                            ))}
                        </section>
                    )}
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
