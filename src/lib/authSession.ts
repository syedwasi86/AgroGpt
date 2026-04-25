export const YIELD_USER_KEY = 'yield_user'

export type YieldUserSession = {
  name: string
  phone: string
  email?: string
}

export function readYieldUser(): YieldUserSession | null {
  const raw = localStorage.getItem(YIELD_USER_KEY)
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (typeof o.phone !== 'string') return null
    return {
      name: typeof o.name === 'string' ? o.name : '',
      phone: o.phone,
      email: typeof o.email === 'string' ? o.email : undefined,
    }
  } catch {
    return null
  }
}

export function writeYieldUser(session: YieldUserSession) {
  localStorage.setItem(YIELD_USER_KEY, JSON.stringify(session))
}
