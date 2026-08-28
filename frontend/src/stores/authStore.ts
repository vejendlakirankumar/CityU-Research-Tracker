import { create } from 'zustand'
import type { AuthUser, Role } from '../types/auth'
import { queryClient } from '../lib/queryClient'

// Priority used to pick a sensible default active role for multi-role users.
// Higher-privilege roles win so behaviour is unchanged for single-role users.
const ROLE_PRIORITY: Role[] = ['admin', 'coordinator', 'reviewer', 'student']

/** Pick the highest-priority role from a user's role list. */
export function pickDefaultRole(roles: Role[]): Role | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role
  }
  return roles[0] ?? null
}

/**
 * Resolve the active role for a user: reuse the previously selected role if the
 * user still has it, otherwise fall back to the highest-priority role.
 */
function resolveActiveRole(user: AuthUser): Role | null {
  const stored = sessionStorage.getItem('rrp_active_role') as Role | null
  if (stored && user.roles.includes(stored)) return stored
  return pickDefaultRole(user.roles)
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  // The single role the user is currently "acting as". Scopes the UI so that
  // one role does not hide another role's features for multi-role users.
  activeRole: Role | null
  isLoading: boolean
  profileOpen: boolean
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
  updateUser: (user: AuthUser) => void
  setActiveRole: (role: Role) => void
  openProfile: () => void
  closeProfile: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  // Restore token from sessionStorage on page reload (survives tab, not window close)
  token: sessionStorage.getItem('rrp_token'),
  activeRole: null,
  isLoading: false,
  profileOpen: false,

  setAuth: (user, token) => {
    // Drop any cached query data belonging to a previous session so a newly
    // authenticated (possibly lower-privilege) user never sees stale data.
    queryClient.clear()
    sessionStorage.setItem('rrp_token', token)
    const activeRole = resolveActiveRole(user)
    if (activeRole) sessionStorage.setItem('rrp_active_role', activeRole)
    set({ user, token, activeRole })
  },

  clearAuth: () => {
    // Wipe all cached API responses on logout / 401 so the next user cannot
    // see the previous user's data while React Query revalidates.
    queryClient.clear()
    sessionStorage.removeItem('rrp_token')
    sessionStorage.removeItem('rrp_active_role')
    set({ user: null, token: null, activeRole: null })
  },

  setLoading: (v) => set({ isLoading: v }),
  updateUser: (user) =>
    set((state) => {
      // Keep the active role valid if the user's roles changed.
      const activeRole =
        state.activeRole && user.roles.includes(state.activeRole)
          ? state.activeRole
          : resolveActiveRole(user)
      if (activeRole) sessionStorage.setItem('rrp_active_role', activeRole)
      return { user, activeRole }
    }),
  setActiveRole: (role) => {
    sessionStorage.setItem('rrp_active_role', role)
    // Clear cached query data so role-scoped views refetch for the new lens.
    queryClient.clear()
    set({ activeRole: role })
  },
  openProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
}))

/**
 * Read the role the user is currently acting as. Falls back to the default
 * role derived from the user's roles when no explicit selection exists yet.
 */
export function useActiveRole(): Role | null {
  return useAuthStore((s) =>
    s.activeRole ?? (s.user ? pickDefaultRole(s.user.roles) : null),
  )
}
