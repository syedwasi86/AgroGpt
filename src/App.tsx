import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AIAssistantPill } from './components/AIAssistantPill'
import { AuthProvider } from './core/auth/AuthProvider'
import { ProtectedRoute } from './core/auth/ProtectedRoute'
import { PublicRoute } from './components/PublicRoute'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { FieldVisionPage } from './features/field-vision/FieldVisionPage'
import { PrecisionPlanningPage } from './features/calendar/PrecisionPlanningPage'
import { DigitalLedgerPage } from './features/digital-ledger/DigitalLedgerPage'
import { MarketPostHarvestPage } from './features/market/MarketPostHarvestPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { Auth } from './pages/Auth'
import { ProfilePage } from './features/settings/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useEffect } from 'react'
import { syncData } from './core/api/syncEngine'
import { CropProvider } from './core/context/CropContext'

function ProtectedShell() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <AIAssistantPill />
    </>
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
      <CropProvider>
        <div className="agro-bg min-h-screen">
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/auth" element={<Auth />} />
            </Route>
            
            <Route element={<ProtectedRoute />}>
              <Route element={<ProtectedShell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/field-vision" element={<FieldVisionPage />} />
                <Route path="/precision-planning" element={<PrecisionPlanningPage />} />
                <Route path="/digital-ledger" element={<DigitalLedgerPage />} />
                <Route path="/market" element={<MarketPostHarvestPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </div>
      </CropProvider>
    </AuthProvider>
  )
}
