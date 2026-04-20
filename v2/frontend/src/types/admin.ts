// ── Submission Type (Category) Admin ─────────────────────────────────────────

export interface SubmissionTypeAdmin {
  id: string
  slug: string
  label: string
  description: string | null
  is_gated_review: boolean
  is_blind_review: boolean
  allow_meetings: boolean
  max_file_size_mb: number
  allowed_extensions: string[]
  max_files: number
  is_active: boolean
  workflow_id: string | null
  workflow?: WorkflowDefinition | null
  submissions_count?: number
  created_at: string
  updated_at: string
}

export interface SubmissionTypeFormData {
  label: string
  slug: string
  description: string
  is_gated_review: boolean
  is_blind_review: boolean
  allow_meetings: boolean
  max_file_size_mb: number
  allowed_extensions: string[]
  max_files: number
  is_active: boolean
  workflow_id: string | null
}

// ── Workflow Admin ────────────────────────────────────────────────────────────

export type ExecutionType = 'PARALLEL' | 'SEQUENTIAL'
export type ApprovalStrategy = 'ALL' | 'MAJORITY' | 'ANY'
export type RevisionRestartPolicy = 'FULL_RESTART' | 'RESUME_FROM_REVISION'
export type FinalStatusOnPass = 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED'

export interface StageDefinition {
  id: string
  workflow_id: string
  name: string
  order: number
  stage_role_label: string
  is_gatekeeper: boolean
  execution_type: ExecutionType
  approval_strategy: ApprovalStrategy
  min_approvals: number
  is_anonymous: boolean
  due_days: number
  decision_options: string[]
  auto_assignment: { strategy: 'MANUAL' | 'ROUND_ROBIN' | 'POOL' }
}

export interface WorkflowDefinition {
  id: string
  name: string
  revision_restart_policy: RevisionRestartPolicy
  final_status_on_pass: FinalStatusOnPass
  is_active: boolean
  stages: StageDefinition[]
  created_at: string
  updated_at: string
}

export interface WorkflowFormData {
  name: string
  revision_restart_policy: RevisionRestartPolicy
  final_status_on_pass: FinalStatusOnPass
  is_active: boolean
  stages: Omit<StageDefinition, 'id' | 'workflow_id'>[]
}

export const DECISION_OPTIONS_DEFAULT = ['APPROVE', 'REQUEST_CHANGES', 'REJECT']
