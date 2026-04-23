export type Role = 'admin' | 'coordinator' | 'reviewer' | 'student'

export interface AuthUser {
  id: string
  email: string
  name: string
  first_name: string | null
  last_name: string | null
  organization: string | null
  org_role: string | null
  roles: Role[]
  program_id: string | null
  program: { id: string; name: string } | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
  token: string
}

export interface ChangePasswordRequest {
  current_password: string
  password: string
  password_confirmation: string
}
