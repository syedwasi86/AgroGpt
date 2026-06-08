import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../core/auth/AuthContext'
import { AppLoader } from './AppLoader'

export function PublicRoute() {
  const { session, isLoading } = useAuth()
  
  if (isLoading) {
    return <AppLoader message="Authenticating..." subMessage="Establishing a secure offline-first workspace" />
  }
  
  if (session) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <Outlet />
}
