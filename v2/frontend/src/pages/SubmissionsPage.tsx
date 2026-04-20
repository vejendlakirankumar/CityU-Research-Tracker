import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Plus, Search, Filter, RefreshCw,
  XCircle, ChevronRight,
} from 'lucide-react'
import api from '../lib/axios'
import { useAuthStore } from '../stores/authStore'
import type { SubmissionListItem, SubmissionStatus } from '../types/submissions'
import { STATUS_LABELS, STATUS_COLORS } from '../types/submissions'

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Skeleton row (desktop) ────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: i === 0 ? '60%' : '50%' }} />
        </td>
      ))}
    </tr>
  )
}

// ── Skeleton card (mobile) ────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
      <div className="h-4 w-3/4 bg-gray-100 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 rounded" />
      <div className="flex gap-2 mt-2">
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface SubmissionResponse {
  data: SubmissionListItem[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export default function SubmissionsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const isAdmin = user?.roles?.some((r: string) => ['admin', 'coordinator'].includes(r))

  const { data, isLoading, isError, refetch } = useQuery<SubmissionResponse>({
    queryKey: ['submissions', page, search, statusFilter],
    queryFn: () =>
      api.get('/submissions', {
        params: { page, per_page: 20, search: search || undefined, status: statusFilter || undefined },
      }).then((r) => r.data),
  })

  const statuses: SubmissionStatus[] = [
    'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED',
    'ACCEPTED', 'CONDITIONALLY_ACCEPTED', 'REJECTED', 'WITHDRAWN',
  ]

  const colCount = isAdmin ? 8 : 7

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'All Submissions' : 'My Submissions'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin
              ? 'View and manage all research submissions'
              : 'Track and manage your research submissions'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            aria-label="Refresh submissions"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => navigate('/submissions/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">New Submission</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search submissions…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="Search submissions"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <select
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Mobile card list (< md) ─────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <XCircle className="w-10 h-10 text-red-300 mb-3" aria-hidden="true" />
            <p className="text-gray-500 text-sm">Failed to load submissions.</p>
            <button onClick={() => refetch()} className="mt-3 text-blue-600 text-sm hover:underline">Retry</button>
          </div>
        ) : !data?.data?.length ? (
          <MobileEmptyState hasFilters={!!(search || statusFilter)} onNew={() => navigate('/submissions/new')} />
        ) : (
          <>
            {data.data.map((sub) => (
              <button
                key={sub.id}
                className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99]"
                onClick={() => navigate(`/submissions/${sub.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 leading-snug flex-1">{sub.title}</p>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {sub.submission_type?.label ?? '—'}
                  {isAdmin && sub.submitter ? ` · ${sub.submitter.name}` : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <StatusBadge status={sub.status} />
                  {sub.current_version > 0 && (
                    <span className="text-xs text-gray-400">v{sub.current_version}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(sub.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
            <MobilePagination
              meta={data.meta}
              page={page}
              setPage={setPage}
            />
          </>
        )}
      </div>

      {/* ── Desktop table (≥ md) ────────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <table className="w-full">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} cols={colCount} />
              ))}
            </tbody>
          </table>
        ) : isError ? (
          <div className="flex flex-col items-center py-20 text-center">
            <XCircle className="w-10 h-10 text-red-300 mb-3" aria-hidden="true" />
            <p className="text-gray-500">Failed to load submissions.</p>
            <button onClick={() => refetch()} className="mt-3 text-blue-600 text-sm hover:underline">Retry</button>
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center py-20 text-center">
            <FileText className="w-12 h-12 text-gray-200 mb-4" aria-hidden="true" />
            <p className="text-base font-medium text-gray-500">
              {search || statusFilter ? 'No submissions match your filters.' : 'No submissions yet.'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => navigate('/submissions/new')}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create your first submission
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Title</th>
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Type</th>
                  {isAdmin && (
                    <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Submitter</th>
                  )}
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Program</th>
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Ver.</th>
                  <th scope="col" className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Updated</th>
                  <th scope="col" className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.data.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/submissions/${sub.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[260px]">{sub.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {sub.submission_type?.label ?? '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{sub.submitter.name}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {sub.program?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub.current_version > 0 ? `v${sub.current_version}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(sub.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {data.meta.last_page > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Page {data.meta.current_page} of {data.meta.last_page} · {data.meta.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40 hover:bg-white"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= data.meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40 hover:bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Mobile helpers ────────────────────────────────────────────────────────────

function MobileEmptyState({ hasFilters, onNew }: { hasFilters: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center bg-white rounded-xl border border-gray-200">
      <FileText className="w-12 h-12 text-gray-200 mb-4" aria-hidden="true" />
      <p className="text-base font-medium text-gray-500">
        {hasFilters ? 'No submissions match your filters.' : 'No submissions yet.'}
      </p>
      {!hasFilters && (
        <button
          onClick={onNew}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create your first submission
        </button>
      )}
    </div>
  )
}

function MobilePagination({
  meta,
  page,
  setPage,
}: {
  meta: { current_page: number; last_page: number; total: number }
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
}) {
  if (meta.last_page <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-gray-500">Page {meta.current_page} / {meta.last_page}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40 bg-white"
        >
          Prev
        </button>
        <button
          disabled={page >= meta.last_page}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40 bg-white"
        >
          Next
        </button>
      </div>
    </div>
  )
}

