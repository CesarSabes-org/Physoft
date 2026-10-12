import { useRef, useState } from 'react'
import { IoCameraOutline, IoClose, IoWarningOutline } from 'react-icons/io5'
import type { FlexibilityExerciseId, FlexibilityRating } from '@/services/api'
import './FlexibilityExerciseRow.css'

export interface FlexibilityExercise {
    id: FlexibilityExerciseId
    name: string
    description: string
    images: Record<'poor' | 'average' | 'excellent', string>
}

// Internally the rating is stored/sent as LOW/MEDIUM/HIGH/RISK; these labels
// and CSS modifiers are UI-only. RISK has no illustration, so it renders as a
// separate full-width option below the three image cards.
const RATING_OPTIONS: { value: FlexibilityRating; label: string; modifier: 'poor' | 'average' | 'excellent' }[] = [
    { value: 'LOW', label: 'Poor', modifier: 'poor' },
    { value: 'MEDIUM', label: 'Average', modifier: 'average' },
    { value: 'HIGH', label: 'Excellent', modifier: 'excellent' }
]

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png'
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

interface FlexibilityExerciseRowProps {
    index: number
    exercise: FlexibilityExercise
    rating: FlexibilityRating | null
    evidenceFileName: string | null
    evidencePreview: string | null
    evidenceBusy?: boolean
    evidenceError?: string | null
    onRatingSelect: (rating: FlexibilityRating) => void
    onEvidenceSelect: (file: File) => void
    onEvidenceRemove: () => void
}

function FlexibilityExerciseRow({
    index,
    exercise,
    rating,
    evidenceFileName,
    evidencePreview,
    evidenceBusy = false,
    evidenceError = null,
    onRatingSelect,
    onEvidenceSelect,
    onEvidenceRemove
}: FlexibilityExerciseRowProps) {
    const [localError, setLocalError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            setLocalError('Only JPG, JPEG or PNG images are allowed.')
            return
        }

        setLocalError(null)
        onEvidenceSelect(file)
    }

    const handleRemoveEvidence = () => {
        setLocalError(null)
        onEvidenceRemove()
    }

    const error = localError || evidenceError

    return (
        <div className="flexibility-exercise-row">
            <div className="flexibility-exercise-info">
                <span className="flexibility-exercise-number">{index}</span>
                <div>
                    <h4 className="flexibility-exercise-name">{exercise.name}</h4>
                    <p className="flexibility-exercise-description">{exercise.description}</p>
                </div>
            </div>

            <div className="flexibility-exercise-options">
                {RATING_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`flexibility-option-card ${option.modifier} ${rating === option.value ? 'selected' : ''}`}
                        onClick={() => onRatingSelect(option.value)}
                        aria-pressed={rating === option.value}
                    >
                        <span className="flexibility-option-image-wrap">
                            <img src={exercise.images[option.modifier]} alt={`${exercise.name} - ${option.label}`} />
                        </span>
                        <span className="flexibility-option-label">
                            <span className="flexibility-option-radio" />
                            {option.label}
                        </span>
                    </button>
                ))}

                <button
                    type="button"
                    className={`flexibility-option-risk ${rating === 'RISK' ? 'selected' : ''}`}
                    onClick={() => onRatingSelect('RISK')}
                    aria-pressed={rating === 'RISK'}
                    title="Excessive flexibility: keeps the maximum score but raises a separate warning to review joint control. It does not automatically mean a higher injury risk."
                >
                    <IoWarningOutline />
                    <span>Risk — excessive flexibility, review joint control</span>
                </button>
            </div>

            <div className="flexibility-exercise-evidence">
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    onChange={handleFileChange}
                    disabled={evidenceBusy}
                    style={{ display: 'none' }}
                />

                {evidencePreview ? (
                    <div className="flexibility-evidence-preview">
                        <img src={evidencePreview} alt={`${exercise.name} evidence`} />
                        <button
                            type="button"
                            className="flexibility-evidence-remove"
                            onClick={handleRemoveEvidence}
                            disabled={evidenceBusy}
                            aria-label="Remove evidence"
                        >
                            <IoClose />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="flexibility-evidence-upload"
                        onClick={() => inputRef.current?.click()}
                        disabled={evidenceBusy}
                    >
                        <IoCameraOutline />
                        <span>{evidenceBusy ? 'Uploading...' : 'Upload Evidence'}</span>
                        <p>Photo (optional)</p>
                    </button>
                )}

                {evidenceFileName && evidencePreview && (
                    <p className="flexibility-evidence-filename" title={evidenceFileName}>{evidenceFileName}</p>
                )}

                {error && <p className="flexibility-evidence-error">{error}</p>}
            </div>
        </div>
    )
}

export default FlexibilityExerciseRow
