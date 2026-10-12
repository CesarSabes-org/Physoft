import { ASSESSMENT_SPORTS, SPORT_IMAGES } from '@/components/analysisReport/sportAssets'
import './AssessmentSportSelect.css'

interface AssessmentSportSelectProps {
    id?: string
    value: string
    onChange: (sport: string) => void
    disabled?: boolean
}

/**
 * Sport evaluated in this assessment. Drives the illustration attached to
 * the final report; the preview shows exactly what the report will use.
 */
function AssessmentSportSelect({ id = 'assessmentSport', value, onChange, disabled }: AssessmentSportSelectProps) {
    const image = value ? SPORT_IMAGES[value] : undefined

    return (
        <div className="form-group assessment-sport-select">
            <label htmlFor={id}>Assessment sport (report illustration)</label>
            <div className="assessment-sport-row">
                <select
                    id={id}
                    className="form-select"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">No sport illustration</option>
                    {ASSESSMENT_SPORTS.map((sport) => (
                        <option key={sport} value={sport}>{sport}</option>
                    ))}
                </select>
                {image && (
                    <img src={image} alt={`${value} illustration preview`} className="assessment-sport-preview" />
                )}
            </div>
        </div>
    )
}

export default AssessmentSportSelect
