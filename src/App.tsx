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
import { useEffect, useRef } from 'react'
import { pushChanges, pullUpdates } from './core/api/syncEngine'
import { useAuth } from './core/auth/AuthContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { AppLoader } from './components/AppLoader'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { CropProvider } from './core/context/CropContext'
import { useConnectivity } from './hooks/useConnectivity'

function ProtectedShell() {
  const { session } = useAuth()
  const connectivity = useConnectivity()
  const wasOffline = useRef(false)

  // Track the transition from offline/local-only -> online
  useEffect(() => {
    const isNowOnline = connectivity === 'online'
    const isNowOffline = connectivity === 'offline' || connectivity === 'local-only'

    if (wasOffline.current && isNowOnline && session) {
      console.log('[ProtectedShell] Reconnection detected. Initiating recovery sync sequence (push then pull).')
      
      pushChanges(session)
        .then(() => pullUpdates(session))
        .catch(err => {
          console.error('[ProtectedShell] Offline-to-online recovery sync failed:', err)
        })
    }

    if (isNowOffline) {
      wasOffline.current = true
    } else if (isNowOnline) {
      wasOffline.current = false
    }
  }, [connectivity, session])

  const profileQuery = useLiveQuery(async () => {
    if (!session?.user?.id) return { isLoaded: true, data: null };
    const data = await db.profiles.get(session.user.id);
    return { isLoaded: true, data: data || null };
  }, [session?.user?.id]);

  // 1. If profileQuery is undefined, Dexie is still fetching.
  if (!profileQuery) return <AppLoader />;

  // 2. If it is loaded but data is null, the user hasn't onboarded.
  if (profileQuery.isLoaded && !profileQuery.data) return <Navigate to="/onboarding" replace />;

  // 3. If onboarding is not completed
  if (profileQuery.data && !profileQuery.data.onboarding_completed) return <Navigate to="/onboarding" replace />;

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
