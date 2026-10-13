import './CapacityRadarChart.css'

export interface RadarAxis {
    label: string
    value: number
}

interface CapacityRadarChartProps {
    axes: RadarAxis[]
    maxValue?: number
    size?: number
    color?: string
    className?: string
}

/**
 * Reusable N-axis radar/spider chart. Same SVG + trigonometry technique as
 * components/common/data-display/PentagonChart.tsx, generalized to an
 * arbitrary number of {label, value} axes instead of that component's
 * hardcoded 5-axis Capacidades shape (not modifying PentagonChart itself --
 * it's used elsewhere and this avoids any regression risk there).
 */
function CapacityRadarChart({ axes, maxValue = 100, size = 320, color = '#14b8a6', className = '' }: CapacityRadarChartProps) {
    const centerX = size / 2
    const centerY = size / 2
    const maxRadius = size * 0.28
    const labelOffset = maxRadius + size * 0.14
    const count = axes.length

    const angleForIndex = (index: number) => (Math.PI * 2 * index) / count - Math.PI / 2

    const calculatePoint = (index: number, value: number, radius: number) => {
        const angle = angleForIndex(index)
        const scale = Math.min(Math.max(value / maxValue, 0), 1)
        return {
            x: centerX + Math.cos(angle) * radius * scale,
            y: centerY + Math.sin(angle) * radius * scale
        }
    }

    const calculateLabelPoint = (index: number) => {
        const angle = angleForIndex(index)
        return {
            x: centerX + Math.cos(angle) * labelOffset,
            y: centerY + Math.sin(angle) * labelOffset
        }
    }

    const dataPoints = axes.map((axis, index) => {
        const point = calculatePoint(index, axis.value, maxRadius)
        const labelPoint = calculateLabelPoint(index)
        return { ...point, labelX: labelPoint.x, labelY: labelPoint.y, label: axis.label, value: axis.value }
    })

    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z'

    const guideLines = [0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => {
        const points = axes.map((_, index) => {
            const point = calculatePoint(index, maxValue, maxRadius * scale)
            return `${point.x},${point.y}`
        })
        return points.join(' ')
    })

    const radialLines = axes.map((_, index) => {
        const outer = calculatePoint(index, maxValue, maxRadius)
        return { x1: centerX, y1: centerY, x2: outer.x, y2: outer.y }
    })

    return (
        <div className={`capacity-radar-chart ${className}`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {guideLines.map((path, idx) => (
                    <polygon key={`guide-${idx}`} points={path} fill="none" className="capacity-radar-grid" strokeWidth="1" />
                ))}

                {radialLines.map((line, idx) => (
                    <line
                        key={`radial-${idx}`}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        className="capacity-radar-grid"
                        strokeWidth="1"
                    />
                ))}

                <path d={dataPath} fill={`${color}33`} stroke={color} strokeWidth="2" />

                {dataPoints.map((point, idx) => (
                    <circle key={`point-${idx}`} cx={point.x} cy={point.y} r="4" fill={color} />
                ))}

                {dataPoints.map((point, idx) => (
                    <g key={`label-${idx}`}>
                        <text x={point.labelX} y={point.labelY - 8} textAnchor="middle" className="capacity-radar-label" fontSize="11" fontWeight="bold">
                            {point.label}
                        </text>
                        <text x={point.labelX} y={point.labelY + 10} textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">
                            {point.value}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    )
}

export default CapacityRadarChart
