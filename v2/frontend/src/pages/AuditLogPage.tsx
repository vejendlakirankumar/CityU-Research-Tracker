import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, ChevronDown, ChevronRight, Search, Filter, X } from 'lucide-react'
import api from '../lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string
  submission_id: string | null
  actor: { id: string; name: string; email: string } | null
  action: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

interface PaginatedResponse {
  data: AuditEntry[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

// ── Action badge ──────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  submission_created:   'bg-blue-100 text-blue-700',
  submission_submitted: 'bg-indigo-100 text-indigo-700',
  review_assigned:      'bg-amber-100 text-amber-700',
  decision_made:        'bg-purple-100 text-purple-700',
  submission_accepted:  'bg-green-100 text-green-700',
  submission_rejected:  'bg-red-100 text-red-700',
  user_created:         'bg-teal-100 text-teal-700',
  user_role_changed:    'bg-orange-100 text-orange-700',
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}

// ── JSON diff viewer ──────────────────────────────────────────────────────────

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto max-h-40 text-gray-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = entry.before_state || entry.after_state

  return (
    <>
      <tr
        className={`hover:bg-gray-50 transition-colors ${hasDiff ? 'cursor-pointer' : ''}`}
        onClick={() => hasDiff && setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
          {new Date(entry.created_at).toLocaleString('en-HK', { dateStyle: 'short', timeStyle: 'short' })}
        </td>
        <td className="px-4 py-3">
          <ActionBadge action={entry.action} />
        </td>
        <td className="px-4 py-3">
          {entry.actor
            ? <div>
                <p className="text-sm font-medium text-gray-900">{entry.actor.name}</p>
                <p className="text-xs text-gray-400">{entry.actor.email}</p>
              </div>
            : <span className="text-xs text-gray-400 italic">System</span>
          }
        </td>
        <td className="px-4 py-3">
          {entry.submission_id
            ? <span className="font-mono text-xs text-brand-700">{entry.submission_id.slice(0, 8)}…</span>
            : <span className="text-xs text-gray-300">—</span>
          }
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{entry.ip_address ?? '—'}</td>
        <td className="px-4 py-3 text-right">
          {hasDiff && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
              : <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          )}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <JsonBlock label="Before" data={entry.before_state} />
              <JsonBlock label="After"  data={entry.after_state} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────

interface Filters {
  search: string
  action: string
  date_from: string
  date_to: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({ search: '', action: '', date_from: '', date_to: '' })
  const [pending, setPending] = useState<Filters>({ search: '', action: '', date_from: '', date_to: '' })

  const { data: actionsData } = useQuery<{ data: string[] }>({
    queryKey: ['audit-actions'],
    queryFn: () => api.get('/admin/audit-logs/actions').then(r => r.data),
    staleTime: 300_000,
  })

  const params = {
    page,
    ...(filters.search    && { search:    filters.search }),
    ...(filters.action    && { action:    filters.action }),
    ...(filters.date_from && { date_from: filters.date_from }),
    ...(filters.date_to   && { date_to:   filters.date_to }),
  }

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ['audit-log', params],
    queryFn: () => api.get('/admin/audit-logs', { params }).then(r => r.data),
    staleTime: 30_000,
  })

  const entries = data?.data ?? []
  const meta    = data?.meta

  function applyFilters() {
    setFilters({ ...pending })
    setPage(1)
  }

  function clearFilters() {
    const empty = { search: '', action: '', date_from: '', date_to: '' }
    setPending(empty)
    setFilters(empty)
    setPage(1)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">Track all administrative and system actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              value={pending.search}
              onChange={e => setPending(p => ({ ...p, search: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="pl-8 w-full border border-gray-200 rounded-lg py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <select
            value={pending.action}
            onChange={e => setPending(p => ({ ...p, action: e.target.value }))}
            className="border border-gray-200 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All actions</option>
            {(actionsData?.data ?? []).map(a => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <input
            type="date"
            value={pending.date_from}
            onChange={e => setPending(p => ({ ...p, date_from: e.target.value }))}
            className="border border-gray-200 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="date"
            value={pending.date_to}
            onChange={e => setPending(p => ({ ...p, date_to: e.target.value }))}
            className="border border-gray-200 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={applyFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />Apply
          </button>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
          {meta && (
            <span className="ml-auto text-xs text-gray-400">{meta.total.toLocaleString()} records</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !entries.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No audit log entries found</p>
            {hasFilters && <p className="text-xs text-gray-400 mt-1">Try adjusting the filters</p>}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Submission</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(e => <AuditRow key={e.id} entry={e} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {meta.current_page} of {meta.last_page}
            </p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                Previous
              </button>
              <button disabled={page >= meta.last_page} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
