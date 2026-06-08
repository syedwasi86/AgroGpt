import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { db } from '../../lib/db'
import { initialSync, backgroundSync, pullUpdates, pushChanges } from '../api/syncEngine'
import { seedDefaultsIfEmpty } from '../../lib/repository'
import i18n from '../i18n'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const isInitialBoot = useRef(true)
  const userRef = useRef<User | null>(null)
  const initialSyncCompletedRef = useRef(false)
  const authSyncInProgress = useRef(false)

  useEffect(() => {
    userRef.current = user
  }, [user])

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

  const runAuthSequence = async (sess: Session, clearTables = false) => {
    if (authSyncInProgress.current) {
      console.log('[AuthProvider] Auth sync already in progress. Skipping.')
      return
    }

    authSyncInProgress.current = true

    try {
      if (clearTables) {
        // Clean up guest database tables on login/signup to prevent duplicate key/constraint race conditions and clear default guest/dummy data
        console.log('[AuthProvider] Auth sequence detected. Clearing local guest tables before hydration/creation...')
        const tablesToClear = ['profiles', 'crop_plans', 'crop_stages', 'farm_tasks', 'transactions', 'scans', 'ai_queries', 'weather_adjustments', 'dashboard_cache']
        for (const tName of tablesToClear) {
          await db.table(tName).clear().catch((e: any) => console.warn(`Error clearing table ${tName}:`, e))
        }
      }

      await ensureProfileExists(sess.user)

      // One Initial Sync Per Session
      if (!initialSyncCompletedRef.current) {
        await initialSync(sess)
        initialSyncCompletedRef.current = true
      }
    } catch (e) {
      console.error('Auth sequence failed:', e)
    } finally {
      authSyncInProgress.current = false
    }
  }

  useEffect(() => {
    let mounted = true
    let authListener: any = null

    async function initialize() {
      try {
        const { data: { session: fetchedSession } } = await supabase.auth.getSession()
        if (!mounted) return

        setSession(fetchedSession)
        setUser(fetchedSession?.user ?? null)

        if (fetchedSession) {
          console.log('[AuthProvider] Boot session found. Hydrating via pullUpdates before dropping loader...')
          try {
            await pullUpdates(fetchedSession)
            initialSyncCompletedRef.current = true
          } catch (syncErr) {
            console.error('[AuthProvider] Boot pullUpdates failed:', syncErr)
          }
          await runAuthSequence(fetchedSession, false)
        } else {
          await seedDefaultsIfEmpty().catch(e => console.warn('Failed to seed defaults in guest mode:', e))
        }
      } catch (err) {
        console.error('[AuthProvider] Error during auth initialization:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
          isInitialBoot.current = false

          // Set up the listener AFTER getSession resolves to avoid duplicate initial runs
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            console.log('[AuthProvider] Auth state change:', event)
            if (!mounted) return

            if (event === 'TOKEN_REFRESHED') {
              return
            }

            // Avoid duplicate triggers for the same user if we already did it during initialization or previous event
            if (event === 'SIGNED_IN' && userRef.current?.id === currentSession?.user?.id) {
              console.log('[AuthProvider] Ignoring duplicate SIGNED_IN event for the same user.')
              return
            }

            if (event === 'INITIAL_SESSION') {
              console.log('[AuthProvider] INITIAL_SESSION event detected. Sync already completed on boot. Updating state.')
              setSession(currentSession)
              setUser(currentSession?.user ?? null)
              setIsLoading(false)
              return
            }

            if (event === 'SIGNED_IN') {
              setSession(currentSession)
              setUser(currentSession?.user ?? null)
              setIsLoading(false)

              if (currentSession) {
                const clearTables = !isInitialBoot.current
                await runAuthSequence(currentSession, clearTables)
              }
            } else if (event === 'SIGNED_OUT') {
              if (isInitialBoot.current) {
                console.log('[AuthProvider] SIGNED_OUT event ignored during boot/refresh phase.')
                return
              }

              console.log('[AuthProvider] SIGNED_OUT event detected. Wiping local data...')
              initialSyncCompletedRef.current = false
              setSession(null)
              setUser(null)
              setIsLoading(false)
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
              await seedDefaultsIfEmpty().catch(e => console.warn('Failed to seed defaults in guest mode:', e))
            }
          })
          authListener = subscription
        }
      }
    }

    initialize()

    return () => {
      mounted = false
      if (authListener) {
        authListener.unsubscribe()
      }
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

    // 1. Pre-flight push of any pending changes, safely caught
    try {
      if (session) {
        console.log('[AuthProvider] signOut - Pushing pending local changes before clearing database...')
        await pushChanges(session)
      }
    } catch (pushErr) {
      console.warn('[AuthProvider] Pre-flight pushChanges failed during signOut (offline/timeout):', pushErr)
    }

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
      await supabase.auth.signOut().catch(e => console.warn('Supabase signout skipped/failed:', e))
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
      isLoading,
      busy,
      signInWithGoogle,
      signInWithPhone,
      verifyOtp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
