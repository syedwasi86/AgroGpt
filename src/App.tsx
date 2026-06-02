import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AIAssistantPill } from './components/AIAssistantPill'
import { AuthProvider } from './core/auth/AuthProvider'
import { ProtectedRoute } from './core/auth/ProtectedRoute'
import { PublicRoute } from './components/PublicRoute'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { FieldVisionPage } from './features/field-vision/FieldVisionPage'
import { PrecisionPlanningPage } from './features/crop-calendar/pages/PrecisionPlanningPage'
import { DigitalLedgerPage } from './features/digital-khata/DigitalLedgerPage'
import { MarketPostHarvestPage } from './features/market/MarketPostHarvestPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { Auth } from './pages/Auth'
import { ProfilePage } from './features/settings/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useEffect } from 'react'
import { backgroundSync } from './core/api/syncEngine'
import { useAuth } from './core/auth/AuthContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { AppLoader } from './components/AppLoader'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { CropProvider } from './core/context/CropContext'

function ProtectedShell() {
  const { user } = useAuth()

  const shellData = useLiveQuery(async () => {
    if (!user?.id) return null
    const profile = await db.profiles.get(user.id)
    const plansCount = await db.crop_plans.count()
    return { profile, hasCropPlan: plansCount > 0 }
  }, [user])

  useEffect(() => {
    if (shellData?.profile && !shellData.profile.onboarding_completed && shellData.hasCropPlan) {
      console.log('[ProtectedShell] User has crop plans. Auto-completing onboarding flag.')
      db.profiles.update(shellData.profile.id, {
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      }).then(() => {
        backgroundSync().catch(e => console.warn('Sync after onboarding bypass failed:', e))
      })
    }
  }, [shellData])

  if (shellData === undefined) {
    return <AppLoader message="Loading workspace..." subMessage="Fetching profile" />
  }

  const { profile, hasCropPlan } = shellData || { profile: null, hasCropPlan: false }

  const onboardingCompleted = profile?.onboarding_completed === true
  const hasActiveCropPlan = !!profile?.active_crop_plan_id || hasCropPlan

  // If the user has not completed onboarding and has no crop plans, forcefully redirect to onboarding
  if (!onboardingCompleted && !hasActiveCropPlan) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <CropProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <AIAssistantPill />
    </CropProvider>
  )
}

export default function App() {
  useEffect(() => {
    const handleOnline = async () => {
      try {
        await backgroundSync()
      } catch (err) {
        console.error('Auto-sync on reconnect failed:', err)
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return (
    <AuthProvider>
      <div className="agro-bg min-h-screen">
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/auth" element={<Auth />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<ProtectedShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/field-vision" element={<FieldVisionPage />} />
              <Route path="/crop-calendar" element={<PrecisionPlanningPage />} />
              <Route path="/digital-khata" element={<DigitalLedgerPage />} />
              <Route path="/market" element={<MarketPostHarvestPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </div>
    </AuthProvider>
  )
}
