import { IoListOutline, IoContractOutline, IoBulbOutline, IoClipboardOutline } from 'react-icons/io5'
import ProgressOverTimeCard from './charts/ProgressOverTimeCard'
import { buildProgressRows, type ReportData } from './reportData'
import './DetailedAnalysisSection.css'

function BulletColumn({ icon, title, items, emptyText, footnote }: {
    icon: React.ReactNode
    title: string
    items: string[]
    emptyText: string
    footnote?: string
}) {
    return (
        <div className="detailed-analysis-column">
            <h3>{icon} {title}</h3>
            {items.length === 0 ? (
                <p className="detailed-analysis-empty">{emptyText}</p>
            ) : (
                <ul>
                    {items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                    ))}
                </ul>
            )}
            {footnote && <p className="detailed-analysis-footnote">{footnote}</p>}
        </div>
    )
}

function splitLines(text: string | null | undefined): string[] {
    return (text ?? '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
        .filter(Boolean)
}

/**
 * Detailed Analysis — points to improve come only from documented findings,
 * tension/shortening only from a specific evaluation, and recommendations
 * are the professional's own, linked to those findings.
 */
function DetailedAnalysisSection({ data }: { data: ReportData }) {
    const improvementPoints = data.findings.map((f) => f.text)
    const tension = data.results.tensionShortening
    const tensionItems = splitLines(tension.notes)
    const recommendations = splitLines(data.analysis.coachRecommendations)
    const progressRows = buildProgressRows(data)

    return (
        <section className="analysis-section">
            <h2>
                <IoClipboardOutline /> Detailed Analysis
            </h2>

            <div className="detailed-analysis-columns">
                <BulletColumn
                    icon={<IoListOutline />}
                    title="Weak Points / Limitations"
                    items={improvementPoints}
                    emptyText="No limitations documented in the evaluated boxes."
                />
                <BulletColumn
                    icon={<IoContractOutline />}
                    title="Muscle Tightness / Restrictions"
                    items={tensionItems}
                    emptyText="Not evaluated — requires a specific evaluation."
                    footnote={tensionItems.length > 0 && tension.source ? `Source: ${tension.source}` : undefined}
                />
                <BulletColumn
                    icon={<IoBulbOutline />}
                    title="Key Recommendations"
                    items={recommendations}
                    emptyText="No recommendations recorded."
                    footnote={recommendations.length > 0 ? 'Written and reviewed by the professional.' : undefined}
                />
            </div>

            {/* Only comparable earlier visits (same variable, unit and protocol, a week or more apart) */}
            {progressRows.length > 0 && (
                <div className="detailed-analysis-progress">
                    <ProgressOverTimeCard rows={progressRows} />
                </div>
            )}
        </section>
    )
}

export default DetailedAnalysisSection
