import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoClose } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import { SearchBar } from '@/components/common/data-display/SearchBar'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import SortableTableHeader from '@/components/common/data-display/SortableTableHeader'
import Pagination from '@/components/common/navigation/Pagination'
import { useDebounce, usePagination, useSort } from '../../hooks'
import { athleteAPI, analysisAPI } from '../../services/api'
import type { Athlete, Analysis } from '../../services/api'
import './AllAnalyses.css'

type SortField = 'athlete' | 'classification' | 'date'

interface AthleteWithAnalysis {
    athlete: Athlete
    latestAnalysis: Analysis
}

function AllAnalyses() {
    const navigate = useNavigate()

    // Search and filters
    const [searchTerm, setSearchTerm] = useState('')
    const [classificationFilter, setClassificationFilter] = useState('')
    const [dateFilter, setDateFilter] = useState('')

    // Data state
    const [athletesWithAnalyses, setAthletesWithAnalyses] = useState<AthleteWithAnalysis[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>('')

    // Debounce search
    const debouncedSearch = useDebounce(searchTerm, 300)

    // Sorting
    const { sortField, sortDirection, handleSort } = useSort<SortField>('athlete')

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Load data
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setIsLoading(true)
            setError('')

            // Fetch all athletes and analyses
            const [athletesResponse, analysesResponse] = await Promise.all([
                athleteAPI.getAll(),
                analysisAPI.getAll()
            ])

            // Group analyses by athlete and keep the latest one. Athlete IDs are
            // UUID strings: keying by Number(id) would turn every one into NaN
            // and collapse all patients onto a single assessment.
            const athleteAnalysisMap = new Map<string, Analysis>()

            analysesResponse.data.forEach((analysis) => {
                const existingAnalysis = athleteAnalysisMap.get(analysis.athleteId)
                if (!existingAnalysis || new Date(analysis.evaluationDate) > new Date(existingAnalysis.evaluationDate)) {
                    athleteAnalysisMap.set(analysis.athleteId, analysis)
                }
            })

            // Only patients that actually have at least one assessment
            const combined: AthleteWithAnalysis[] = athletesResponse.data
                .filter(athlete => athleteAnalysisMap.has(athlete.id))
                .map(athlete => ({
                    athlete,
                    latestAnalysis: athleteAnalysisMap.get(athlete.id)!
                }))

            setAthletesWithAnalyses(combined)
        } catch (err) {
            console.error('Error loading data:', err)
                    setError('Error loading data. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    // Apply filters and sorting
    const filteredAthletes = useMemo(() => {
        let result = [...athletesWithAnalyses]

        // Search filter
        if (debouncedSearch) {
            result = result.filter(item =>
                item.athlete.name.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
        }

        // Classification filter
        if (classificationFilter) {
            result = result.filter(item =>
                item.latestAnalysis.globalClassification === classificationFilter
            )
        }

        // Date filter (month/year)
        if (dateFilter) {
            result = result.filter(item => {
                const date = new Date(item.latestAnalysis.evaluationDate)
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                return dateStr === dateFilter
            })
        }

        // Sorting
        result.sort((a, b) => {
            let comparison = 0
            switch (sortField) {
                case 'athlete':
                    comparison = a.athlete.name.localeCompare(b.athlete.name)
                    break
                case 'classification':
                    const order: Record<string, number> = { 'high': 3, 'medium': 2, 'low': 1 }
                    const aVal = order[a.latestAnalysis.globalClassification || 'medium']
                    const bVal = order[b.latestAnalysis.globalClassification || 'medium']
                    comparison = aVal - bVal
                    break
                case 'date':
                    comparison = new Date(b.latestAnalysis.evaluationDate).getTime() - new Date(a.latestAnalysis.evaluationDate).getTime()
                    break
            }
            return sortDirection === 'asc' ? comparison : -comparison
        })

        return result
    }, [athletesWithAnalyses, debouncedSearch, classificationFilter, dateFilter, sortField, sortDirection])

    // Pagination
    const {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
        nextPage,
        previousPage,
        startIndex,
        endIndex
    } = usePagination(filteredAthletes, 10)

    const handleViewDetails = (item: AthleteWithAnalysis) => {
        navigate(`/athlete-detail/${item.athlete.id}`, { state: { from: 'all-analyses' } })
    }

    const clearFilters = () => {
        setClassificationFilter('')
        setDateFilter('')
        setSearchTerm('')
    }

    const getBadgeClass = (classification: string | null | undefined) => {
        if (classification === 'high') return 'badge-high'
        if (classification === 'medium') return 'badge-medium'
        return 'badge-low'
    }

    const getClassificationLabel = (classification: string | null | undefined) => {
        if (classification === 'high') return 'Above Average'
        if (classification === 'medium') return 'Average'
        if (classification === 'low') return 'Below Average'
        return 'Unclassified'
    }

    return (
        <PageTemplate
            title="All Assessments"
            className="all-analyses-page"
            showBackButton={true}
            breadcrumbItems={[
                    { label: 'Assessments', path: '/analysis' },
                    { label: 'All Assessments' }
            ]}
        >
            {/* Search and Filters */}
            <div className="all-analyses-header">
                <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by patient..."
                />

                <div className="filters-container">
                    <select
                        className="filter-select"
                        value={classificationFilter}
                        onChange={(e) => setClassificationFilter(e.target.value)}
                    >
                        <option value="">All classifications</option>
                        <option value="high">Above Average</option>
                        <option value="medium">Average</option>
                        <option value="low">Below Average</option>
                    </select>

                    {(classificationFilter || dateFilter || searchTerm) && (
                        <button className="btn-clear-filters" onClick={clearFilters}>
                            <IoClose /> Clear filters
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="all-analyses-content">
                {isLoading ? (
                    <LoadingSpinner message="Loading analyses..." />
                ) : error ? (
                    <div className="error-state">{error}</div>
                ) : (
                    <>
                        <div className="analyses-table-container">
                            <table className="analyses-table">
                                <thead>
                                    <tr>
                                        <SortableTableHeader
                                            field="athlete"
                                            label="Patient"
                                            currentSortField={sortField}
                                            currentSortDirection={sortDirection}
                                            onSort={() => handleSort('athlete')}
                                        />
                                        <SortableTableHeader
                                            field="classification"
                                            label="Classification"
                                            currentSortField={sortField}
                                            currentSortDirection={sortDirection}
                                            onSort={() => handleSort('classification')}
                                        />
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedItems.length > 0 ? (
                                        paginatedItems.map(item => (
                                            <tr
                                                key={item.athlete.id}
                                                className="clickable-row"
                                                onClick={() => handleViewDetails(item)}
                                            >
                                                <td>
                                                    <div className="athlete-cell">
                                                        <div className="athlete-avatar">
                                                            {item.athlete.name.charAt(0)}
                                                        </div>
                                                        <span className="athlete-name">{item.athlete.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getBadgeClass(item.latestAnalysis.globalClassification)}`}>
                                                        {getClassificationLabel(item.latestAnalysis.globalClassification)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                                <td colSpan={2} className="no-results">
                                                No patients found with the applied filters
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={goToPage}
                                onNext={nextPage}
                                onPrevious={previousPage}
                            />
                        )}

                        <div className="results-info">
                            Showing {startIndex + 1}-{Math.min(endIndex, filteredAthletes.length)} of {filteredAthletes.length} patients
                        </div>
                    </>
                )}
            </div>
        </PageTemplate>
    )
}

export default AllAnalyses
