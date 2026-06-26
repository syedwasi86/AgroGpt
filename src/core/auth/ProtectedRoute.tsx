import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { AppLoader } from '../../components/AppLoader'

export function ProtectedRoute() {
  const { session, isLoading } = useAuth()
  const location = useLocation()
  
  if (isLoading) {
    return <AppLoader message="Authenticating..." subMessage="Establishing a secure offline-first workspace" />
  }
  
  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }
  
  return <Outlet />
}
