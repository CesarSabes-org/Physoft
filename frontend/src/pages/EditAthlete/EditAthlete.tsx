import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoSave, IoCamera } from 'react-icons/io5'
import PageTemplate from '@/components/templates/PageTemplate'
import LoadingSpinner from '@/components/common/feedback/LoadingSpinner'
import { ButtonLoadingContent } from '@/components/common/feedback/ButtonSpinner'
import DateInputMMDDYYYY from '@/components/common/forms/DateInputMMDDYYYY'
import { athleteAPI, type UpdateAthleteDTO } from '@/services/api'
import { useAthleteStore } from '@/store/athleteStore'
import { ROUTES, VALIDATION } from '@/constants'
import './EditAthlete.css'

const normalizeGender = (gender: string | null | undefined): string => {
    if (!gender) return ''

    const normalized = gender.trim().toLowerCase()
    if (normalized === 'male' || normalized === 'masculino') return 'Male'
    if (normalized === 'female' || normalized === 'femenino') return 'Female'
    if (normalized === 'other' || normalized === 'otro') return 'Other'

    return gender
}

const normalizeBodyType = (bodyType: string | null | undefined): string => {
    if (!bodyType) return ''

    const normalized = bodyType.trim().toLowerCase()
    if (normalized === 'ectomorph' || normalized === 'ectomorfo') return 'Ectomorph'
    if (normalized === 'mesomorph' || normalized === 'mesomorfo') return 'Mesomorph'
    if (normalized === 'endomorph' || normalized === 'endomorfo') return 'Endomorph'

    return bodyType
}

