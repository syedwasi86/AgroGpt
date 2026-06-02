import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../core/auth/AuthContext'

export function PublicRoute() {
  const { session } = useAuth()
  
  if (session) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <Outlet />
}
