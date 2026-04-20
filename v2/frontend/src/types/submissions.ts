// ── Submission Types ──────────────────────────────────────────────────────────

export interface SubmissionType {
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
}

// ── Programs ──────────────────────────────────────────────────────────────────

export interface Program {
  id: string
  name: string
  school: string
  program_director_id: string | null
  program_director?: { id: string; name: string; email: string } | null
  group_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Submissions ───────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AWAITING_REVIEWERS'
  | 'IN_REVIEW'
  | 'REVISION_REQUIRED'
  | 'PENDING_RELEASE'
  | 'ACCEPTED'
  | 'CONDITIONALLY_ACCEPTED'
  | 'REJECTED'
  | 'APPEAL_PENDING'
  | 'WITHDRAWN'
  | 'CANCELLED'

export interface SubmissionVersion {
  id: string
  submission_id: string
  version_number: number
  document_paths: string[]
  change_summary: string | null
  submitted_at: string
  file_count: number
}

export interface SubmissionListItem {
  id: string
  title: string
  status: SubmissionStatus
  current_version: number
  submission_type: { id: string; slug: string; label: string } | null
  program: { id: string; name: string } | null
  submitter: { id: string; name: string; email: string }
  created_at: string
  updated_at: string
}

export interface Submission extends SubmissionListItem {
  abstract: string | null
  metadata: Record<string, unknown>
  is_locked: boolean
  versions: SubmissionVersion[]
  submission_type: (SubmissionListItem['submission_type'] & {
    allowed_extensions: string[]
    max_file_size_mb: number
    max_files: number
  }) | null
}

export interface SubmissionAuthor {
  id: string
  submission_id: string
  user_id: string | null
  name: string
  email: string
  affiliation: string | null
  is_corresponding: boolean
  author_order: number
  has_account: boolean
  invite_pending: boolean
  invited_at: string | null
  joined_at: string | null
  added_at: string
}

export interface SubmissionReviewer {
  id: string
  submission_id: string
  stage_id: string
  stage: { id: string; name: string; stage_role_label: string; order: number } | null
  user_id: string
  user: { id: string; name: string; email: string; org_role: string | null } | null
  assigned_by: string | null
  assigned_at: string
  status: 'pending' | 'accepted' | 'declined' | 'completed'
  due_at: string | null
  decision: 'approve' | 'reject' | 'revise' | null
  decision_at: string | null
  comments: string | null
}

export interface SubmissionAuthor {
  id: string
  submission_id: string
  user_id: string | null
  name: string
  email: string
  affiliation: string | null
  is_corresponding: boolean
  author_order: number
  has_account: boolean
  invite_pending: boolean
  invited_at: string | null
  joined_at: string | null
  added_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT:                  'Draft',
  SUBMITTED:              'Submitted',
  AWAITING_REVIEWERS:     'Awaiting Reviewers',
  IN_REVIEW:              'In Review',
  REVISION_REQUIRED:      'Revision Required',
  PENDING_RELEASE:        'Pending Release',
  ACCEPTED:               'Accepted',
  CONDITIONALLY_ACCEPTED: 'Conditionally Accepted',
  REJECTED:               'Rejected',
  APPEAL_PENDING:         'Appeal Pending',
  WITHDRAWN:              'Withdrawn',
  CANCELLED:              'Cancelled',
}

export const STATUS_COLORS: Record<SubmissionStatus, string> = {
  DRAFT:                  'bg-gray-100 text-gray-600',
  SUBMITTED:              'bg-blue-100 text-blue-700',
  AWAITING_REVIEWERS:     'bg-purple-100 text-purple-700',
  IN_REVIEW:              'bg-yellow-100 text-yellow-700',
  REVISION_REQUIRED:      'bg-orange-100 text-orange-700',
  PENDING_RELEASE:        'bg-amber-100 text-amber-800',
  ACCEPTED:               'bg-green-100 text-green-700',
  CONDITIONALLY_ACCEPTED: 'bg-teal-100 text-teal-700',
  REJECTED:               'bg-red-100 text-red-700',
  APPEAL_PENDING:         'bg-rose-100 text-rose-700',
  WITHDRAWN:              'bg-gray-100 text-gray-500',
  CANCELLED:              'bg-gray-100 text-gray-400',
}

// ── Activity / Timeline ───────────────────────────────────────────────────────

export type ActivityEventType =
  | 'created'
  | 'version_uploaded'
  | 'review_decision'
  | 'system'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  label: string
  date: string
  actor?: string | null
  stage?: string | null
  note?: string | null
  decision?: 'approve' | 'reject' | 'revise' | null
}

// ── Reviewer Feedback (student-visible) ───────────────────────────────────────

export interface FeedbackItem {
  id: string
  stage: { id: string; name: string; role: string } | null
  decision: 'approve' | 'reject' | 'revise'
  decision_at: string
  comments: string | null
  reviewer: { name: string } | null
}

// ── Appeal ────────────────────────────────────────────────────────────────────

export interface Appeal {
  id: string
  status: 'pending' | 'under_review' | 'accepted' | 'rejected'
  grounds: string
  resolution_note: string | null
  created_at: string
}

// ── Review Progress ───────────────────────────────────────────────────────────

export type ReviewStageStatus =
  | 'pending'
  | 'needs_assignment'
  | 'assigned'
  | 'in_progress'
  | 'completed'

export interface ReviewProgressStage {
  id: string
  name: string
  order: number
  role_label: string
  reviewers_count: number
  completed_count: number
  status: ReviewStageStatus
  outcome: 'approved' | 'revision' | 'rejected' | null
  min_approvals: number
  due_days: number | null
  // null = blind review (hidden from this user); array = visible reviewer list
  reviewers: Array<{
    id: string
    name: string | null
    status: string
    due_at: string | null
  }> | null
}

// ── Submission Meeting ────────────────────────────────────────────────────────

export interface SubmissionMeeting {
  id: string
  submission_id: string
  stage_id: string | null
  stage: { id: string; name: string } | null
  requested_by: string
  requester: { id: string; name: string; email: string } | null
  title: string
  description: string | null
  proposed_at: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed'
  confirmed_at: string | null
  meeting_link: string | null
  notes: string | null
  created_at: string
}
