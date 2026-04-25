import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

const MOCK_USER = {
  id: 'dev-bypass-user',
  email: 'dev@agrogpt.local',
  phone: '',
  user_metadata: { full_name: 'Dev Farmer' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User

const MOCK_SESSION = {
  access_token: 'dev-token',
  refresh_token: 'dev-refresh',
  expires_in: 86400,
  token_type: 'bearer',
  user: MOCK_USER,
} as unknown as Session

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  devLogin: () => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  devLogin: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function syncProfile(user: User) {
    try {
      // Identity Linking Logic: Sync with Supabase 'profiles' table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
        return
      }

      if (!data) {
        // Insert new profile
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.user_metadata?.full_name || ''
        })
      } else {
        // Identity Linking: Update missing identifiers if user adds them later
        const updates: Record<string, string> = {}
        if (!data.email && user.email) updates.email = user.email
        if (!data.phone && user.phone) updates.phone = user.phone
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', user.id)
        }
      }
    } catch (e) {
      console.error('Error syncing profile:', e)
    }
  }

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session) {
        syncProfile(session.user)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await syncProfile(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])
  const devLogin = () => {
    if (!import.meta.env.DEV) return
    setSession(MOCK_SESSION)
    setUser(MOCK_USER)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, devLogin }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
