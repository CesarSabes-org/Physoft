import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoSearch } from 'react-icons/io5'
import PageTemplate from '@/components/templates/PageTemplate'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import { athleteAPI, analysisAPI, Athlete, AIAnalysisResult } from '@/services/api'
import { useAnalysisStore } from '@/store/analysisStore'
import { useAthleteStore } from '@/store/athleteStore'
import DateInputMMDDYYYY from '@/components/common/forms/DateInputMMDDYYYY'
import TextualAnalysisSection from '@/components/analysis/TextualAnalysisSection'
import FlexibilityAssessmentSection from '@/components/analysis/FlexibilityAssessmentSection'
import ClinicalResultsSection from '@/components/analysis/clinicalResults/ClinicalResultsSection'
import AssessmentSportSelect from '@/components/analysis/AssessmentSportSelect'
import { defaultAssessmentSport } from '@/components/analysisReport/sportAssets'
import { useClinicalResultsForm, useFlexibilityAssessmentForm } from '@/hooks'
import type { DominantSide } from '@/types/clinicalResults.types'
import { FLEXIBILITY_EXERCISE_IDS } from '@/services/api'
import { BODY_TYPES, BODY_TYPE_LABELS, VALIDATION } from '@/constants'
import { calculateAge } from '@/utils/date.utils'
import './NewAnalysis.css'

