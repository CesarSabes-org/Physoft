import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoSparklesOutline } from 'react-icons/io5'
import PageTemplate from '@/components/templates/PageTemplate'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import MiniChatPanel from '@/components/analysis/MiniChatPanel'
import { analysisAPI, FLEXIBILITY_EXERCISE_IDS, type AIAnalysisResult, type FlexibilityAssessmentResult, type FlexibilityExerciseId } from '@/services/api'
import { useAnalysisStore } from '@/store/analysisStore'
import { useAIAnalysisResults, useClinicalResultsForm, useFlexibilityAssessmentForm } from '@/hooks'
import ClinicalResultsSection from '@/components/analysis/clinicalResults/ClinicalResultsSection'
import AssessmentSportSelect from '@/components/analysis/AssessmentSportSelect'
import type { ClinicalResults } from '@/types/clinicalResults.types'
import { CLINICAL_SECTIONS, sectionHasData } from '@/utils/clinicalScoring'
import { WeakPointsList } from '@/components/analysis/WeakPointsList'
import { PhysicalCapacitiesForm } from '@/components/analysis/PhysicalCapacitiesForm'
import { AnalysisFieldsForm } from '@/components/analysis/AnalysisFieldsForm'
import FlexibilityAssessmentSection from '@/components/analysis/FlexibilityAssessmentSection'
import DateInputMMDDYYYY from '@/components/common/forms/DateInputMMDDYYYY'
import { localDateTimeToISO, toLocalDateTimeParts } from '@/utils/date.utils'
import './EditAnalysis.css'

interface PuntoDebil {
    id: number
    area: string
    descripcion: string
}

interface CapacidadesFisicas {
    potencia: number
    resistencia: number
    fuerza: number
    flexibilidad: number
    velocidad: number
}

