import { Navigate, useLocation } from 'react-router-dom'
import { useActiveRole, useAuthStore } from '../../stores/authStore'
import type { Role } from '../../types/auth'

interface Props {
  children: React.ReactNode
  allowedRoles: Role[]
}

export default function RoleRoute({ children, allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user)
  const activeRole = useActiveRole()
  const location = useLocation()

  // Scope access to the role the user is currently acting as. The real role
  // list still governs server-side authorization; this only shapes the UI.
  const hasAccess = !!user && !!activeRole && allowedRoles.includes(activeRole)

  if (!hasAccess) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />
  }

  return <>{children}</>
}
