import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosHeaders } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from '../components/guards/ProtectedRoute'
import RoleRoute from '../components/guards/RoleRoute'
import ReviewsPage from '../pages/ReviewsPage'
import { pickDefaultRole, useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../types/auth'
import api from '../lib/axios'

vi.mock('../lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111', email: 'observer@example.test',
  name: 'Observer', first_name: null, last_name: null, organization: null, org_role: null,
  roles: ['readonly'], program_id: null, program: null, is_active: true,
  last_login_at: null, created_at: '2026-10-16T12:00:00Z',
}
const submissionId = '22222222-2222-4222-8222-222222222222'
const assignment = {
  assignment_id: 'assignment-one', assignment_status: 'accepted', decision: null,
  due_at: null, extension_status: null, conflict_flagged: false,
  reviewer: { id: 'reviewer-one', name: 'First Reviewer' },
  stage: { id: 'stage-one', name: 'Chair Review', role: 'reviewer' },
  submission: {
    id: submissionId, title: 'Research title', status: 'IN_REVIEW', current_version: 1,
    current_stage: { id: 'stage-one', name: 'Chair Review' },
    submission_type: { id: 'type-one', slug: 'paper', label: 'Paper' },
    submitter: { id: 'student-one', name: 'Student', email: 'student@example.test' },
    created_at: '2026-10-16T12:00:00Z',
  },
}

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  useAuthStore.getState().setAuth(user, 'test-token')
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
    if (url === '/submissions/my-reviews') {
      return { status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() }, data: {
        pending: [assignment, {
          ...assignment, assignment_id: 'assignment-two',
          reviewer: { id: 'reviewer-two', name: 'Second Reviewer' },
        }],
        future: [], completed: [], archived: [],
      } }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.mocked(api.post).mockReset()
})

describe('Read-only access', () => {
  it('recognizes the new role and preserves explicitly selected multi-role lenses', () => {
    expect(pickDefaultRole(['student', 'readonly'])).toBe('readonly')
    expect(pickDefaultRole(['admin', 'readonly'])).toBe('admin')
    useAuthStore.getState().setAuth({ ...user, roles: ['admin', 'readonly'] }, 'test-token')
    useAuthStore.getState().setActiveRole('readonly')
    expect(useAuthStore.getState().activeRole).toBe('readonly')
    useAuthStore.getState().setActiveRole('admin')
    expect(useAuthStore.getState().activeRole).toBe('admin')
  })

  it.each(['/users', '/settings', '/system-logs', '/submissions/new', '/references'])(
    'redirects direct navigation to %s away from changes and administration',
    (path) => {
      render(<MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={<ProtectedRoute><p>Restricted content</p></ProtectedRoute>} />
          <Route path="/submissions" element={<p>Submission browser</p>} />
        </Routes>
      </MemoryRouter>)
      expect(screen.getByText('Submission browser')).toBeInTheDocument()
      expect(screen.queryByText('Restricted content')).not.toBeInTheDocument()
    },
  )

  it.each(['/dashboard', '/submissions', `/submissions/${submissionId}`, '/reviews', '/reports/'])(
    'allows the read-only page %s',
    (path) => {
      render(<MemoryRouter initialEntries={[path]}>
        <ProtectedRoute><p>Read view</p></ProtectedRoute>
      </MemoryRouter>)
      expect(screen.getByText('Read view')).toBeInTheDocument()
    },
  )

  it('permits reports through the role guard', () => {
    render(<MemoryRouter><RoleRoute allowedRoles={['admin', 'coordinator', 'readonly']}>
      <p>Reports</p>
    </RoleRoute></MemoryRouter>)
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('shows each reviewer assignment, keeps navigation, and hides review mutations', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/reviews']}>
      <ReviewsPage /><Location />
    </MemoryRouter></QueryClientProvider>)
    expect(await screen.findByText('First Reviewer')).toBeInTheDocument()
    expect(screen.getByText('Second Reviewer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Awaiting Review (2)' })).toBeInTheDocument()
    expect(screen.getByText('Review Stage')).toBeInTheDocument()
    expect(screen.queryByTitle('Request extension')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Flag conflict of interest')).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/system/organization')
    expect(api.get).not.toHaveBeenCalledWith('/admin/gated-reviews')
    expect(api.get).not.toHaveBeenCalledWith('/admin/reviewer-pending-actions')
    fireEvent.click(screen.getAllByText('Research title')[0])
    expect(screen.getByTestId('location')).toHaveTextContent(`/submissions/${submissionId}`)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows a failed assignment request as an error rather than an empty queue', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><ReviewsPage /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load reviewer assignments.')
    expect(screen.queryByText('No reviews assigned')).not.toBeInTheDocument()
  })
})
