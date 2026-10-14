import { BODY_TYPE_LABELS, BODY_TYPES } from '@/constants'

// Older records may hold the Spanish names; map them to the stored English value
const LEGACY_BODY_TYPES: Record<string, string> = {
    ectomorfo: BODY_TYPES.ECTOMORPH,
    mesomorfo: BODY_TYPES.MESOMORPH,
    endomorfo: BODY_TYPES.ENDOMORPH
}

/**
 * Display label for a body type / somatotype, e.g. "Mesomorph (Athletic)".
 * Single source for every screen and the PDF report, so they always match.
 */
export function translateBodyType(bodyType: string | null | undefined): string {
    if (!bodyType) return 'Not specified'

    const lower = bodyType.trim().toLowerCase()
    const key = LEGACY_BODY_TYPES[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1)

    return BODY_TYPE_LABELS[key as keyof typeof BODY_TYPE_LABELS] ?? bodyType
}

/**
 * Display label for the global classification (low / medium / high)
 */
export function translateClassification(classification: string | null | undefined): string {
    if (!classification) return 'N/A'

    const translations: Record<string, string> = {
        'high': 'Above Average',
        'medium': 'Average',
        'low': 'Below Average'
    }

    return translations[classification.toLowerCase()] || classification
}

/**
 * Gets the badge CSS class for a classification
 */
export function getClassificationBadgeClass(classification: string | null | undefined): string {
    if (!classification) return 'badge-promedio'

    const classes: Record<string, string> = {
        'high': 'badge-encima',
        'medium': 'badge-promedio',
        'low': 'badge-debajo'
    }

    return classes[classification.toLowerCase()] || 'badge-promedio'
}
