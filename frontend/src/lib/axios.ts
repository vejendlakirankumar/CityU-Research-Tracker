import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

// Attach Bearer token + active role from store on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Tell the backend which role the user is currently acting as so authorization
  // is scoped to that single role (matches the UI's role switcher).
  const activeRole =
    useAuthStore.getState().activeRole ?? sessionStorage.getItem('rrp_active_role')
  if (activeRole) {
    config.headers['X-Active-Role'] = activeRole
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
    }
    return Promise.reject(error)
  },
)

export default api
