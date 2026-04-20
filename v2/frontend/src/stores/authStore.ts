import { create } from 'zustand'
import type { AuthUser } from '../types/auth'

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
    sessionStorage.setItem('rrp_token', token)
    set({ user, token })
  },

  clearAuth: () => {
    sessionStorage.removeItem('rrp_token')
    set({ user: null, token: null })
  },

  setLoading: (v) => set({ isLoading: v }),
  updateUser: (user) => set({ user }),
  openProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
}))
