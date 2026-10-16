import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useActiveRole, useAuthStore } from '../../stores/authStore'
import api from '../../lib/axios'
import type { AuthUser } from '../../types/auth'

interface Props {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { user, token, setAuth, clearAuth, setLoading } = useAuthStore()
  const location = useLocation()
  const activeRole = useActiveRole()

  // If we have a token but no user (e.g., page reload), fetch /me
  useEffect(() => {
    if (token && !user) {
      setLoading(true)
      api
        .get<AuthUser>('/auth/me')
        .then((res) => setAuth(res.data, token))
        .catch(() => clearAuth())
        .finally(() => setLoading(false))
    }
  }, [token, user, setAuth, clearAuth, setLoading])

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // While fetching /me after reload, show nothing (or a spinner)
  if (token && !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-800" />
      </div>
    )
  }

  const readOnlyPages = ['/dashboard', '/submissions', '/reviews', '/reports', '/notifications', '/calendar']
  const currentPath = location.pathname.replace(/\/+$/, '')
  const isSubmissionDetail = /^\/submissions\/[0-9a-f-]{36}$/i.test(currentPath)
  if (activeRole === 'readonly' && !readOnlyPages.includes(currentPath) && !isSubmissionDetail) {
    return <Navigate to="/submissions" replace />
  }

  return <>{children}</>
}
