import { IoBarChartOutline } from 'react-icons/io5'
import FlexibilityCard from './charts/FlexibilityCard'
import { ExplosivePerformanceCard, FatigueCard, StabilityBalanceCard } from './charts/MeasuredResultCards'
import MuscularBalanceCard from './charts/MuscularBalanceCard'
import CompensationMapCard from './charts/CompensationMapCard'
import RangeOfMotionCard from './charts/RangeOfMotionCard'
import BodyCompositionCard from './charts/BodyCompositionCard'
import InertialForceCard from './charts/InertialForceCard'
import { resolvePatientSnapshot, type ReportData } from './reportData'
import { hasSportReport } from './sportAssets'
import './KeyGraphsSection.css'

/** Key Graphs & Analysis — the nine result cards of the client's report layout. */
function KeyGraphsSection({ data }: { data: ReportData }) {
    const { results } = data
    const sport = resolvePatientSnapshot(data).reportSport

    return (
        <section className="analysis-section">
            <h2>
                <IoBarChartOutline /> Key Graphs &amp; Analysis
            </h2>

            <div className="key-graphs-grid">
                <FlexibilityCard index={1} flexibility={data.flexibility} />
                <ExplosivePerformanceCard index={2} results={results} />
                <FatigueCard index={3} results={results} />
                <StabilityBalanceCard index={4} results={results} />
                <MuscularBalanceCard index={5} results={results} />
                <CompensationMapCard index={6} regions={data.regions} />
                <RangeOfMotionCard index={7} results={results} />
                <BodyCompositionCard index={8} results={results} gender={data.gender} />
                <InertialForceCard index={9} sport={hasSportReport(sport) ? sport : null} />
            </div>
        </section>
    )
}

export default KeyGraphsSection
