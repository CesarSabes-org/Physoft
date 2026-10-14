import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoSearch, IoFitness, IoTrendingUp, IoDocument } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import type { Analysis as AnalysisType } from '../../services/api'
import { useAnalysisStore } from '@/store/analysisStore'
import { ROUTES } from '../../constants'
import './Analysis.css'

const DAY_MS = 24 * 60 * 60 * 1000
const RECENT_LIMIT = 5

function Analysis() {
    const navigate = useNavigate()
    const [busqueda, setBusqueda] = useState('')

    const { analyses, loading, error, fetchAnalyses } = useAnalysisStore()

    // Always refresh on mount; cached data stays on screen meanwhile
    useEffect(() => {
        fetchAnalyses()
    }, [fetchAnalyses])

    // Same definition as the Dashboard: evaluations in the last 7 days
    const stats = useMemo(() => {
        const now = Date.now()
        return {
            total: analyses.length,
            thisWeek: analyses.filter((a: AnalysisType) => {
                const age = now - new Date(a.evaluationDate).getTime()
                return age >= 0 && age <= 7 * DAY_MS
            }).length,
            // Patients with at least one assessment (not every registered patient)
            athletes: new Set(analyses.map((a: AnalysisType) => a.athleteId)).size
        }
    }, [analyses])

    const getClassificationBadge = (classification: string | null | undefined) => {
        if (!classification) return 'average'
        if (classification === 'high') return 'above'
        if (classification === 'low') return 'below'
        return 'average'
    }

    const getClassificationText = (classification: string | null | undefined) => {
        if (!classification) return 'Average'
        if (classification === 'high') return 'Above Average'
        if (classification === 'low') return 'Below Average'
        return 'Average'
    }

    // Search across every assessment (the store keeps them newest first), then show the latest matches
    const filteredAnalyses = analyses
        .filter((analysis: AnalysisType) =>
            !busqueda ||
            analysis.athlete?.name.toLowerCase().includes(busqueda.toLowerCase()) ||
            analysis.athlete?.accessCode.includes(busqueda)
        )
        .slice(0, RECENT_LIMIT)

    const handleCrearAnalisis = () => {
        navigate(ROUTES.NEW_ANALYSIS)
    }

    const handleViewAnalysis = (analysis: AnalysisType) => {
        navigate(`/analysis-view/${analysis.id}`)
    }

    return (
        <PageTemplate
            title="Kinesiology Analysis"
            subtitle="Manage and create comprehensive sports assessments"
            className="analisis-page"
            showAddButton={true}
            onAddClick={handleCrearAnalisis}
            addButtonText="Create New Assessment"
        >
            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)' }}>
                        <IoDocument style={{ color: 'var(--primary-color)' }} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '...' : stats.total}</h3>
                        <p>Total Assessments</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.1)' }}>
                        <IoTrendingUp style={{ color: '#34d399' }} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '...' : stats.thisWeek}</h3>
                        <p>This Week</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(96, 165, 250, 0.1)' }}>
                        <IoFitness style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="stat-info">
                        <h3>{loading ? '...' : stats.athletes}</h3>
                        <p>Patients Assessed</p>
                    </div>
                </div>
            </div>

            {/* Análisis recientes */}
            <div className="analisis-section">
                <div className="section-header">
                    <h2 className="section-title">Recent Assessments</h2>
                    <div className="search-small">
                        <IoSearch className="search-icon-small" />
                        <input
                            type="text"
                            placeholder="Search assessments..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="search-input-small"
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p>Loading analyses...</p>
                    </div>
                ) : error && analyses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p>Error loading assessments. Check your connection and reload the page.</p>
                    </div>
                ) : filteredAnalyses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p>{busqueda ? 'No assessments match your search' : 'No recent assessments'}</p>
                    </div>
                ) : (
                    <>
                        <div className="analisis-table-container">
                            <table className="analisis-table">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Date</th>
                                        <th>Classification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAnalyses.map((analysis: AnalysisType) => (
                                        <tr
                                            key={analysis.id}
                                            className="clickable-row"
                                            onClick={() => handleViewAnalysis(analysis)}
                                        >
                                            <td>
                                                <div className="atleta-cell">
                                                    <div className="atleta-avatar">
                                                        {analysis.athlete?.name.charAt(0) || '?'}
                                                    </div>
                                                    <span className="atleta-nombre">{analysis.athlete?.name || 'Unknown patient'}</span>
                                                </div>
                                            </td>
                                            <td>{new Date(analysis.evaluationDate).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`badge badge-${getClassificationBadge(analysis.globalClassification)}`}>
                                                    {getClassificationText(analysis.globalClassification)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Botón Ver Todos */}
                        <div className="ver-todos-container">
                            <button
                                className="btn-ver-todos"
                                onClick={() => navigate('/all-analyses')}
                            >
                                View All
                            </button>
                        </div>
                    </>
                )}
            </div>
        </PageTemplate>
    )
}

export default Analysis
