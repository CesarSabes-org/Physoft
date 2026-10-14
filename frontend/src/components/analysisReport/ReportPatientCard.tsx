import { IoCalendarOutline, IoCheckmarkDoneOutline, IoDocumentTextOutline, IoTrophyOutline } from 'react-icons/io5'
import { calculateAge, formatBirthDateMMDDYYYY } from '@/utils/date.utils'
import { translateBodyType } from '@/utils/translation.utils'
import { DOMINANT_SIDE_LABELS, evaluationCoverage, resolvePatientSnapshot, type ReportData } from './reportData'
import './ReportPatientCard.css'

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
}

function formatEvaluationDate(value: string): string {
    const date = new Date(value)
    if (isNaN(date.getTime())) return 'Not recorded'
    return date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
}

/**
 * Report header: who was evaluated (values recorded at this evaluation, with
 * the current profile as fallback) and what this evaluation covered.
 */
function ReportPatientCard({ data }: { data: ReportData }) {
    const { analysis } = data
    const athlete = analysis.athlete
    const patient = resolvePatientSnapshot(data)
    const coverage = evaluationCoverage(data)
    const age = athlete?.birthDate ? calculateAge(athlete.birthDate) : null
    const profileMark = patient.fromProfile ? ' *' : ''
    const name = athlete?.name ?? 'Patient'

    const identity = [
        athlete?.accessCode ? `Code ${athlete.accessCode}` : null,
        athlete?.gender || null,
        age !== null && age > 0 ? `${age} years` : null
    ].filter(Boolean).join(' · ')

    const fields: { label: string; value: string }[] = [
        { label: 'Date of birth', value: athlete?.birthDate ? formatBirthDateMMDDYYYY(athlete.birthDate) : 'Not recorded' },
        { label: 'Height', value: patient.heightFt !== null ? `${patient.heightFt} ft${profileMark}` : 'Not recorded' },
        { label: 'Weight', value: patient.weightLbs !== null ? `${patient.weightLbs} lbs${profileMark}` : 'Not recorded' },
        { label: 'Somatotype', value: patient.somatotype ? `${translateBodyType(patient.somatotype)}${profileMark}` : 'Not recorded' },
        { label: 'Dominant side (declared)', value: patient.dominantSide ? DOMINANT_SIDE_LABELS[patient.dominantSide] : 'Not declared' },
        { label: 'Sport (profile)', value: athlete?.sport && athlete.sport !== 'None' ? athlete.sport : 'Not an athlete' }
    ]

    return (
        <section className="report-patient">
            <div className="report-patient-main">
                <div className="report-patient-identity">
                    {athlete?.photo ? (
                        <img src={athlete.photo} alt={name} className="report-patient-avatar" />
                    ) : (
                        <span className="report-patient-avatar report-patient-avatar-initials">{initials(name)}</span>
                    )}
                    <div>
                        <span className="report-patient-eyebrow">Patient</span>
                        <h2 className="report-patient-name">{name}</h2>
                        {identity && <span className="report-patient-sub">{identity}</span>}
                    </div>
                </div>

                <dl className="report-patient-grid">
                    {fields.map((field) => (
                        <div key={field.label}>
                            <dt>{field.label}</dt>
                            <dd>{field.value}</dd>
                        </div>
                    ))}
                </dl>
                {patient.fromProfile && (
                    <p className="report-patient-footnote">* Not recorded at this evaluation — taken from the current patient profile.</p>
                )}
            </div>

            <dl className="report-patient-assessment">
                <div>
                    <dt><IoCalendarOutline /> Evaluation</dt>
                    <dd>{formatEvaluationDate(analysis.evaluationDate)}</dd>
                </div>
                <div>
                    <dt><IoTrophyOutline /> Assessment sport</dt>
                    <dd>{data.results.snapshot.sport ?? 'Not selected'}</dd>
                </div>
                <div>
                    <dt><IoCheckmarkDoneOutline /> Boxes evaluated</dt>
                    <dd>
                        {coverage.evaluated} / {coverage.total}
                        <span className="report-patient-progress" aria-hidden="true">
                            <span style={{ width: `${(coverage.evaluated / coverage.total) * 100}%` }} />
                        </span>
                    </dd>
                </div>
                <div>
                    <dt><IoDocumentTextOutline /> Report</dt>
                    <dd>#{analysis.id} · {coverage.sources.length} data source{coverage.sources.length === 1 ? '' : 's'}</dd>
                </div>
            </dl>
        </section>
    )
}

export default ReportPatientCard