function EditAthlete() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { updateAthlete: updateAthleteInStore } = useAthleteStore()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
    const [isNonAthlete, setIsNonAthlete] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        patientType: 'Athlete',
        gender: '',
        birthDate: '',
        nationality: '',
        sport: '',
        club: '',
        position: '',
        bodyType: '',
        height: '',
        weight: '',
        email: '',
        phone: '',
        photo: null as File | null,
        currentPhotoUrl: ''
    })

    useEffect(() => {
        if (id) {
            loadAthlete(id)
        }
    }, [id])

    const loadAthlete = async (athleteId: string) => {
        try {
            setLoading(true)
            const response = await athleteAPI.getById(athleteId)
            const athlete = response.data

            setFormData({
                name: athlete.name,
                patientType: athlete.patientType || 'Athlete',
                gender: normalizeGender(athlete.gender),
                birthDate: athlete.birthDate || '',
                nationality: athlete.nationality || '',
                sport: athlete.sport,
                club: athlete.club || '',
                position: athlete.position || '',
                bodyType: normalizeBodyType(athlete.bodyType),
                height: (athlete.height ?? '').toString(),
                weight: (athlete.weight ?? '').toString(),
                email: athlete.email || '',
                phone: athlete.phone || '',
                photo: null,
                currentPhotoUrl: athlete.photo || ''
            })
            setIsNonAthlete(athlete.sport === 'None')
        } catch (error: any) {
            console.error('Error loading athlete:', error)
            const status = error.response?.status
            const backendMessage = error.response?.data?.error
            let texto = 'Error loading patient'
            if (status === 404) {
                texto = 'Patient not found. It may have been deleted.'
            } else if (backendMessage) {
                texto = backendMessage
            } else if (error.message) {
                texto = `Error loading patient: ${error.message}`
            }
            setMensaje({ tipo: 'error', texto })
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, photo: e.target.files![0] }))
        }
    }

    // "None" toggles the whole Sports Information section off: the sport
    // value is auto-filled with the sentinel "None" so the native
    // `required` attribute keeps being satisfied unchanged.
    const handleNonAthleteToggle = (checked: boolean) => {
        setIsNonAthlete(checked)
        setFormData(prev => ({
            ...prev,
            sport: checked ? 'None' : (prev.sport === 'None' ? '' : prev.sport),
            club: checked ? '' : prev.club,
            position: checked ? '' : prev.position
        }))
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!id) return

        try {
            setSaving(true)
            setMensaje(null)

            // Update basic data. Optional fields go as null when emptied so the
            // backend clears them (undefined is dropped from the JSON body and
            // would keep the old value — e.g. club/position after "None").
            const updateData: UpdateAthleteDTO = {
                name: formData.name,
                gender: normalizeGender(formData.gender),
                birthDate: formData.birthDate || null,
                nationality: formData.nationality.trim() || null,
                sport: formData.sport,
                club: formData.club.trim() || null,
                position: formData.position.trim() || null,
                bodyType: normalizeBodyType(formData.bodyType),
                height: parseFloat(formData.height),
                weight: parseFloat(formData.weight),
                email: formData.email.trim() || null,
                phone: formData.phone.trim() || null,
                patientType: formData.patientType || undefined
            }

            const response = await athleteAPI.update(id, updateData)

            // Upload new photo if selected
            let finalAthlete = response.data
            if (formData.photo) {
                const photoResponse = await athleteAPI.uploadPhoto(id, formData.photo)
                finalAthlete = photoResponse.data
            }

            // Update store with final athlete data
            updateAthleteInStore(id, finalAthlete)

            setMensaje({ tipo: 'success', texto: 'Patient updated successfully' })

            setTimeout(() => {
                navigate(`/athlete-detail/${id}`)
            }, 1500)
        } catch (error: any) {
            console.error('Error updating athlete:', error)
            setMensaje({ tipo: 'error', texto: error.response?.data?.error || 'Error updating patient' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <PageTemplate title="Loading..." subtitle="">
                <LoadingSpinner message="Loading patient data..." />
            </PageTemplate>
        )
    }

    return (
        <PageTemplate
            title="Edit Patient"
            subtitle="Update patient information"
            className="edit-athlete-page"
            showBackButton={true}
            breadcrumbItems={[
                { label: 'Patients', path: ROUTES.ALL_PATIENTS },
                { label: formData.name || 'Patient', path: `/athlete-detail/${id}` },
                { label: 'Edit' }
            ]}
        >

            <form onSubmit={handleSubmit} className="edit-athlete-form">
                {mensaje && (
                    <div className={`mensaje mensaje-${mensaje.tipo}`}>
                        {mensaje.texto}
                    </div>
                )}

                {/* Photo Section */}
                <div className="form-section photo-section">
                    <h3>Patient Photo</h3>
                    <div className="photo-upload">
                        {(formData.currentPhotoUrl || formData.photo) && (
                            <img
                                src={formData.photo ? URL.createObjectURL(formData.photo) : formData.currentPhotoUrl}
                                alt="Preview"
                                className="photo-preview"
                            />
                        )}
                        <label htmlFor="photo" className="photo-label">
                            <IoCamera />
                            {formData.photo ? 'Change Photo' : 'Select New Photo'}
                        </label>
                        <input
                            type="file"
                            id="photo"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

                {/* Personal Information */}
                <div className="form-section">
                    <h3>Personal Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="name">Full Name *</label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="patientType">Patient Type *</label>
                            <select
                                id="patientType"
                                value={formData.patientType}
                                onChange={(e) => setFormData(prev => ({ ...prev, patientType: e.target.value }))}
                                required
                            >
                                <option value="">Select...</option>
                                <option value="Athlete">Athlete</option>
                                <option value="General Patient">General Patient</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="gender">Gender *</label>
                            <select
                                id="gender"
                                value={formData.gender}
                                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                                required
                            >
                                <option value="">Select...</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="birthDate">Birth Date</label>
                            <DateInputMMDDYYYY
                                id="birthDate"
                                value={formData.birthDate}
                                onChange={(isoDate) => setFormData(prev => ({ ...prev, birthDate: isoDate }))}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nationality">Nationality</label>
                            <input
                                type="text"
                                id="nationality"
                                value={formData.nationality}
                                onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Sports Information */}
                <div className="form-section">
                    <h3>Sports Information</h3>

                    <label className="non-athlete-checkbox">
                        <input
                            type="checkbox"
                            checked={isNonAthlete}
                            onChange={(e) => handleNonAthleteToggle(e.target.checked)}
                        />
                        <span>None &mdash; this patient does not practice a sport</span>
                    </label>

                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="sport">Sport *</label>
                            <input
                                type="text"
                                id="sport"
                                value={formData.sport}
                                onChange={(e) => setFormData(prev => ({ ...prev, sport: e.target.value }))}
                                required
                                disabled={isNonAthlete}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="club">Club/Team</label>
                            <input
                                type="text"
                                id="club"
                                value={formData.club}
                                onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                                disabled={isNonAthlete}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="position">Position</label>
                            <input
                                type="text"
                                id="position"
                                value={formData.position}
                                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                                disabled={isNonAthlete}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="bodyType">Body Type *</label>
                            <select
                                id="bodyType"
                                value={formData.bodyType}
                                onChange={(e) => setFormData(prev => ({ ...prev, bodyType: e.target.value }))}
                                required
                            >
                                <option value="">Select...</option>
                                <option value="Ectomorph">Ectomorph</option>
                                <option value="Mesomorph">Mesomorph</option>
                                <option value="Endomorph">Endomorph</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Physical Measurements */}
                <div className="form-section">
                    <h3>Physical Measurements</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="height">Height (feet) *</label>
                            <input
                                type="number"
                                id="height"
                                value={formData.height}
                                onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                                step="0.01"
                                min={VALIDATION.MIN_HEIGHT}
                                max={VALIDATION.MAX_HEIGHT}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="weight">Weight (pounds) *</label>
                            <input
                                type="number"
                                id="weight"
                                value={formData.weight}
                                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                                step="0.1"
                                min={VALIDATION.MIN_WEIGHT}
                                max={VALIDATION.MAX_WEIGHT}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="form-section">
                    <h3>Contact Information</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone">Phone</label>
                            <input
                                type="tel"
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? (
                            <ButtonLoadingContent text="Saving..." />
                        ) : (
                            <>
                                <IoSave />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </form>
        </PageTemplate>
    )
}

export default EditAthlete
