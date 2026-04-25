import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { readYieldUser } from '../../lib/authSession'

export function AuthGuard() {
  const location = useLocation()

  if (!readYieldUser()) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  return <Outlet />
}
