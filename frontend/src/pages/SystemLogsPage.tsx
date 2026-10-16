import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/axios'
import { getApiErrorMessage } from '../lib/apiErrors'

interface SystemLog {
  id: string
  request_id: string
  level: string
  event: string
  user_id: string | null
  submission_id: string | null
  reviewer_id: string | null
  route: string | null
  context: Record<string, unknown>
  created_at: string
}

interface LogPage {
  data: SystemLog[]
  current_page: number
  last_page: number
  total: number
}

const EMPTY_FILTERS = { level: '', search: '', request_id: '', submission_id: '', date_from: '', date_to: '' }

export default function SystemLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS, submission_id: searchParams.get('submission_id') ?? '',
  }))
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const { data, error, isPending, isFetching, refetch } = useQuery<LogPage>({
    queryKey: ['system-logs', appliedFilters, page],
    queryFn: () => api.get('/system/logs', {
      params: { ...Object.fromEntries(Object.entries(appliedFilters).filter(([, value]) => value)), page },
    }).then(response => response.data),
  })

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
      <p className="text-sm text-gray-600">
        Administrator-only application diagnostics retained for 30 days. All filters are optional:
        leave them blank to see the latest 50 events, newest first. No submission ID or wildcard is required.
        These are not raw server logs: failures blocked by Nginx, PHP before Laravel starts,
        or an upstream gateway must be checked on the VM. Historical errors are not backfilled.
      </p>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4" onSubmit={event => {
        event.preventDefault()
        const nextFilters = { ...filters, search: filters.search.trim(), request_id: filters.request_id.trim(), submission_id: filters.submission_id.trim() }
        setPage(1)
        setAppliedFilters(nextFilters)
        setSearchParams(nextFilters.submission_id ? { submission_id: nextFilters.submission_id } : {}, { replace: true })
      }}>
        <label className="text-sm">Level
          <select className="block rounded border p-2" value={filters.level} onChange={event => setFilters({ ...filters, level: event.target.value })}>
            <option value="">All levels</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option>
          </select>
        </label>
        <label className="text-sm">Search events
          <input className="block rounded border p-2" type="search" maxLength={200}
            placeholder="e.g. validation failed" value={filters.search}
            onChange={event => setFilters({ ...filters, search: event.target.value })} />
        </label>
        {(['request_id', 'submission_id', 'date_from', 'date_to'] as const).map(field => (
          <label key={field} className="text-sm">
            {{ request_id: 'Error reference (UUID, optional)', submission_id: 'Submission ID (UUID, optional)', date_from: 'From (optional)', date_to: 'To (optional)' }[field]}
            <input className="block rounded border p-2" type={field.startsWith('date_') ? 'date' : 'text'}
              placeholder={field === 'request_id' ? 'Paste the UUID from an error message' : field === 'submission_id' ? 'UUID from submission details' : undefined}
              value={filters[field]} onChange={event => setFilters({ ...filters, [field]: event.target.value })} />
          </label>
        ))}
        <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white" type="submit">Filter</button>
        <button className="rounded border px-4 py-2 text-sm" type="button" disabled={isFetching} onClick={() => void refetch()}>Refresh</button>
        <button className="rounded border px-4 py-2 text-sm" type="button" onClick={() => {
          const alreadyLatest = page === 1 && Object.values(appliedFilters).every(value => !value)
          setFilters(EMPTY_FILTERS)
          setAppliedFilters(EMPTY_FILTERS)
          setPage(1)
          setSearchParams({}, { replace: true })
          if (alreadyLatest) void refetch()
        }}>Show latest 50</button>
      </form>
      <p className="text-xs text-gray-500">
        Use Search events for words such as &quot;validation failed&quot;. Error reference accepts only the UUID
        supplied with an error. Find a submission&apos;s full ID in its detail page, or use its View system logs shortcut.
      </p>
      {error ? <p role="alert" className="text-sm text-red-600">{getApiErrorMessage(error, 'Could not load system logs.')}</p>
        : isPending ? <p role="status">Loading system logs...</p>
        : <>
            <p className="text-sm text-gray-500">Showing {data?.data.length ?? 0} of {data?.total ?? 0} events; newest first, 50 per page.</p>
            {data?.data.length === 0 && <p className="rounded border bg-white p-6 text-gray-500">No diagnostic events match these filters.</p>}
            {data?.data.map(entry => (
              <details key={entry.id} className="rounded-xl border bg-white p-4">
                <summary className="cursor-pointer text-sm">
                  <span className={entry.level === 'error' ? 'font-semibold text-red-700' : entry.level === 'warning' ? 'font-semibold text-amber-700' : 'font-semibold text-blue-700'}>{entry.level.toUpperCase()}</span>
                  {' '}{entry.event} - {new Date(entry.created_at).toLocaleString()}
                </summary>
                <dl className="mt-3 space-y-1 break-all text-xs text-gray-600">
                  <div><dt className="inline font-semibold">Reference: </dt><dd className="inline">{entry.request_id}</dd></div>
                  <div><dt className="inline font-semibold">User ID: </dt><dd className="inline">{entry.user_id ?? 'Not resolved'}</dd></div>
                  <div><dt className="inline font-semibold">Submission ID: </dt><dd className="inline">{entry.submission_id ?? 'Not resolved'}</dd></div>
                  <div><dt className="inline font-semibold">Reviewer assignment: </dt><dd className="inline">{entry.reviewer_id ?? 'Not resolved'}</dd></div>
                  <div><dt className="inline font-semibold">Route: </dt><dd className="inline">{entry.route ?? 'Not resolved'}</dd></div>
                </dl>
                <pre className="mt-3 max-h-72 overflow-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(entry.context, null, 2)}</pre>
              </details>
            ))}
            <div className="flex items-center gap-4 text-sm">
              <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={page <= 1 || isFetching} onClick={() => setPage(value => value - 1)}>Previous</button>
              <span>Page {data?.current_page ?? page} of {data?.last_page ?? 1}</span>
              <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={!data || page >= data.last_page || isFetching} onClick={() => setPage(value => value + 1)}>Next</button>
            </div>
          </>}
    </div>
  )
}
