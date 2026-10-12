import { useEffect, useState, type ReactNode } from 'react'
import { IoSparkles } from 'react-icons/io5'
import type { UseClinicalResultsFormReturn } from '@/hooks/useClinicalResultsForm'

function getIn(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), obj)
}

export function fieldId(path: string): string {
    return `cr-${path.replace(/\./g, '-')}`
}

export function AiBadge() {
    return (
        <span className="cr-ai-badge" title="Suggested by AI from the uploaded report — verify it">
            <IoSparkles /> AI
        </span>
    )
}

// Commas are rejected rather than guessed: "2,908" could be 2908 (thousands)
// or 2.908 (decimal), and silently picking one would corrupt the result.
function parseNumber(text: string): number | null {
    const trimmed = text.trim()
    if (trimmed === '' || trimmed.includes(',')) return null
    const value = Number(trimmed)
    return Number.isFinite(value) ? value : null
}

interface NumberFieldProps {
    form: UseClinicalResultsFormReturn
    path: string
    label?: string
    unit?: string
    placeholder?: string
    disabled?: boolean
    /** Render the bare input (for table cells) instead of a labelled group */
    compact?: boolean
    ariaLabel?: string
}

/**
 * Numeric input bound to a clinical-results path. Keeps its own text so
 * partial input ("1.", "0,") isn't wiped while typing; empty means null,
 * never 0.
 */
export function NumberField({ form, path, label, unit, placeholder, disabled, compact, ariaLabel }: NumberFieldProps) {
    const value = getIn(form.results, path) as number | null | undefined
    const [text, setText] = useState(value === null || value === undefined ? '' : String(value))

    useEffect(() => {
        if (parseNumber(text) !== (value ?? null)) {
            setText(value === null || value === undefined ? '' : String(value))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    const isAi = form.isAiField(path)
    const invalid = text.trim() !== '' && (parseNumber(text) === null || (parseNumber(text) as number) < 0)

    const input = (
        <input
            id={fieldId(path)}
            type="text"
            inputMode="decimal"
            className={`cr-input ${isAi ? 'cr-input-ai' : ''} ${invalid ? 'cr-input-invalid' : ''}`}
            value={text}
            placeholder={placeholder ?? '—'}
            disabled={disabled}
            aria-label={ariaLabel ?? label}
            aria-invalid={invalid}
            onChange={(e) => {
                setText(e.target.value)
                const parsed = parseNumber(e.target.value)
                if (e.target.value.trim() === '' || (parsed !== null && parsed >= 0)) {
                    form.setField(path, parsed)
                }
            }}
        />
    )

    if (compact) {
        return <div className="cr-cell">{input}{isAi && <AiBadge />}</div>
    }

    return (
        <div className="cr-field">
            <label htmlFor={fieldId(path)}>
                {label}{unit && <span className="cr-unit"> ({unit})</span>}
                {isAi && <AiBadge />}
            </label>
            {input}
            {invalid && <span className="cr-field-error">Enter a positive number, using a dot for decimals</span>}
        </div>
    )
}

interface SelectFieldProps {
    form: UseClinicalResultsFormReturn
    path: string
    label?: string
    options: { value: string; label: string }[]
    emptyLabel?: string
    disabled?: boolean
    compact?: boolean
    ariaLabel?: string
}

export function SelectField({ form, path, label, options, emptyLabel = 'Not evaluated', disabled, compact, ariaLabel }: SelectFieldProps) {
    const value = (getIn(form.results, path) as string | null) ?? ''
    const isAi = form.isAiField(path)

    const select = (
        <select
            id={fieldId(path)}
            className={`cr-input ${isAi ? 'cr-input-ai' : ''}`}
            value={value}
            disabled={disabled}
            aria-label={ariaLabel ?? label}
            onChange={(e) => form.setField(path, e.target.value === '' ? null : e.target.value)}
        >
            <option value="">{emptyLabel}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    )

    if (compact) {
        return <div className="cr-cell">{select}{isAi && <AiBadge />}</div>
    }

    return (
        <div className="cr-field">
            <label htmlFor={fieldId(path)}>
                {label}
                {isAi && <AiBadge />}
            </label>
            {select}
        </div>
    )
}

interface TextFieldProps {
    form: UseClinicalResultsFormReturn
    path: string
    label: string
    placeholder?: string
    multiline?: boolean
    disabled?: boolean
}

export function TextField({ form, path, label, placeholder, multiline, disabled }: TextFieldProps) {
    const value = (getIn(form.results, path) as string | null) ?? ''
    const isAi = form.isAiField(path)
    const common = {
        id: fieldId(path),
        className: `cr-input ${isAi ? 'cr-input-ai' : ''}`,
        value,
        placeholder,
        disabled,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            form.setField(path, e.target.value === '' ? null : e.target.value)
    }

    return (
        <div className="cr-field cr-field-wide">
            <label htmlFor={fieldId(path)}>
                {label}
                {isAi && <AiBadge />}
            </label>
            {multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
        </div>
    )
}

/** Live, rule-based result preview shown at the bottom of each box */
export function ResultPreview({ children }: { children: ReactNode }) {
    return <div className="cr-preview">{children}</div>
}
