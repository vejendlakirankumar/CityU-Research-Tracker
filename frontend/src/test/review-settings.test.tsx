import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import SettingsPage from '../pages/SettingsPage'
import api from '../lib/axios'

vi.mock('../lib/axios', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}))

function response(data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() } }
}

const settings = {
  org_name: 'Test portal', portal_name: 'Test portal', org_short_name: '',
  primary_color: '#123456', accent_color: null, timezone: 'UTC', locale: 'en',
  date_format: 'Y-m-d', footer_text: '', support_email: '', allow_public_registration: false,
  archive_after_days: null, audit_retention_days: null,
  reviewer_feedback_max_file_size_mb: 12, reviewer_feedback_max_files: 3,
  upload_server_limits: { upload_max_filesize: '2M', post_max_size: '8M', max_file_uploads: 20 },
}

async function openReviewSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Review Settings' }))
  return { invalidate }
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue(response(settings))
  vi.mocked(api.patch).mockReset().mockResolvedValue(response(settings))
})

describe('Review Settings feedback upload policy', () => {
  it('shows the saved feedback limits and actual server ceilings separately', async () => {
    await openReviewSettings()
    expect(await screen.findByRole('spinbutton', { name: 'Maximum Feedback File Size (MB)' })).toHaveValue(12)
    expect(screen.getByRole('spinbutton', { name: 'Maximum Feedback Files per Reviewer' })).toHaveValue(3)
    expect(screen.getByText(/Active PHP-FPM limits:/)).toHaveTextContent('2M per file')
    expect(screen.getByText(/Saving here does not change/)).toBeInTheDocument()
  })

  it('saves edited limits and refreshes the reviewer policy cache', async () => {
    const { invalidate } = await openReviewSettings()
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Maximum Feedback File Size (MB)' }), { target: { value: '7' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum Feedback Files per Reviewer' }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/system/organization', expect.objectContaining({
      reviewer_feedback_max_file_size_mb: 7, reviewer_feedback_max_files: 2,
    })))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['submission-reviewers'] }))
  })

  it('shows field-level save errors instead of a generic failure', async () => {
    vi.mocked(api.patch).mockRejectedValue(new AxiosError('Validation failed', undefined, undefined, undefined, {
      ...response({
        message: 'Validation failed.',
        errors: { reviewer_feedback_max_file_size_mb: ['Feedback size must be at least 1 MB.'] },
      }),
      status: 422,
    }))
    await openReviewSettings()
    await screen.findByRole('spinbutton', { name: 'Maximum Feedback File Size (MB)' })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Feedback size must be at least 1 MB.')).toBeInTheDocument()
  })

  it('surfaces a settings load failure instead of leaving a permanent spinner', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
    await openReviewSettings()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load review settings.')
  })
})
