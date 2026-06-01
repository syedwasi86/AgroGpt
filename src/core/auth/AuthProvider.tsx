import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { db } from '../../lib/db'
import { syncData } from '../api/syncEngine'
import i18n from '../i18n'

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
  busy: boolean
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithPhone: (phone: string) => Promise<{ error: any }>
  verifyOtp: (phone: string, token: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  devLogin: () => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  busy: false,
  signInWithGoogle: async () => ({ error: null }),
  signInWithPhone: async () => ({ error: null }),
  verifyOtp: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  devLogin: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function syncProfile(user: User) {
    try {
      // 1. Align local Dexie profile ID to the authenticated user's ID
      const localProfiles = await db.profiles.toArray()
      let localData = localProfiles.length > 0 ? localProfiles[0] : null
      
      if (localData && localData.id !== user.id) {
        await db.profiles.delete(localData.id)
        localData.id = user.id
        localData.updated_at = new Date().toISOString()
        await db.profiles.put(localData)
      } else if (!localData) {
        localData = {
          id: user.id,
          phone: user.phone || '',
          name: user.user_metadata?.full_name || '',
          email: user.email || '',
          city: '', soil_type: '', primary_crop: '', total_acreage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        await db.profiles.put(localData)
      }

      // 2. Sync with Supabase
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
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          phone: user.phone,
          full_name: user.user_metadata?.full_name || ''
        })
      } else {
        // Cloud profile exists, write it to Dexie to restore onboarding state
        await db.profiles.put({
          ...data,
          name: data.name || data.full_name || user.user_metadata?.full_name || '',
          sync_status: 'synced'
        })

        // Change active i18n language if preference exists in Supabase profile
        if (data.preferred_language) {
          void i18n.changeLanguage(data.preferred_language)
          const settings = await db.user_settings.toArray().then(a => a[0])
          if (settings) {
            await db.user_settings.update(settings.id, {
              language: data.preferred_language,
              updated_at: new Date().toISOString()
            })
          }
        }

        const updates: Record<string, string> = {}
        if (!data.email && user.email) updates.email = user.email
        if (!data.phone && user.phone) updates.phone = user.phone
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', user.id)
          await db.profiles.update(user.id, updates)
        }
      }
    } catch (e) {
      console.error('Error syncing profile:', e)
    }
  }

  useEffect(() => {
    let mounted = true;
    console.log('[AuthProvider] Initializing session...');

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        console.log('[AuthProvider] Session retrieved:', session?.user?.id || 'No session');
        setSession(session);
        setUser(session?.user ?? null);

        if (session) {
          console.log('[AuthProvider] Starting profile sync...');
          // Don't await syncProfile here to prevent blocking the entire app if Supabase/Dexie is slow
          syncProfile(session.user)
            .catch(e => console.error('[AuthProvider] Profile sync error:', e))
            .finally(() => {
              if (mounted) setLoading(false);
            });
          
          syncData(session).catch(e => console.error('[AuthProvider] Initial sync error:', e));
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[AuthProvider] Critical auth init error:', err);
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state change:', event);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        syncProfile(session.user).catch(e => console.error('Auth state sync failed:', e));
        syncData(session).catch(e => console.error('Auth state sync failed:', e));
      } else if (event === 'SIGNED_OUT') {

        try {
          await Promise.all(db.tables.map(table => table.clear()))
          localStorage.removeItem('yield_user')
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i)
            if (key && key.startsWith('sb-')) {
              localStorage.removeItem(key)
            }
          }
        } catch (e) {
          console.error('Error clearing local data on sign out:', e)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
      return { data, error: null }
    } catch (error: any) {
      setBusy(false)
      return { error }
    }
  }

  const signInWithPhone = async (phone: string) => {
    setBusy(true)
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      })
      if (error) throw error
      return { data, error: null }
    } catch (error: any) {
      return { error }
    } finally {
      setBusy(false)
    }
  }

  const verifyOtp = async (phone: string, token: string) => {
    setBusy(true)
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token,
        type: 'sms'
      })
      if (error) throw error
      return { data, error: null }
    } catch (error: any) {
      return { error }
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    
    // 1. Unconditionally and immediately destroy local session for reliable UX
    // This instantly triggers the ProtectedRoute to navigate to /auth
    setSession(null)
    setUser(null)

    try {
      // 2. Purge offline database to prevent cross-account data bleed
      await Promise.all(db.tables.map(table => table.clear())).catch(e => console.error('Dexie clear error:', e))
      
      localStorage.removeItem('yield_user')
      
      // Nuke all Supabase tokens from local storage so getSession() doesn't restore a zombie session
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      }

      // 3. Attempt to tell Supabase to invalidate the token in the background
      // We do not await this, so a slow network or hanging request won't freeze the app
      if (session && session.user?.id !== 'dev-bypass-user') {
        supabase.auth.signOut().catch(e => console.warn('Supabase signout skipped/failed:', e))
      }
      
      return { error: null }
    } catch (error: any) {
      console.error('Logout cleanup error:', error)
      return { error }
    } finally {
      setBusy(false)
    }
  }

  const devLogin = () => {
    if (!import.meta.env.DEV) return
    setSession(MOCK_SESSION)
    setUser(MOCK_USER)
  }

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      busy, 
      signInWithGoogle, 
      signInWithPhone, 
      verifyOtp,
      signOut,
      devLogin 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
