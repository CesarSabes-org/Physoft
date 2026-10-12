import { IoListOutline, IoContractOutline, IoBulbOutline } from 'react-icons/io5'
import type { ReportData } from './reportData'
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

    return (
        <section className="analysis-section">
            <h2>Detailed Analysis</h2>

            <div className="detailed-analysis-columns">
                <BulletColumn
                    icon={<IoListOutline />}
                    title="Points to Improve"
                    items={improvementPoints}
                    emptyText="No limitations documented in the evaluated boxes."
                />
                <BulletColumn
                    icon={<IoContractOutline />}
                    title="Muscle Tension / Shortening"
                    items={tensionItems}
                    emptyText="Not evaluated — requires a specific evaluation."
                    footnote={tensionItems.length > 0 && tension.source ? `Source: ${tension.source}` : undefined}
                />
                <BulletColumn
                    icon={<IoBulbOutline />}
                    title="Main Recommendations"
                    items={recommendations}
                    emptyText="No recommendations recorded."
                    footnote={recommendations.length > 0 ? 'Written and reviewed by the professional.' : undefined}
                />
            </div>
        </section>
    )
}

export default DetailedAnalysisSection
