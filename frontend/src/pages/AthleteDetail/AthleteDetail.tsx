import { IoCalendar, IoTrendingUp, IoBody, IoCreate, IoMan, IoResize, IoBarbell, IoTrophy } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import { BreadcrumbItem } from '../../components/Breadcrumb'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { athleteAPI, analysisAPI, Athlete, Analysis } from '../../services/api'
import { usePentagonChart, usePentagonGuideLines, usePentagonRadialLines } from '../../hooks/usePentagonChart'
import { calculateAge, formatBirthDateMMDDYYYY } from '../../utils/date.utils'
import { translateBodyType, translateClassification, getClassificationBadgeClass } from '../../utils/translation.utils'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ROUTES } from '@/constants'
import './AthleteDetail.css'

function AthleteDetail() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()

    const [athlete, setAthlete] = useState<Athlete | null>(null)
    const [analyses, setAnalyses] = useState<Analysis[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>('')

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Patient and their assessments always come straight from the API into
    // local state: the global store holds the clinic-wide lists and must never
    // be overwritten with one patient's subset.
    useEffect(() => {
        if (!id) return
        let cancelled = false

        const loadAthleteData = async () => {
            try {
                setIsLoading(true)
                setError('')

                const [athleteResponse, analysesResponse] = await Promise.all([
                    athleteAPI.getById(id),
                    analysisAPI.getByAthleteId(id)
                ])
                if (cancelled) return

                setAthlete(athleteResponse.data)
                setAnalyses([...analysesResponse.data].sort((a: Analysis, b: Analysis) =>
                    new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime()
                ))
            } catch (err: any) {
                if (cancelled) return
                console.error('Error loading athlete data:', err)
                setAthlete(null)
                setError(err.response?.status === 404 ? 'Patient not found' : 'Error loading patient data')
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        loadAthleteData()
        return () => {
            cancelled = true
        }
    }, [id])

    // Calculate latest capacities from most recent analysis (before early returns for hooks)
    const latestAnalysis = analyses[0]
    const capacities = latestAnalysis ? {
        potencia: latestAnalysis.power || 0,
        fuerza: latestAnalysis.strength || 0,
        velocidad: latestAnalysis.speed || 0,
        flexibilidad: latestAnalysis.flexibility || 0,
        resistencia: latestAnalysis.endurance || 0
    } : {
        potencia: 0,
        fuerza: 0,
        velocidad: 0,
        flexibilidad: 0,
        resistencia: 0
    }

    // Pentagon chart using custom hook - MUST be called before any conditional returns
    const chartConfig = { centerX: 250, centerY: 250, maxRadius: 100, labelOffset: 60 }
    const pentagonData = usePentagonChart(capacities, chartConfig)
    const guideLines = usePentagonGuideLines(chartConfig)
    const radialLines = usePentagonRadialLines(chartConfig)

    // Early returns AFTER all hooks
    if (isLoading) {
        return (
            <PageTemplate title="Loading..." showBackButton={true}>
                <LoadingSpinner message="Loading patient data..." />
            </PageTemplate>
        )
    }

    if (error || !athlete) {
        return (
            <PageTemplate title="Error" showBackButton={true}>
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-primary)' }}>
                    <p>{error || 'Patient not found'}</p>
                </div>
            </PageTemplate>
        )
    }

    const getClassificationLabel = (classification: string | null | undefined) => {
        return translateClassification(classification)
    }

    const getBadgeClass = (classification: string | null | undefined) => {
        return getClassificationBadgeClass(classification)
    }

    const handleViewAnalysis = (analysisId: number) => {
        navigate(`/analysis-view/${analysisId}`, { state: { fromPage: 'athlete-detail', athleteId: athlete.id } })
    }

    const age = calculateAge(athlete.birthDate)
    const latestClassification = latestAnalysis?.globalClassification

    // Same breadcrumb structure regardless of where the user came from
    // (Dashboard > Recent Activity, All Patients, etc.)
    const breadcrumbItems: BreadcrumbItem[] = [
        { label: 'Patients', path: ROUTES.ALL_PATIENTS },
        { label: athlete.name }
    ]

    return (
        <PageTemplate
            title={athlete.name}
            breadcrumbItems={breadcrumbItems}
            showBackButton={true}
        >
            <div className="detail-container">
                {/* Athlete Header */}
                <div className="detail-header">
                    <div className="detail-info">
                        <div className="detail-avatar">
                            {athlete.photo ? (
                                <img src={athlete.photo} alt={athlete.name} />
                            ) : (
                                <div className="detail-avatar-placeholder">
                                    {athlete.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="detail-info-main">
                            <h1 className="detail-name">{athlete.name}</h1>
                            <p className="detail-position-club">{athlete.position || 'N/A'} • {athlete.club || 'N/A'}</p>
                            <p className="detail-code">#{athlete.accessCode}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/athletes/edit/${athlete.id}`)}
                        className="btn-edit-athlete"
                    >
                        <IoCreate /> Edit Patient
                    </button>
                </div>

                {/* Information cards */}
                <div className="detail-info-cards">
                    <div className="detail-info-card">
                        <IoCalendar className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">AGE</span>
                            <span className="card-value">{age > 0 ? `${age} years` : 'N/A'}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoCalendar className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">BIRTH DATE</span>
                            <span className="card-value-small">{formatBirthDateMMDDYYYY(athlete.birthDate)}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoMan className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">BODY TYPE</span>
                            <span className="card-value-small">{translateBodyType(athlete.bodyType)}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoResize className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">HEIGHT</span>
                            <span className="card-value">{athlete.height ? `${athlete.height} ft` : 'N/A'}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoBarbell className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">WEIGHT</span>
                            <span className="card-value">{athlete.weight ? `${athlete.weight} lbs` : 'N/A'}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoBody className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">TOTAL ANALYSES</span>
                            <span className="card-value">{analyses.length}</span>
                        </div>
                    </div>

                    <div className="detail-info-card">
                        <IoTrophy className="card-icon" />
                        <div className="card-content">
                            <span className="card-label">RECENT CLASSIFICATION</span>
                            <span className={`badge ${getBadgeClass(latestClassification)} `}>
                                {getClassificationLabel(latestClassification)}
                            </span>
                        </div>
                    </div>

                    {latestAnalysis?.cohortClassification && (
                        <div className="detail-info-card">
                            <IoTrendingUp className="card-icon" />
                            <div className="card-content">
                                <span className="card-label">COHORT CLASSIFICATION</span>
                                <span className={`badge cohort - ${latestAnalysis.cohortClassification.toLowerCase()} `}>
                                    {latestAnalysis.cohortClassification}
                                </span>
                            </div>
                        </div>
                    )}
                </div >

                {/* Current Physical Capacities */}
                {
                    analyses.length > 0 && (
                        <div className="detail-section">
                            <h2 className="section-title">
                                <IoBody />
                                Current Physical Capacities
                            </h2>
                            <div className="pentagon-chart-container">
                                <svg width="100%" height="100%" viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet">
                                    {/* Guide lines (20%, 40%, 60%, 80%, 100%) */}
                                    {guideLines.map((path, idx) => (
                                        <polygon
                                            key={`guide - ${idx} `}
                                            points={path}
                                            fill="none"
                                            stroke="rgba(255, 255, 255, 0.1)"
                                            strokeWidth="1"
                                        />
                                    ))}

                                    {/* Radial lines from center to vertices */}
                                    {radialLines.map((line, i) => (
                                        <line
                                            key={`radial - ${i} `}
                                            x1={line.x1}
                                            y1={line.y1}
                                            x2={line.x2}
                                            y2={line.y2}
                                            stroke="rgba(255, 255, 255, 0.1)"
                                            strokeWidth="1"
                                        />
                                    ))}

                                    {/* Athlete data polygon */}
                                    <polygon
                                        points={pentagonData.pointsPath}
                                        fill="rgba(20, 184, 166, 0.3)"
                                        stroke="#14b8a6"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                    />

                                    {/* Points at vertices */}
                                    {pentagonData.points.map((point, idx) => (
                                        <circle
                                            key={`point - ${idx} `}
                                            cx={point.x}
                                            cy={point.y}
                                            r="5"
                                            fill="#14b8a6"
                                            stroke="#0a0a0a"
                                            strokeWidth="2"
                                        />
                                    ))}

                                    {/* Labels and values with backgrounds */}
                                    {pentagonData.points.map((point, idx) => (
                                        <g key={`label - ${idx} `}>
                                            {/* Label background */}
                                            <rect
                                                x={point.labelX - 45}
                                                y={point.labelY - 24}
                                                width="90"
                                                height="42"
                                                fill="rgba(0, 0, 0, 0.85)"
                                                rx="8"
                                                stroke="rgba(20, 184, 166, 0.4)"
                                                strokeWidth="1.5"
                                            />
                                            {/* Label text */}
                                            <text
                                                x={point.labelX}
                                                y={point.labelY - 6}
                                                textAnchor="middle"
                                                fill="white"
                                                fontSize="14"
                                                fontWeight="700"
                                            >
                                                {point.nombre}
                                            </text>
                                            {/* Value text */}
                                            <text
                                                x={point.labelX}
                                                y={point.labelY + 12}
                                                textAnchor="middle"
                                                fill="#14b8a6"
                                                fontSize="17"
                                                fontWeight="700"
                                            >
                                                {point.valor}
                                            </text>
                                        </g>
                                    ))}
                                </svg>
                            </div>
                        </div>
                    )
                }

                {/* Improvement Timeline */}
                {analyses.length > 1 && (
                    <div className="detail-section">
                        <h2 className="section-title">
                            <IoTrendingUp />
                            Improvement Timeline
                        </h2>
                        <div className="abilities-timeline-container">
                            <svg width="100%" height="300" viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet">
                                {/* Grid horizontal lines */}
                                {[0, 25, 50, 75, 100].map((y) => (
                                    <line
                                        key={`grid - ${y} `}
                                        x1="60"
                                        y1={260 - (y * 2)}
                                        x2="840"
                                        y2={260 - (y * 2)}
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth="1"
                                        strokeDasharray="5,5"
                                    />
                                ))}

                                {/* Y-axis labels */}
                                {[0, 25, 50, 75, 100].map((value) => (
                                    <text
                                        key={`y - label - ${value} `}
                                        x="45"
                                        y={265 - (value * 2)}
                                        fill="rgba(255, 255, 255, 0.5)"
                                        fontSize="11"
                                        textAnchor="end"
                                    >
                                        {value}
                                    </text>
                                ))}

                                {/* Líneas de capacidades */}
                                {analyses.length > 0 && (
                                    <>
                                        {/* Fuerza - Rojo */}
                                        {analyses.slice(0, 5).some(a => a.strength !== null && a.strength !== undefined) && (
                                            <>
                                                <polyline
                                                    points={analyses.slice(0, 5).reverse().map((a, i) =>
                                                        `${60 + (i * 195)},${260 - ((a.strength || 0) * 2)} `
                                                    ).join(' ')}
                                                    fill="none"
                                                    stroke="#ef4444"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                                {analyses.slice(0, 5).reverse().map((a, i) => (
                                                    <circle
                                                        key={`fuerza - ${i} `}
                                                        cx={60 + (i * 195)}
                                                        cy={260 - ((a.strength || 0) * 2)}
                                                        r="5"
                                                        fill="#ef4444"
                                                        stroke="#0a0a0a"
                                                        strokeWidth="2"
                                                    />
                                                ))}
                                            </>
                                        )}

                                        {/* Velocidad - Cyan */}
                                        {analyses.slice(0, 5).some(a => a.speed !== null && a.speed !== undefined) && (
                                            <>
                                                <polyline
                                                    points={analyses.slice(0, 5).reverse().map((a, i) =>
                                                        `${60 + (i * 195)},${260 - ((a.speed || 0) * 2)} `
                                                    ).join(' ')}
                                                    fill="none"
                                                    stroke="#06b6d4"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                                {analyses.slice(0, 5).reverse().map((a, i) => (
                                                    <circle
                                                        key={`velocidad - ${i} `}
                                                        cx={60 + (i * 195)}
                                                        cy={260 - ((a.speed || 0) * 2)}
                                                        r="5"
                                                        fill="#06b6d4"
                                                        stroke="#0a0a0a"
                                                        strokeWidth="2"
                                                    />
                                                ))}
                                            </>
                                        )}

                                        {/* Resistencia - Verde */}
                                        {analyses.slice(0, 5).some(a => a.endurance !== null && a.endurance !== undefined) && (
                                            <>
                                                <polyline
                                                    points={analyses.slice(0, 5).reverse().map((a, i) =>
                                                        `${60 + (i * 195)},${260 - ((a.endurance || 0) * 2)} `
                                                    ).join(' ')}
                                                    fill="none"
                                                    stroke="#10b981"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                                {analyses.slice(0, 5).reverse().map((a, i) => (
                                                    <circle
                                                        key={`resistencia - ${i} `}
                                                        cx={60 + (i * 195)}
                                                        cy={260 - ((a.endurance || 0) * 2)}
                                                        r="5"
                                                        fill="#10b981"
                                                        stroke="#0a0a0a"
                                                        strokeWidth="2"
                                                    />
                                                ))}
                                            </>
                                        )}

                                        {/* Flexibilidad - Amarillo */}
                                        {analyses.slice(0, 5).some(a => a.flexibility !== null && a.flexibility !== undefined) && (
                                            <>
                                                <polyline
                                                    points={analyses.slice(0, 5).reverse().map((a, i) =>
                                                        `${60 + (i * 195)},${260 - ((a.flexibility || 0) * 2)} `
                                                    ).join(' ')}
                                                    fill="none"
                                                    stroke="#f59e0b"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                                {analyses.slice(0, 5).reverse().map((a, i) => (
                                                    <circle
                                                        key={`flexibilidad - ${i} `}
                                                        cx={60 + (i * 195)}
                                                        cy={260 - ((a.flexibility || 0) * 2)}
                                                        r="5"
                                                        fill="#f59e0b"
                                                        stroke="#0a0a0a"
                                                        strokeWidth="2"
                                                    />
                                                ))}
                                            </>
                                        )}

                                        {/* Potencia - Morado */}
                                        {analyses.slice(0, 5).some(a => a.power !== null && a.power !== undefined) && (
                                            <>
                                                <polyline
                                                    points={analyses.slice(0, 5).reverse().map((a, i) =>
                                                        `${60 + (i * 195)},${260 - ((a.power || 0) * 2)} `
                                                    ).join(' ')}
                                                    fill="none"
                                                    stroke="#a855f7"
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                                {analyses.slice(0, 5).reverse().map((a, i) => (
                                                    <circle
                                                        key={`potencia - ${i} `}
                                                        cx={60 + (i * 195)}
                                                        cy={260 - ((a.power || 0) * 2)}
                                                        r="5"
                                                        fill="#a855f7"
                                                        stroke="#0a0a0a"
                                                        strokeWidth="2"
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </>
                                )}
                            </svg>

                            {/* Leyenda */}
                            <div className="abilities-legend">
                                <div className="legend-item-ability">
                                    <div className="legend-color-box" style={{ backgroundColor: '#ef4444' }}></div>
                                    <span>Strength</span>
                                </div>
                                <div className="legend-item-ability">
                                    <div className="legend-color-box" style={{ backgroundColor: '#06b6d4' }}></div>
                                    <span>Speed</span>
                                </div>
                                <div className="legend-item-ability">
                                    <div className="legend-color-box" style={{ backgroundColor: '#10b981' }}></div>
                                    <span>Endurance</span>
                                </div>
                                <div className="legend-item-ability">
                                    <div className="legend-color-box" style={{ backgroundColor: '#f59e0b' }}></div>
                                    <span>Flexibility</span>
                                </div>
                                <div className="legend-item-ability">
                                    <div className="legend-color-box" style={{ backgroundColor: '#a855f7' }}></div>
                                    <span>Power</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Analysis History */}
                <div className="detail-section">
                    <h2 className="section-title">
                        <IoCalendar />
                        Analysis History
                    </h2>
                    <div className="historial-table-container">
                        <table className="historial-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Classification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analyses.map((analysis) => (
                                    <tr
                                        key={analysis.id}
                                        className="clickable-row"
                                        onClick={() => handleViewAnalysis(analysis.id)}
                                    >
                                        <td>{new Date(analysis.evaluationDate).toLocaleDateString('en-US')}</td>
                                        <td>
                                            <span className={`badge ${getBadgeClass(analysis.globalClassification)} `}>
                                                {getClassificationLabel(analysis.globalClassification)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div >
        </PageTemplate >
    )
}

export default AthleteDetail
