import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import type { Role } from '../../types/auth'

interface Props {
  children: React.ReactNode
  allowedRoles: Role[]
}

export default function RoleRoute({ children, allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const hasAccess = !!user && user.roles.some((role) => allowedRoles.includes(role))

  if (!hasAccess) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}
