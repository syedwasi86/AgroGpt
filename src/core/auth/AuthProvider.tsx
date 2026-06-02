import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { db } from '../../lib/db'
import { initialSync, backgroundSync } from '../api/syncEngine'
import { seedDefaultsIfEmpty } from '../../lib/repository'
import i18n from '../i18n'
import { AppLoader } from '../../components/AppLoader'
import { AuthContext } from './AuthContext'
import type { AuthStatus } from './AuthContext'


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatusState] = useState<AuthStatus>('BOOTING')
  const statusRef = useRef<AuthStatus>('BOOTING')

  const setStatus = (newStatus: AuthStatus) => {
    statusRef.current = newStatus
    setStatusState(newStatus)
  }

  const [busy, setBusy] = useState(false)

  const initialSyncCompletedRef = useRef(false)
  const authSyncInProgress = useRef(false)

  // Explicit Atomic Check — no blind upsert, strict existence test
  async function ensureProfileExists(user: User): Promise<void> {
    try {
      // 1. Atomic existence check on Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('[AuthProvider] Error checking profile:', error)
        throw error
      }

      if (!data) {
        // 2. Strict Separation — only create profile on explicit signup
        const isSignup = localStorage.getItem('is_signup') === 'true'
        if (isSignup) {
          console.log('[AuthProvider] ensureProfileExists - Creating new profile for signup...')
          // Use name/display_name — no full_name column
          const profileData = {
            id: user.id,
            email: user.email || '',
            phone: user.phone || '',
            name: user.user_metadata?.full_name || '',
            display_name: user.user_metadata?.full_name || '',
            onboarding_completed: false,
            version: 1,
            sync_status: 'synced' as const,
            city: '',
            soil_type: '',
            primary_crop: '',
            total_acreage: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          const { error: insertError } = await supabase.from('profiles').insert(profileData)
          if (insertError) {
            console.error('[AuthProvider] Profile insert failed:', insertError)
            throw insertError
          }
          // Seed locally
          await db.profiles.put({ ...profileData, sync_status: 'synced' })
        } else {
          console.warn('[AuthProvider] Login flow but profile missing on cloud — account may be incomplete.')
        }
      } else {
        // Profile exists in cloud — pull it down to local Dexie
        console.log('[AuthProvider] ensureProfileExists - Profile exists, hydrating local...')

        // Remove any stale mismatched profiles
        const localProfiles = await db.profiles.toArray()
        for (const lp of localProfiles) {
          if (lp.id !== user.id) {
            await db.profiles.delete(lp.id)
          }
        }

        await db.profiles.put({
          ...data,
          // Normalise name from either name or display_name (no full_name)
          name: data.name || data.display_name || user.user_metadata?.full_name || '',
          sync_status: 'synced',
        })

        if (data.preferred_language) {
          void i18n.changeLanguage(data.preferred_language)
        }
      }
    } catch (e) {
      console.error('[AuthProvider] ensureProfileExists failed:', e)
      throw e
    }
  }

  const runAuthSequence = async (sess: Session) => {
    if (authSyncInProgress.current) {
      console.log('[AuthProvider] Auth sync already in progress. Skipping.')
      return
    }

    authSyncInProgress.current = true

    try {
      // Clean up guest database tables on login to prevent duplicate key/constraint race conditions
      const isSignup = localStorage.getItem('is_signup') === 'true'
      if (!isSignup) {
        console.log('[AuthProvider] Login detected. Clearing local guest tables before hydration...')
        const tablesToClear = ['profiles', 'crop_plans', 'crop_stages', 'farm_tasks', 'transactions', 'scans', 'ai_queries', 'weather_adjustments']
        for (const tName of tablesToClear) {
          await db.table(tName).clear().catch((e: any) => console.warn(`Error clearing table ${tName}:`, e))
        }
      }

      setStatus('PROFILE_CHECK')
      await ensureProfileExists(sess.user)

      // One Initial Sync Per Session
      if (!initialSyncCompletedRef.current) {
        setStatus('INITIAL_SYNC')
        await initialSync(sess)
        initialSyncCompletedRef.current = true

        // Enable background push sync after hydration completes
        backgroundSync(sess).catch(e => console.warn('Background sync error:', e))
      }

      setStatus('READY')
    } catch (e) {
      console.error('Auth sequence failed:', e)
      setStatus('READY_WITH_WARNING')
    } finally {
      authSyncInProgress.current = false
    }
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      setStatus('AUTH_CHECK')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        setSession(session)
        setUser(session?.user ?? null)

        if (session) {
          await runAuthSequence(session)
        } else {
          // Guest mode: seed defaults if empty
          await seedDefaultsIfEmpty().catch(e => console.warn('Failed to seed defaults in guest mode:', e))
          setStatus('READY')
        }
      } catch (err) {
        console.error('[AuthProvider] Critical auth init error:', err)
        if (mounted) setStatus('ERROR')
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state change:', event)
      if (!mounted) return

      if (event === 'TOKEN_REFRESHED') {
        console.log('[AuthProvider] Ignoring TOKEN_REFRESHED event.')
        return
      }

      if (event === 'SIGNED_IN' && (statusRef.current === 'READY' || statusRef.current === 'READY_WITH_WARNING')) {
        console.log('[AuthProvider] Ignoring duplicate SIGNED_IN event because app is already READY.')
        return
      }

      setSession(session)
      setUser(session?.user ?? null)

      if (session && event === 'SIGNED_IN') {
        await runAuthSequence(session)
      } else if (event === 'SIGNED_OUT') {
        initialSyncCompletedRef.current = false
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
        // Seed guest defaults after sign out
        await seedDefaultsIfEmpty().catch(e => console.warn('Failed to seed defaults in guest mode:', e))
        setStatus('READY')
      }
      // INITIAL_SESSION is intentionally ignored for sync logic
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
      return { data, error: null }
    } catch (error: unknown) {
      setBusy(false)
      return { error }
    }
  }

  const signInWithPhone = async (phone: string) => {
    setBusy(true)
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
      const { data, error } = await supabase.auth.signInWithOtp({ phone: formattedPhone })
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
        type: 'sms',
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
    setSession(null)
    setUser(null)

    try {
      await Promise.all(db.tables.map(table => table.clear())).catch(e =>
        console.error('Dexie clear error:', e)
      )
      localStorage.removeItem('yield_user')
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      }
      // Always tell Supabase to invalidate the token
      supabase.auth.signOut().catch(e => console.warn('Supabase signout skipped/failed:', e))
      return { error: null }
    } catch (error: unknown) {
      console.error('Logout cleanup error:', error)
      return { error }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      status,
      busy,
      signInWithGoogle,
      signInWithPhone,
      verifyOtp,
      signOut,
    }}>
      {(status === 'BOOTING' || status === 'AUTH_CHECK' || status === 'PROFILE_CHECK' || status === 'INITIAL_SYNC') && (
        <AppLoader
          message={status === 'INITIAL_SYNC' ? 'Syncing your farm data...' : 'Authenticating...'}
          subMessage="Establishing a secure offline-first workspace"
        />
      )}
      {(status === 'READY' || status === 'READY_WITH_WARNING' || status === 'ERROR') && children}
    </AuthContext.Provider>
  )
}
