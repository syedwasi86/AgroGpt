import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'

export function ProtectedRoute() {
  const { session } = useAuth()
  const location = useLocation()
  
  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }
  
  return <Outlet />
}
