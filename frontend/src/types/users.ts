import type { Role } from './auth'

// ── User types ────────────────────────────────────────────────────────────────

export interface UserGroup {
  id: string
  name: string
  type: GroupType
  group_role: GroupRole
}

export interface User {
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
  groups?: UserGroup[]
  is_active: boolean
  is_emergency_admin: boolean
  locked_at: string | null
  failed_login_attempts: number
  last_login_at: string | null
  last_login_attempt_at: string | null
  last_login_success: boolean | null
  created_at: string
}

export interface CreateUserRequest {
  first_name: string
  last_name: string
  email: string
  organization?: string | null
  org_role?: string | null
  password: string
  password_confirmation: string
  roles: Role[]
  program_id?: string | null
  is_active?: boolean
}

export interface UpdateUserRequest {
  first_name?: string
  last_name?: string
  email?: string
  organization?: string | null
  org_role?: string | null
  roles?: Role[]
  program_id?: string | null
  is_active?: boolean
}

export interface ResetPasswordRequest {
  password: string
  password_confirmation: string
}

// ── Group types ───────────────────────────────────────────────────────────────

export type GroupType = 'department' | 'faculty' | 'school' | 'custom'
export type GroupRole = 'member' | 'lead' | 'manager'

export interface Group {
  id: string
  name: string
  slug: string
  type: GroupType
  is_active: boolean
  users_count: number | null
  parent_id: string | null
  parent: { id: string; name: string } | null
  children?: { id: string; name: string; type: GroupType }[]
  members?: GroupMember[]
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  name: string
  email: string
  roles: Role[]
  is_active: boolean
  group_role: GroupRole
  joined_at: string
}

export interface CreateGroupRequest {
  name: string
  slug?: string
  type: GroupType
  parent_id?: string | null
  is_active?: boolean
}

export interface UpdateGroupRequest {
  name?: string
  slug?: string
  type?: GroupType
  parent_id?: string | null
  is_active?: boolean
}

// ── Paginated response wrapper ────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}
