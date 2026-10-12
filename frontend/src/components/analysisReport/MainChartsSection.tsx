import { IoBarChartOutline } from 'react-icons/io5'
import FlexibilityCard from './charts/FlexibilityCard'
import { BalanceCard, ExplosivePerformanceCard, FallRiskCard, FatigueCard, GaitSpeedCard } from './charts/MeasuredResultCards'
import RangeOfMotionCard from './charts/RangeOfMotionCard'
import MuscularBalanceCard from './charts/MuscularBalanceCard'
import BodyCompositionCard from './charts/BodyCompositionCard'
import CompensationMapCard from './charts/CompensationMapCard'
import ProgressOverTimeCard from './charts/ProgressOverTimeCard'
import { buildProgressRows, type ReportData } from './reportData'
import './MainChartsSection.css'

/** Results in detail — one card per report box plus the complementary blocks. */
function MainChartsSection({ data }: { data: ReportData }) {
    const { results } = data

    return (
        <section className="analysis-section">
            <h2>
                <IoBarChartOutline /> Results in Detail
            </h2>

            <div className="main-charts-grid">
                <FlexibilityCard flexibility={data.flexibility} />
                <ExplosivePerformanceCard results={results} />
                <FatigueCard results={results} />
                <BalanceCard results={results} />
                <GaitSpeedCard results={results} />
                <FallRiskCard results={results} />
                <RangeOfMotionCard results={results} />
                <MuscularBalanceCard results={results} />
                <BodyCompositionCard results={results} gender={data.gender} />
                <CompensationMapCard regions={data.regions} />
                <ProgressOverTimeCard rows={buildProgressRows(data)} />
            </div>
        </section>
    )
}

export default MainChartsSection
