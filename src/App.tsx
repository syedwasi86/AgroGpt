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
import { syncData } from './core/api/syncEngine'
import { useAuth } from './core/auth/AuthProvider'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { Loader2 } from 'lucide-react'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { CropProvider } from './core/context/CropContext'

function ProtectedShell() {
  const { user } = useAuth()
  const profile = useLiveQuery(async () => {
    if (!user?.id) return null
    return (await db.profiles.get(user.id)) || null
  }, [user])

  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black/90">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    )
  }

  // If onboarding is not completed, redirect to /onboarding
  if (!profile || !profile.onboarding_completed) {
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
        await syncData()
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