function NewAnalysis() {
  const navigate = useNavigate()
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAthleteDropdown, setShowAthleteDropdown] = useState(false)
  const { addAnalysis } = useAnalysisStore()
  const { updateAthlete: updateAthleteInStore } = useAthleteStore()

  // Textual Analysis (AI) results, reported up from TextualAnalysisSection
  const [aiAnalysisResults, setAiAnalysisResults] = useState<AIAnalysisResult[]>([])
  const [isAiGenerating, setIsAiGenerating] = useState(false)

  // Flexibility Assessment ratings + evidence photos (uploaded on submit, together with the rest of the analysis)
  const flexibilityForm = useFlexibilityAssessmentForm()

  // Measured/observed results (report boxes 2-9), manual or AI-suggested then reviewed
  const clinicalForm = useClinicalResultsForm()

  const [formData, setFormData] = useState({
    athleteId: '',
    fechaEvaluacion: '',
    // Editable patient parameters — prefilled from the selected patient and
    // pushed back to the patient's profile on save (they can change per visit).
    weight: '',
    height: '',
    somatotype: '',
    // Declared dominant side (information only: it does not imply more strength or uneven weight bearing)
    dominantSide: '' as DominantSide | '',
    // Sport evaluated in this assessment — selects the report illustration
    assessmentSport: '',
    recomendaciones: ''
  })

  // Evaluation date/time is tracked as separate date (DD/MM/YYYY) + time parts,
  // then combined into formData.fechaEvaluacion ('YYYY-MM-DDTHH:mm') so the
  // rest of the form/submit logic is unchanged.
  const [evalDatePart, setEvalDatePart] = useState('')
  const [evalTimePart, setEvalTimePart] = useState('')

  useEffect(() => {
    loadAthletes()
  }, [])

  const loadAthletes = async () => {
    try {
      const response = await athleteAPI.getAll()
      setAthletes(response.data || [])
      if (response.data?.length === 0) {
        setMensaje({
            tipo: 'error',
            texto: 'No patients found in the database. Please create one first in the Patients section.'
          })
      }
    } catch (error) {
      console.error('Error loading athletes:', error)
      setMensaje({
        tipo: 'error',
        texto: 'Error loading patients. Please verify the backend is running.'
      })
    }
  }

  const filteredAthletes = athletes.filter(athlete =>
    athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    athlete.accessCode.includes(searchQuery)
  )

  const handleAthleteSelect = (athlete: Athlete) => {
    setSelectedAthlete(athlete)
    setFormData(prev => ({
      ...prev,
      athleteId: athlete.id,
      // Prefill the editable parameters from the patient's current profile.
      weight: athlete.weight != null ? String(athlete.weight) : '',
      height: athlete.height != null ? String(athlete.height) : '',
      somatotype: athlete.bodyType || '',
      assessmentSport: defaultAssessmentSport(athlete.sport)
    }))
    setSearchQuery(`${athlete.accessCode} - ${athlete.name}`)
    setShowAthleteDropdown(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEvalDateChange = (isoDate: string) => {
    setEvalDatePart(isoDate)
    if (!isoDate) {
      setFormData(prev => ({ ...prev, fechaEvaluacion: '' }))
      return
    }
    const time = evalTimePart || new Date().toTimeString().slice(0, 5)
    if (!evalTimePart) setEvalTimePart(time)
    setFormData(prev => ({ ...prev, fechaEvaluacion: `${isoDate}T${time}` }))
  }

  const handleEvalTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setEvalTimePart(time)
    if (evalDatePart) {
      setFormData(prev => ({ ...prev, fechaEvaluacion: `${evalDatePart}T${time}` }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!selectedAthlete || !formData.athleteId) {
      setMensaje({ tipo: 'error', texto: 'You must select a patient before saving' })
      return
    }

    if (!formData.weight || !formData.height || !formData.somatotype) {
      setMensaje({ tipo: 'error', texto: 'Weight, height and somatotype are required' })
      return
    }

    setGuardando(true)
    setMensaje(null)

    try {
      // Prepare data in the correct format for analysisAPI.create
      const submitData: any = {
        athleteId: formData.athleteId,
        evaluationDate: new Date(formData.fechaEvaluacion).toISOString(),
      }

      // Textual Analysis AI results (per-checkbox prompt + response history)
      if (aiAnalysisResults.length > 0) {
        submitData.aiAnalysisResults = aiAnalysisResults
      }

      // Recommendations for coach
      if (formData.recomendaciones) submitData.coachRecommendations = formData.recomendaciones

      // Measured results + the patient's parameters as recorded at this evaluation
      submitData.clinicalResults = {
        ...clinicalForm.results,
        snapshot: {
          weightLbs: formData.weight ? Number(formData.weight) : null,
          heightFt: formData.height ? Number(formData.height) : null,
          somatotype: formData.somatotype || null,
          dominantSide: formData.dominantSide || null,
          sport: formData.assessmentSport || null
        }
      }

      // Flexibility Assessment: only send exercises the user actually touched
      const flexibilityItems = FLEXIBILITY_EXERCISE_IDS
        .map((exerciseId) => flexibilityForm.items[exerciseId])
        .filter((item) => item.rating !== null || item.evidenceFile !== null)

      if (flexibilityItems.length > 0) {
        submitData.flexibilityAssessment = flexibilityItems.map(({ exerciseId, rating }) => ({ exerciseId, rating }))
        submitData.flexibilityEvidenceFiles = Object.fromEntries(
          flexibilityItems
            .filter((item) => item.evidenceFile !== null)
            .map((item) => [item.exerciseId, item.evidenceFile as File])
        )
      }

      const response = await analysisAPI.create(submitData)

      // Update store with new analysis
      addAnalysis(response.data)

      // Push the (possibly updated) weight/height/somatotype back to the
      // patient's profile so the Patient Card always reflects the newest
      // values. Best-effort: the analysis is already saved, so a profile
      // update failure should not discard it.
      try {
        const athleteResponse = await athleteAPI.update(formData.athleteId, {
          weight: Number(formData.weight),
          height: Number(formData.height),
          bodyType: formData.somatotype
        })
        updateAthleteInStore(formData.athleteId, athleteResponse.data)
      } catch (profileError) {
        console.error('Analysis saved, but updating the patient profile failed:', profileError)
      }

      setMensaje({ tipo: 'success', texto: '✅ Analysis saved successfully' })

      // guardando stays true until the redirect, so the form can't be submitted twice
      setTimeout(() => {
        navigate(`/analysis-view/${response.data.id}`)
      }, 1500)

    } catch (error: any) {
      console.error('Error creating analysis:', error)
      console.error('Error response:', error.response?.data)
      let errorMessage = 'Error creating analysis'

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }

      setMensaje({
        tipo: 'error',
        texto: errorMessage
      })
      setGuardando(false)
    }
  }

  return (
    <PageTemplate
      title="New Sports Assessment"
      subtitle="Comprehensive kinesiology evaluation with AI assistance"
      showBackButton={true}
      className="nuevo-analisis-page"
      breadcrumbItems={[
        { label: 'Assessments', path: '/analysis' },
        { label: 'New Assessment' }
      ]}
    >
      <div className="nuevo-analisis-container">
        {mensaje && (
          <div className={`mensaje ${mensaje.tipo}`}>
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} className="analisis-form">

          {/* SECTION 1 - General Information */}
          <div className="form-section">
            <h3 className="section-title">
              <span className="section-number">1</span>
              General Information
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="athleteSearch">Patient / Code *</label>
                <div className="athlete-search-wrapper">
                  <IoSearch className="athlete-search-icon" />
                  <input
                    type="text"
                    id="athleteSearch"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowAthleteDropdown(true)
                    }}
                    onFocus={() => setShowAthleteDropdown(true)}
                    placeholder="Search by code or name..."
                    className="athlete-search-input"
                    required
                  />

                  {showAthleteDropdown && filteredAthletes.length > 0 && (
                    <div className="athlete-dropdown">
                      {filteredAthletes.slice(0, 5).map((athlete) => (
                        <div
                          key={athlete.id}
                          className="athlete-dropdown-item"
                          onClick={() => handleAthleteSelect(athlete)}
                        >
                          <span className="athlete-code">{athlete.accessCode}</span>
                          <span className="athlete-name">{athlete.name}</span>
                          <span className="athlete-sport">{athlete.sport}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="field-hint">
                  {selectedAthlete
                    ? `✓ Patient: ${selectedAthlete.name} - ${selectedAthlete.sport}`
                    : 'Enter the patient code or search by name'
                  }
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="fechaEvaluacion">Evaluation Date/Time *</label>
                <div className="eval-datetime-row">
                  <DateInputMMDDYYYY
                    id="fechaEvaluacion"
                    value={evalDatePart}
                    onChange={handleEvalDateChange}
                    required
                  />
                  <input
                    type="time"
                    value={evalTimePart}
                    onChange={handleEvalTimeChange}
                    aria-label="Evaluation time"
                    className="eval-time-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="weight">Weight (lbs) *</label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  placeholder="e.g., 160"
                  min={VALIDATION.MIN_WEIGHT}
                  max={VALIDATION.MAX_WEIGHT}
                  step="0.1"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="height">Height (ft) *</label>
                <input
                  type="number"
                  id="height"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  placeholder="e.g., 5.9"
                  min={VALIDATION.MIN_HEIGHT}
                  max={VALIDATION.MAX_HEIGHT}
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="somatotype">Somatotype *</label>
                <select
                  id="somatotype"
                  name="somatotype"
                  className="form-select"
                  value={formData.somatotype}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a somatotype</option>
                  {Object.values(BODY_TYPES).map((type) => (
                    <option key={type} value={type}>
                      {BODY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="dominantSide">Dominant side (declared)</label>
                <select
                  id="dominantSide"
                  name="dominantSide"
                  className="form-select"
                  value={formData.dominantSide}
                  onChange={handleChange}
                >
                  <option value="">Not declared</option>
                  <option value="RIGHT">Right</option>
                  <option value="LEFT">Left</option>
                  <option value="AMBIDEXTROUS">Ambidextrous</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <AssessmentSportSelect
                value={formData.assessmentSport}
                onChange={(sport) => setFormData(prev => ({ ...prev, assessmentSport: sport }))}
                disabled={guardando}
              />
            </div>
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
              onEvidenceSelect={flexibilityForm.setEvidenceFile}
              onEvidenceRemove={(exerciseId) => flexibilityForm.setEvidenceFile(exerciseId, null)}
            />
          </div>

          {/* SECTION 3 - Measured results (report boxes 2-9) */}
          <div className="form-section">
            <h3 className="section-title">
              <span className="section-number">3</span>
              Measured Results
            </h3>
            <p className="section-description">
              Enter the results of each test, or auto-fill them from the device reports and review them.
              Leave a box empty when the test was not performed — it will be reported as “Not evaluated”, never as zero.
            </p>

            <ClinicalResultsSection form={clinicalForm} gender={selectedAthlete?.gender} disabled={guardando} />
          </div>

          {/* SECTION 4 - Textual Analysis with AI */}
          <div className="form-section">
            <h3 className="section-title">
              <span className="section-number">4</span>
              Textual Analysis
            </h3>
            <p className="section-description">
              Select one or more analysis types, attach supporting files (PDF or images),
              and optionally add a prompt to focus the AI on specific aspects.
            </p>

            <TextualAnalysisSection
              patientId={selectedAthlete?.id}
              patientContext={{
                name: selectedAthlete?.name,
                age: selectedAthlete?.birthDate ? calculateAge(selectedAthlete.birthDate) : undefined,
                sport: selectedAthlete?.sport
              }}
              onResultsChange={setAiAnalysisResults}
              onGeneratingChange={setIsAiGenerating}
              evaluationDate={formData.fechaEvaluacion}
            />
          </div>

          {/* SECTION 5 - Conclusions and Plan */}
          <div className="form-section">
            <h3 className="section-title">
              <span className="section-number">5</span>
              Conclusions and plan
            </h3>

            <div className="subsection">
              <h4>Recommendations for Coach</h4>
              <p className="field-hint">Link each recommendation to a documented finding. They appear in the report as reviewed by the professional.</p>
              <textarea
                name="recomendaciones"
                value={formData.recomendaciones}
                onChange={handleChange}
                rows={6}
                placeholder="Write specific recommendations for the coach..."
                className="form-textarea-large"
              />
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary-large"
              onClick={() => navigate('/analysis')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-large"
              disabled={guardando || isAiGenerating}
              title={isAiGenerating ? 'Wait for AI analysis to finish before saving' : undefined}
            >
              {guardando ? <ButtonLoadingContent text="Saving..." /> : isAiGenerating ? 'Waiting for AI...' : '✓ Save Analysis'}
            </button>
          </div>
        </form>
      </div>
    </PageTemplate>
  )
}

export default NewAnalysis
