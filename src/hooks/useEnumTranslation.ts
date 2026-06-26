import { useTranslation } from 'react-i18next'

/**
 * Sanitizes raw database strings into stable, camelCase keys for localization lookup.
 * E.g., "Red Sandy Loam" -> "redSandyLoam", "Don't Know" -> "dontKnow", "Paddy (Dhan)" -> "paddyDhan"
 */
export function sanitizeEnumKey(dbValue: string): string {
  if (!dbValue) return ''
  const cleaned = dbValue
    .replace(/[^a-zA-Z0-9\s-/]/g, '') // Remove special characters like quotes, parentheses
    .replace(/[-/]/g, ' ')            // Convert hyphens and slashes to spaces
    .trim()

  return cleaned
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) return word.toLowerCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

/**
 * Custom hook to translate database-stored enums using the "enums" namespace.
 * Safely falls back to the original database string if no translation key is matched.
 */
export function useEnumTranslation() {
  const { t } = useTranslation('enums')

  const tEnum = (category: string, dbValue: string | string[] | undefined | null): string => {
    if (dbValue === undefined || dbValue === null) return ''
    
    if (Array.isArray(dbValue)) {
      return dbValue.map(val => tEnum(category, val)).join(', ')
    }

    const sanitizedKey = sanitizeEnumKey(dbValue)
    if (!sanitizedKey) return dbValue

    const fullKey = `${category}.${sanitizedKey}`
    return t(fullKey, dbValue)
  }

  return { tEnum }
}
export function translateEnumInline(category: string, dbValue: string | string[] | undefined | null, t: any): string {
  if (dbValue === undefined || dbValue === null) return ''
  if (Array.isArray(dbValue)) {
    return dbValue.map(val => translateEnumInline(category, val, t)).join(', ')
  }
  const sanitizedKey = sanitizeEnumKey(dbValue)
  if (!sanitizedKey) return dbValue
  return t(`enums:${category}.${sanitizedKey}`, dbValue)
}
