import { IoAlertCircleOutline } from 'react-icons/io5'
import type { UseClinicalResultsFormReturn } from '@/hooks/useClinicalResultsForm'
import './ClinicalNotesField.css'

const MAX_LENGTH = 5000

/**
 * Free-text clinical notes for this evaluation (injuries, diagnosed
 * conditions, pain, postural alterations...). Saved with the assessment and
 * shown at the top of the report; not used by any scoring rule.
 */
function ClinicalNotesField({ form, disabled }: { form: UseClinicalResultsFormReturn; disabled?: boolean }) {
    const value = form.results.clinicalNotes ?? ''

    return (
        <div className="clinical-notes-field">
            <label htmlFor="clinical-notes">
                <IoAlertCircleOutline aria-hidden="true" /> Additional Clinical Notes &amp; Detected Conditions
            </label>
            <p className="field-hint">
                Injuries, diagnosed conditions, pain, postural alterations or anything unusual about the patient for this evaluation.
                One point per line. They appear at the top of the report.
            </p>
            <textarea
                id="clinical-notes"
                value={value}
                maxLength={MAX_LENGTH}
                rows={4}
                disabled={disabled}
                placeholder={'Carpal tunnel syndrome in right hand\nIncreased lumbar lordosis\nLeft knee patellar tendinopathy'}
                onChange={(e) => form.setField('clinicalNotes', e.target.value === '' ? null : e.target.value)}
            />
        </div>
    )
}

export default ClinicalNotesField
