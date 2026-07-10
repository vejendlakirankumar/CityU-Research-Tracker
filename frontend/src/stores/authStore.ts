import { create } from 'zustand'
import type { AuthUser } from '../types/auth'
import { queryClient } from '../lib/queryClient'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  profileOpen: boolean
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
  updateUser: (user: AuthUser) => void
  openProfile: () => void
  closeProfile: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  // Restore token from sessionStorage on page reload (survives tab, not window close)
  token: sessionStorage.getItem('rrp_token'),
  isLoading: false,
  profileOpen: false,

  setAuth: (user, token) => {
    // Drop any cached query data belonging to a previous session so a newly
    // authenticated (possibly lower-privilege) user never sees stale data.
    queryClient.clear()
    sessionStorage.setItem('rrp_token', token)
    set({ user, token })
  },

  clearAuth: () => {
    // Wipe all cached API responses on logout / 401 so the next user cannot
    // see the previous user's data while React Query revalidates.
    queryClient.clear()
    sessionStorage.removeItem('rrp_token')
    set({ user: null, token: null })
  },

  setLoading: (v) => set({ isLoading: v }),
  updateUser: (user) => set({ user }),
  openProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
}))
