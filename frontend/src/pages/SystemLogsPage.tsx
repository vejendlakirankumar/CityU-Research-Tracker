import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

export default function SystemLogsPage() {
  const [filters, setFilters] = useState({ level: '', request_id: '', submission_id: '', date_from: '', date_to: '' })
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
        Administrator-only application diagnostics retained for 30 days. Search a reviewer&apos;s error reference
        or submission ID. These are not raw server logs: failures blocked by Nginx, PHP before Laravel starts,
        or an upstream gateway must be checked on the VM. Historical errors are not backfilled.
      </p>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4" onSubmit={event => {
        event.preventDefault()
        setPage(1)
        setAppliedFilters({ ...filters, request_id: filters.request_id.trim(), submission_id: filters.submission_id.trim() })
      }}>
        <label className="text-sm">Level
          <select className="block rounded border p-2" value={filters.level} onChange={event => setFilters({ ...filters, level: event.target.value })}>
            <option value="">All levels</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option>
          </select>
        </label>
        {(['request_id', 'submission_id', 'date_from', 'date_to'] as const).map(field => (
          <label key={field} className="text-sm">
            {{ request_id: 'Error reference', submission_id: 'Submission ID', date_from: 'From', date_to: 'To' }[field]}
            <input className="block rounded border p-2" type={field.startsWith('date_') ? 'date' : 'text'}
              value={filters[field]} onChange={event => setFilters({ ...filters, [field]: event.target.value })} />
          </label>
        ))}
        <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white" type="submit">Filter</button>
        <button className="rounded border px-4 py-2 text-sm" type="button" disabled={isFetching} onClick={() => void refetch()}>Refresh</button>
      </form>
      {error ? <p role="alert" className="text-sm text-red-600">{getApiErrorMessage(error, 'Could not load system logs.')}</p>
        : isPending ? <p role="status">Loading system logs...</p>
        : <>
            <p className="text-sm text-gray-500">{data?.total ?? 0} events</p>
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
