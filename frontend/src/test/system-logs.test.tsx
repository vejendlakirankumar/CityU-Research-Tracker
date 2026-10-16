import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'
import SystemLogsPage from '../pages/SystemLogsPage'
import api from '../lib/axios'

vi.mock('../lib/axios', () => ({ default: { get: vi.fn() } }))

const submissionId = '11111111-1111-4111-8111-111111111111'
const logs = {
  data: [{
    id: 'log-one', request_id: '22222222-2222-4222-8222-222222222222',
    level: 'warning', event: 'reviewer.validation_failed', user_id: null,
    submission_id: submissionId, reviewer_id: null, route: null,
    context: {}, created_at: '2026-10-16T12:00:00Z',
  }],
  current_page: 1, last_page: 1, total: 1,
}

function response(data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() } }
}

function openLogs(path = '/system-logs') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}><SystemLogsPage /></MemoryRouter>
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue(response(logs))
})

describe('System Logs', () => {
  it('loads the latest events immediately with no required filters', async () => {
    openLogs()
    expect(await screen.findByText(/Showing 1 of 1 events/)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/system/logs', { params: { page: 1 } })
    expect(screen.getByLabelText(/Submission ID/)).not.toBeRequired()
    expect(screen.getByLabelText(/Error reference/)).not.toBeRequired()
    expect(screen.getByText(/No submission ID or wildcard is required/)).toBeInTheDocument()
  })

  it('searches words in events without using the UUID reference field', async () => {
    openLogs()
    await screen.findByText(/Showing 1 of 1 events/)
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: ' validation failed ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/system/logs', {
      params: { search: 'validation failed', page: 1 },
    }))
  })

  it('opens a submission shortcut with its filter and clears it with Show latest 50', async () => {
    openLogs(`/system-logs?submission_id=${submissionId}`)
    await screen.findByText(/Showing 1 of 1 events/)
    expect(screen.getByLabelText(/Submission ID/)).toHaveValue(submissionId)
    expect(api.get).toHaveBeenCalledWith('/system/logs', { params: { submission_id: submissionId, page: 1 } })
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'validation' } })
    fireEvent.change(screen.getByLabelText(/Error reference/), { target: { value: 'invalid text' } })
    fireEvent.change(screen.getByLabelText(/From/), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show latest 50' }))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/system/logs', { params: { page: 1 } }))
    expect(screen.getByLabelText(/Submission ID/)).toHaveValue('')
    expect(screen.getByLabelText(/Error reference/)).toHaveValue('')
    expect(screen.getByLabelText('Search events')).toHaveValue('')
    expect(screen.getByLabelText(/From/)).toHaveValue('')
  })

  it('refreshes the latest view even when filters are already empty', async () => {
    openLogs()
    await screen.findByText(/Showing 1 of 1 events/)
    const calls = vi.mocked(api.get).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Show latest 50' }))
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(calls))
  })

  it('returns from an older page to the latest page', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(response({ ...logs, total: 51, last_page: 2 }))
      .mockResolvedValueOnce(response({ ...logs, total: 51, current_page: 2, last_page: 2 }))
    openLogs()
    await screen.findByText(/Showing 1 of 51 events/)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 2')
    fireEvent.click(screen.getByRole('button', { name: 'Show latest 50' }))
    await screen.findByText('Page 1 of 1')
    expect(api.get).toHaveBeenLastCalledWith('/system/logs', { params: { page: 1 } })
  })

  it('recovers from an invalid UUID filter by showing the unfiltered latest events', async () => {
    const message = 'Error reference must be a UUID copied from an error message. Use Search events for text.'
    openLogs()
    await screen.findByText(/Showing 1 of 1 events/)
    vi.mocked(api.get).mockRejectedValueOnce(new AxiosError('Validation failed', undefined, undefined, undefined, {
      ...response({ message: 'Validation failed.', errors: { request_id: [message] } }), status: 422,
    }))
    fireEvent.change(screen.getByLabelText(/Error reference/), { target: { value: 'validation failed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    fireEvent.click(screen.getByRole('button', { name: 'Show latest 50' }))
    await screen.findByText(/Showing 1 of 1 events/)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/system/logs', { params: { page: 1 } }))
  })
})
