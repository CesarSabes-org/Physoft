// ============================================
// UTILS: Date utilities
// ============================================

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string | Date | null | undefined): number {
  if (!birthDate) return 0

  const birth = new Date(birthDate)
  const today = new Date()

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

/**
 * Format date to locale string
 */
export function formatDate(
  date: string | Date | null | undefined,
  format: 'short' | 'long' = 'short',
  locale: string = 'en-US'
): string {
  if (!date) return 'N/A'

  const dateObj = new Date(date)

  if (format === 'long') {
    return dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return dateObj.toLocaleDateString(locale)
}

/**
 * Format a plain 'YYYY-MM-DD' date-only string as 'MM/DD/YYYY' via string
 * parsing (no `Date` object involved). Avoids the classic off-by-one-day
 * bug where `new Date('YYYY-MM-DD')` parses as UTC midnight and then shifts
 * to the previous day once rendered in a negative-UTC-offset timezone.
 */
export function formatBirthDateMMDDYYYY(isoDate: string | null | undefined): string {
  if (!isoDate) return 'N/A'

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return 'N/A'

  const [, year, month, day] = match
  return `${month}/${day}/${year}`
}

/**
 * Get relative time (e.g., "2 days ago")
 */
export function getRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'

  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(dateObj)) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}
