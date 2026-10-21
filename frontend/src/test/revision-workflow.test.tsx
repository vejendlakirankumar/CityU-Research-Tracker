import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosHeaders } from 'axios'
import SubmissionDetailPage from '../pages/SubmissionDetailPage'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../types/auth'
import type { ReviewProgressStage, Submission } from '../types/submissions'
import api from '../lib/axios'

vi.mock('../lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../lib/toast', () => ({ useToastHelpers: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: { workerSrc: '' } }))
vi.mock('docx-preview', () => ({ renderAsync: vi.fn() }))

const student: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111', email: 'student@example.test', name: 'Student',
  first_name: null, last_name: null, organization: null, org_role: null, roles: ['student'],
  program_id: null, program: null, is_active: true, last_login_at: null, created_at: '2026-10-01',
}
const submissionId = '22222222-2222-4222-8222-222222222222'
let submission: Submission
let progress: { data: ReviewProgressStage[]; current_stage_id: string; is_blind: boolean; is_gated_review: boolean; allow_meetings: boolean; user_meeting_context: null }

function stage(id: string, name: string, order: number): ReviewProgressStage {
  return {
    id, name, order, role_label: 'reviewer', is_gatekeeper: order === 1, allows_finalize: false,
    is_email_stage: false, can_email: false, reviewers_count: 1, completed_count: 0,
    status: 'assigned', outcome: null, min_approvals: 1, due_days: 10, stage_due_at: null,
    reviewers: [{ id: `reviewer-${order}`, name: `${name} Reviewer`, status: 'pending', due_at: null }],
  }
}

function response(data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() } }
}

function openSubmission() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[`/submissions/${submissionId}`]}>
      <Routes><Route path="/submissions/:id" element={<SubmissionDetailPage />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>)
  return client
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  useAuthStore.getState().setAuth(student, 'test-token')
  submission = {
    id: submissionId, title: 'Revised proposal', status: 'REVISION_REQUIRED', current_version: 5,
    current_stage: { id: 'chair', name: 'Chair' }, current_stage_entered_at: '2026-10-12',
    submission_type: { id: 'proposal', slug: 'proposal', label: 'Proposal', is_gated_review: true,
      allowed_extensions: ['pdf'], max_file_size_mb: 8, max_files: 5 },
    program: null, submitter: { id: student.id, name: student.name, email: student.email },
    created_at: '2026-10-01', updated_at: '2026-10-18', abstract: null, metadata: {}, is_locked: false,
    versions: [{ id: 'version-five', submission_id: submissionId, version_number: 5,
      document_paths: ['revised.pdf'], change_summary: 'Revised chapters', submitted_at: '2026-10-18', file_count: 1 }],
  }
  progress = {
    current_stage_id: 'chair', is_blind: false, is_gated_review: true, allow_meetings: false, user_meeting_context: null,
    data: [{ ...stage('chair', 'Chair', 1), status: 'revision_required', completed_count: 1, outcome: 'revision' },
      stage('committee', 'Committee', 2), stage('director', 'Program Director', 3)],
  }
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
    if (url === `/submissions/${submissionId}`) return response({ data: submission })
    if (url === `/submissions/${submissionId}/review-progress`) return response(progress)
    if (url === `/submissions/${submissionId}/authors` || url === `/submissions/${submissionId}/reviewers`) {
      return response({ data: [] })
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.mocked(api.post).mockReset()
})

describe('Revision workflow', () => {
  it('keeps Chair current instead of inferring Committee from its pending assignments', async () => {
    openSubmission()
    expect(await screen.findByText(/Awaiting student revisions:/)).toHaveTextContent('Chair')
    expect(screen.getByText('Revision required', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('Completed', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText(/Uploading alone does not send it back/)).toBeInTheDocument()
  })

  it('refreshes the round and reviewer assignments immediately after explicit resubmission', async () => {
    const client = openSubmission()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await screen.findByText(/Awaiting student revisions:/)
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url !== `/submissions/${submissionId}/submit`) throw new Error(`Unexpected request: ${url}`)
      submission = { ...submission, status: 'IN_REVIEW' }
      progress = { ...progress, data: progress.data.map(s => ({ ...s, status: 'assigned', completed_count: 0, outcome: null })) }
      return response({ data: submission })
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Resubmit for Review' })[0])
    await waitFor(() => expect(screen.getByText(/^Current:/)).toHaveTextContent('Chair'))
    expect(screen.queryByText('Revision required', { exact: true })).not.toBeInTheDocument()
    for (const key of [['review-progress', submissionId], ['submission-reviewers', submissionId], ['my-reviews']]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: key })
    }
  })

  it('uses the stored Committee pointer when the configured restart resumes at stage two', async () => {
    submission.current_stage = { id: 'committee', name: 'Committee' }
    progress.current_stage_id = 'committee'
    progress.data[0] = { ...progress.data[0], status: 'completed', outcome: 'approved' }
    progress.data[1] = { ...progress.data[1], status: 'revision_required', completed_count: 1, outcome: 'revision' }
    openSubmission()
    expect(await screen.findByText(/Awaiting student revisions:/)).toHaveTextContent('Committee')
  })
})
