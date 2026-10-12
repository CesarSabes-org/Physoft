import { IoFitnessOutline } from 'react-icons/io5'
import { StatusTag, TONE_COLORS } from './charts/ReportCard'
import { summarizeBoxes, type ReportData } from './reportData'
import './ResultsOverviewGrid.css'

/** One card per report box (1-9): main value, rule-based result and source. */
function ResultsOverviewGrid({ data }: { data: ReportData }) {
    const boxes = summarizeBoxes(data)

    return (
        <section className="analysis-section">
            <h2>
                <IoFitnessOutline /> Results Overview
            </h2>

            <div className="results-overview-grid">
                {boxes.map((box) => {
                    const color = TONE_COLORS[box.tone]
                    return (
                        <div key={box.key} className="results-overview-card" style={{ borderTopColor: color }}>
                            <div className="results-overview-head">
                                <span className="results-overview-number" style={{ color, borderColor: `${color}66` }}>{box.box}</span>
                                <span className="results-overview-title">{box.title}</span>
                            </div>
                            <span className={`results-overview-value ${box.tone === 'muted' ? 'is-muted' : ''}`}>{box.value}</span>
                            {box.detail && <span className="results-overview-detail" style={{ color: box.tone === 'muted' ? undefined : color }}>{box.detail}</span>}
                            <div className="results-overview-foot">
                                <StatusTag status={box.status} />
                                {box.source && box.status !== 'NOT_EVALUATED' && <span className="results-overview-source">{box.source}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

export default ResultsOverviewGrid
