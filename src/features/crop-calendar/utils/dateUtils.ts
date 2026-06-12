/**
 * Normalizes a Date or string to a UTC YYYY-MM-DD string.
 */
export function normalizeToUtcDateString(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) {
    throw new Error('Invalid Date input')
  }
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns the current date in YYYY-MM-DD (UTC).
 */
export function getTodayUtcString(): string {
  return normalizeToUtcDateString(new Date())
}

/**
 * Adds an integer number of days to a UTC YYYY-MM-DD date string.
 */
export function addDaysUtc(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Create Date object using Date.UTC to prevent timezone offsets
  const d = new Date(Date.UTC(year, month - 1, day))
  d.setUTCDate(d.getUTCDate() + days)
  return normalizeToUtcDateString(d)
}

/**
 * Calculates absolute days elapsed between two YYYY-MM-DD strings.
 */
export function daysBetweenUtc(startStr: string, endStr: string): number {
  const [sy, sm, sd] = startStr.split('-').map(Number)
  const [ey, em, ed] = endStr.split('-').map(Number)
  const d1 = Date.UTC(sy, sm - 1, sd)
  const d2 = Date.UTC(ey, em - 1, ed)
  const diffTime = d2 - d1
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Checks if dateStr1 is chronologically before dateStr2.
 */
export function isBeforeUtc(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 < dateStr2
}

/**
 * Checks if dateStr1 is the same day or before dateStr2.
 */
export function isTodayOrBeforeUtc(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 <= dateStr2
}

/**
 * Formats a UTC YYYY-MM-DD date string to a localized display format.
 */
export function formatUtcToLocal(dateStr: string, locale = 'en-IN'): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Create a local date for presentation, or use simple mapping
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    numberingSystem: 'latn'
  })
}