function EditAnalysis() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { updateAnalysis: updateAnalysisInStore } = useAnalysisStore()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [proximoIdPuntoDebil, setProximoIdPuntoDebil] = useState(1)
    const [athleteName, setAthleteName] = useState('')
    const [aiAnalysisResults, setAiAnalysisResults] = useState<AIAnalysisResult[]>([])

    const { results: aiResults, saveEdit: saveAiEdit } = useAIAnalysisResults(
        id ? parseInt(id) : 0,
        aiAnalysisResults
    )

    // Flexibility Assessment: ratings are deferred to the main Save Changes
    // submit (like every other field on this page); evidence photo
    // upload/replace/remove persist immediately, mirroring how AI results
    // save inline above.
    const [flexibilityInitial, setFlexibilityInitial] = useState<FlexibilityAssessmentResult[] | null>(null)
    const flexibilityForm = useFlexibilityAssessmentForm(flexibilityInitial)
    const [flexibilityEvidenceBusy, setFlexibilityEvidenceBusy] = useState<Partial<Record<FlexibilityExerciseId, boolean>>>({})
    const [flexibilityEvidenceErrors, setFlexibilityEvidenceErrors] = useState<Partial<Record<FlexibilityExerciseId, string | null>>>({})

    // Measured/observed results (report boxes 2-9), saved with the main Save Changes submit
    const [clinicalInitial, setClinicalInitial] = useState<ClinicalResults | null>(null)
    const clinicalForm = useClinicalResultsForm(clinicalInitial)
    const [athleteGender, setAthleteGender] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        // Local date ('YYYY-MM-DD') and time ('HH:mm') of the evaluation
        fechaEvaluacion: '',
        horaEvaluacion: '',
        analisisFlexibilidad: '',
        analisisBiobit: '',
        asimetriaMuscular: '',
        controlMotorActivo: '',
        fatigaMuscular: '',
        controlFuerzaInercia: '',
        puntosDebiles: [] as PuntoDebil[],
        capacidadesFisicas: {
            potencia: 0,
            resistencia: 0,
            fuerza: 0,
            flexibilidad: 0,
            velocidad: 0
        } as CapacidadesFisicas,
        clasificacionCohorte: '',
        recomendaciones: ''
    })

    useEffect(() => {
        if (id) {
            loadAnalysis(parseInt(id))
        }
    }, [id])

    const loadAnalysis = async (analysisId: number) => {
        try {
            setLoading(true)
            const response = await analysisAPI.getById(analysisId)
            const analysis = response.data

            // Parse weak points from JSON string to array
            let parsedWeakPoints: PuntoDebil[] = []
            if (analysis.weakPoints) {
                try {
                    const weakPointsData = JSON.parse(analysis.weakPoints)
                    parsedWeakPoints = weakPointsData.map((wp: any, index: number) => ({
                        id: index + 1,
                        area: wp.area || '',
                        descripcion: wp.descripcion || ''
                    }))
                    setProximoIdPuntoDebil(parsedWeakPoints.length + 1)
                } catch (e) {
                    console.error('Error parsing weak points:', e)
                }
            }

            // Set athlete name for breadcrumbs
            if (analysis.athlete?.name) {
                setAthleteName(analysis.athlete.name)
            }

            setAiAnalysisResults(analysis.aiAnalysisResults || [])
            setFlexibilityInitial(analysis.flexibilityAssessment || null)
            setClinicalInitial(analysis.clinicalResults || null)
            setAthleteGender(analysis.athlete?.gender ?? null)

            const evaluationParts = toLocalDateTimeParts(analysis.evaluationDate)
            setFormData({
                fechaEvaluacion: evaluationParts.date,
                horaEvaluacion: evaluationParts.time,
                analisisFlexibilidad: analysis.flexibilityAnalysis || '',
                analisisBiobit: analysis.biobitAnalysis || '',
                asimetriaMuscular: analysis.muscularAsymmetry || '',
                controlMotorActivo: analysis.activeMotorControl || '',
                fatigaMuscular: analysis.functionalMuscleFatigue || '',
                controlFuerzaInercia: analysis.inertiaForceControl || '',
                puntosDebiles: parsedWeakPoints,
                capacidadesFisicas: {
                    potencia: analysis.power || 0,
                    resistencia: analysis.endurance || 0,
                    fuerza: analysis.strength || 0,
                    flexibilidad: analysis.flexibility || 0,
                    velocidad: analysis.speed || 0
                },
                // Only the cohort value: seeding from globalClassification ('low'/'medium'/'high')
                // would save it back into cohortClassification on the next submit
                clasificacionCohorte: analysis.cohortClassification || '',
                recomendaciones: analysis.coachRecommendations || ''
            })
        } catch (error) {
            console.error('Error loading analysis:', error)
            setMensaje({ tipo: 'error', texto: 'Error loading analysis' })
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleCapacidadChange = (capacidad: keyof CapacidadesFisicas, value: number) => {
        setFormData(prev => ({
            ...prev,
            capacidadesFisicas: {
                ...prev.capacidadesFisicas,
                [capacidad]: value
            }
        }))
    }

    const handleAgregarPuntoDebil = () => {
        const nuevoPunto: PuntoDebil = {
            id: proximoIdPuntoDebil,
            area: '',
            descripcion: ''
        }
        setFormData(prev => ({
            ...prev,
            puntosDebiles: [...prev.puntosDebiles, nuevoPunto]
        }))
        setProximoIdPuntoDebil(prev => prev + 1)
    }

    const handleEliminarPuntoDebil = (id: number) => {
        setFormData(prev => ({
            ...prev,
            puntosDebiles: prev.puntosDebiles.filter(p => p.id !== id)
        }))
    }

    const handlePuntoDebilChange = (id: number, field: 'area' | 'descripcion', value: string) => {
        setFormData(prev => ({
            ...prev,
            puntosDebiles: prev.puntosDebiles.map(p =>
                p.id === id ? { ...p, [field]: value } : p
            )
        }))
    }

    const handleFlexibilityEvidenceSelect = async (exerciseId: FlexibilityExerciseId, file: File) => {
        if (!id) return
        setFlexibilityEvidenceErrors(prev => ({ ...prev, [exerciseId]: null }))
        setFlexibilityEvidenceBusy(prev => ({ ...prev, [exerciseId]: true }))
        try {
            const response = await analysisAPI.uploadFlexibilityEvidence(parseInt(id), exerciseId, file)
            const saved = response.data.flexibilityAssessment?.find(item => item.exerciseId === exerciseId)
            flexibilityForm.setEvidenceUrl(exerciseId, saved?.evidenceUrl ?? null)
            updateAnalysisInStore(parseInt(id), response.data)
        } catch (error: any) {
            setFlexibilityEvidenceErrors(prev => ({
                ...prev,
                [exerciseId]: error.response?.data?.error || 'Error uploading evidence'
            }))
        } finally {
            setFlexibilityEvidenceBusy(prev => ({ ...prev, [exerciseId]: false }))
        }
    }

    const handleFlexibilityEvidenceRemove = async (exerciseId: FlexibilityExerciseId) => {
        if (!id) return

        // Nothing persisted yet (shouldn't normally happen here since uploads
        // are immediate, but keep this a pure local clear if it does)
        if (!flexibilityForm.items[exerciseId].evidenceUrl) {
            flexibilityForm.setEvidenceFile(exerciseId, null)
            return
        }

        setFlexibilityEvidenceErrors(prev => ({ ...prev, [exerciseId]: null }))
        setFlexibilityEvidenceBusy(prev => ({ ...prev, [exerciseId]: true }))
        try {
            const response = await analysisAPI.deleteFlexibilityEvidence(parseInt(id), exerciseId)
            flexibilityForm.setEvidenceUrl(exerciseId, null)
            updateAnalysisInStore(parseInt(id), response.data)
        } catch (error: any) {
            setFlexibilityEvidenceErrors(prev => ({
                ...prev,
                [exerciseId]: error.response?.data?.error || 'Error removing evidence'
            }))
        } finally {
            setFlexibilityEvidenceBusy(prev => ({ ...prev, [exerciseId]: false }))
        }
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!id) return

        // Local date + time -> ISO, so the stored instant is exactly what the user picked
        const evaluationDate = localDateTimeToISO(formData.fechaEvaluacion, formData.horaEvaluacion)
        if (!evaluationDate) {
            setMensaje({ tipo: 'error', texto: 'Enter a valid evaluation date' })
            return
        }

        try {
            setSaving(true)
            setMensaje(null)

            const updateData: any = {
                evaluationDate
            }

            // Every editable field is always sent: an emptied field goes as
            // null so the backend clears it (omitting it would keep the old value).
            const textOrNull = (value: string) => (value.trim() === '' ? null : value)
            const capacityOrNull = (value: number) => (value > 0 ? value : null) // 0 = slider not set

            // Análisis textuales
            updateData.flexibilityAnalysis = textOrNull(formData.analisisFlexibilidad)
            updateData.biobitAnalysis = textOrNull(formData.analisisBiobit)
            updateData.muscularAsymmetry = textOrNull(formData.asimetriaMuscular)
            updateData.activeMotorControl = textOrNull(formData.controlMotorActivo)
            updateData.functionalMuscleFatigue = textOrNull(formData.fatigaMuscular)
            updateData.inertiaForceControl = textOrNull(formData.controlFuerzaInercia)

            // Puntos débiles - convertir array a JSON (removing them all clears the field)
            const puntosDebilesTexto = formData.puntosDebiles
                .filter(p => p.area.trim() !== '')
                .map(p => ({ area: p.area, descripcion: p.descripcion }))
            updateData.weakPoints = puntosDebilesTexto.length > 0 ? JSON.stringify(puntosDebilesTexto) : null

            // Capacidades físicas
            updateData.power = capacityOrNull(formData.capacidadesFisicas.potencia)
            updateData.endurance = capacityOrNull(formData.capacidadesFisicas.resistencia)
            updateData.strength = capacityOrNull(formData.capacidadesFisicas.fuerza)
            updateData.flexibility = capacityOrNull(formData.capacidadesFisicas.flexibilidad)
            updateData.speed = capacityOrNull(formData.capacidadesFisicas.velocidad)

            // Clasificación y recomendaciones
            updateData.cohortClassification = formData.clasificacionCohorte || null
            updateData.coachRecommendations = textOrNull(formData.recomendaciones)

            // Flexibility Assessment ratings (evidence photos are already
            // persisted immediately via the dedicated endpoint on select/remove)
            const flexibilityItems = FLEXIBILITY_EXERCISE_IDS
                .map(exerciseId => flexibilityForm.items[exerciseId])
                .filter(item => item.rating !== null || item.evidenceUrl !== null)

            if (flexibilityItems.length > 0) {
                updateData.flexibilityAssessment = flexibilityItems.map(({ exerciseId, rating, evidenceUrl }) => ({
                    exerciseId,
                    rating,
                    evidenceUrl
                }))
            }

            // Measured results: full replace. Older assessments without results
            // only get the column written once something is actually entered.
            const hasClinicalData = CLINICAL_SECTIONS.some(({ key }) => sectionHasData(clinicalForm.results, key))
            if (clinicalInitial || hasClinicalData || clinicalForm.results.snapshot.sport) {
                updateData.clinicalResults = clinicalForm.results
            }

            const response = await analysisAPI.update(parseInt(id), updateData)

            // Update store
            updateAnalysisInStore(parseInt(id), response.data)

            setMensaje({ tipo: 'success', texto: '✅ Analysis updated successfully' })

            setTimeout(() => {
                navigate(`/analysis-view/${id}`)
            }, 1500)
        } catch (error: any) {
            console.error('Error updating analysis:', error)
            setMensaje({ tipo: 'error', texto: error.response?.data?.error || 'Error updating analysis' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <PageTemplate title="Loading..." subtitle="">
                <LoadingSpinner message="Loading analysis data..." />
            </PageTemplate>
        )
    }

    return (
        <PageTemplate
            title="Edit Analysis"
            subtitle="Update the analysis information"
            className="edit-analysis-page"
            showBackButton={true}
            breadcrumbItems={[
                { label: 'Assessments', path: '/analysis' },
                { label: athleteName || 'Assessment', path: `/analysis-view/${id}` },
                { label: 'Edit' }
            ]}
        >
            <form onSubmit={handleSubmit} className="nuevo-analisis-form">
                {mensaje && (
                    <div className={`mensaje mensaje-${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                {/* Evaluation Date */}
                <div className="form-section">
                    <h3>Evaluation Date</h3>
                    <div className="form-group">
                        <label htmlFor="fechaEvaluacion">Evaluation Date/Time *</label>
                        {/* Same MM/DD/YYYY + time control as New Assessment */}
                        <div className="eval-datetime-row">
                            <DateInputMMDDYYYY
                                id="fechaEvaluacion"
                                value={formData.fechaEvaluacion}
                                onChange={(isoDate) => handleChange('fechaEvaluacion', isoDate)}
                                required
                                disabled={saving}
                            />
                            <input
                                type="time"
                                value={formData.horaEvaluacion}
                                onChange={(e) => handleChange('horaEvaluacion', e.target.value)}
                                aria-label="Evaluation time"
                                className="eval-time-input"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <AssessmentSportSelect
                        value={clinicalForm.results.snapshot.sport ?? ''}
                        onChange={(sport) => clinicalForm.setField('snapshot.sport', sport || null)}
                        disabled={saving}
                    />
                </div>

                {/* SECTION 2 - Flexibility Assessment */}
                <div className="form-section">
                    <h3 className="section-title">
                        <span className="section-number">2</span>
                        Flexibility Assessment
                    </h3>
                    <p className="section-description">
                        Evaluate the patient's functional mobility through four standardized flexibility tests.
                    </p>

                    <FlexibilityAssessmentSection
                        items={flexibilityForm.items}
                        onRatingSelect={flexibilityForm.setRating}
                        onEvidenceSelect={handleFlexibilityEvidenceSelect}
                        onEvidenceRemove={handleFlexibilityEvidenceRemove}
                        evidenceBusy={flexibilityEvidenceBusy}
                        evidenceErrors={flexibilityEvidenceErrors}
                    />
                </div>

                {/* SECTION 3 - Measured results (report boxes 2-9) */}
                <div className="form-section">
                    <h3 className="section-title">
                        <span className="section-number">3</span>
                        Measured Results
                    </h3>
                    <p className="section-description">
                        Empty boxes are reported as “Not evaluated”, never as zero.
                    </p>

                    <ClinicalResultsSection form={clinicalForm} gender={athleteGender} disabled={saving} />
                </div>

                {/* SECCIÓN 4 - Análisis Textual */}
                <div className="form-section">
                    <h3 className="section-title">
                        <span className="section-number">4</span>
                        Textual Analysis
                    </h3>

                    {/* Detailed Analysis */}
                    <AnalysisFieldsForm
                        formData={formData}
                        onChange={handleChange}
                    />

                    {/* AI-Assisted Textual Analysis (view + inline edit only) */}
                    {aiResults.length > 0 && (
                        <div className="ai-results-subsection">
                            <h4>
                                <IoSparklesOutline /> AI-Assisted Analysis
                            </h4>
                            <div className="ai-results-list">
                                {aiResults.map(result => (
                                    <MiniChatPanel
                                        key={result.id}
                                        result={result}
                                        editable
                                        onSave={(newText) => saveAiEdit(result.id, newText)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SECCIÓN 5 - Conclusiones y Plan */}
                <div className="form-section">
                    <h3 className="section-title">
                        <span className="section-number">5</span>
                        Conclusions and Plan
                    </h3>

                    {/* Puntos Débiles */}
                    <WeakPointsList
                        puntosDebiles={formData.puntosDebiles}
                        onAdd={handleAgregarPuntoDebil}
                        onRemove={handleEliminarPuntoDebil}
                        onChange={handlePuntoDebilChange}
                    />

                    {/* Capacidades Físicas */}
                    <PhysicalCapacitiesForm
                        capacidades={formData.capacidadesFisicas}
                        onChange={handleCapacidadChange}
                    />
                </div>

                {/* Clasificación y Recomendaciones */}
                <div className="form-section">
                    <h3>Classification and Recommendations</h3>
                    <div className="form-group">
                        <label htmlFor="clasificacionCohorte">Cohort Classification</label>
                        <select
                            id="clasificacionCohorte"
                            className="form-select"
                            value={formData.clasificacionCohorte}
                            onChange={(e) => handleChange('clasificacionCohorte', e.target.value)}
                        >
                            <option value="">Select a classification</option>
                            <option value="ELITE">Elite</option>
                            <option value="AVANZADO">Advanced</option>
                            <option value="INTERMEDIO">Intermediate</option>
                            <option value="PRINCIPIANTE">Beginner</option>
                            <option value="ATENCION_REQUERIDA">Attention Required</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="recomendaciones">Recommendations for Coach</label>
                        <textarea
                            id="recomendaciones"
                            value={formData.recomendaciones}
                            onChange={(e) => handleChange('recomendaciones', e.target.value)}
                            rows={6}
                            placeholder="Write specific recommendations for the coach..."
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <div className="form-actions">
                    <button type="submit" className="btn-primary-large" disabled={saving}>
                        {saving ? <ButtonLoadingContent text="Saving..." /> : '✓ Save Changes'}
                    </button>
                </div>
            </form>
        </PageTemplate>
    )
}

export default EditAnalysis
