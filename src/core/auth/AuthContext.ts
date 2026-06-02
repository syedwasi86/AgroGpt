import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'BOOTING' | 'AUTH_CHECK' | 'PROFILE_CHECK' | 'INITIAL_SYNC' | 'READY' | 'READY_WITH_WARNING' | 'ERROR'

export type AuthContextType = {
  session: Session | null
  user: User | null
  status: AuthStatus
  busy: boolean
  signInWithGoogle: () => Promise<{ error: unknown }>
  signInWithPhone: (phone: string) => Promise<{ error: unknown }>
  verifyOtp: (phone: string, token: string) => Promise<{ error: unknown }>
  signOut: () => Promise<{ error: unknown }>
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  status: 'BOOTING',
  busy: false,
  signInWithGoogle: async () => ({ error: null }),
  signInWithPhone: async () => ({ error: null }),
  verifyOtp: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
})

export const useAuth = () => useContext(AuthContext)
