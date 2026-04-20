import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, X, ChevronRight, RefreshCw } from 'lucide-react'
import api from '../lib/axios'
import { useToastHelpers } from '../lib/toast'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appeal {
  id: string
  submission_id: string
  status: string
  grounds: string
  resolution_note: string | null
  reviewed_at: string | null
  created_at: string
  submission: { id: string; title: string; status: string } | null
  submitter: { id: string; name: string; email: string } | null
}

interface AppealsResponse {
  data: Appeal[]
  meta: { current_page: number; last_page: number; total: number }
}

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  PENDING:      'bg-amber-100 text-amber-800',
  UNDER_REVIEW: 'bg-blue-100  text-blue-800',
  UPHELD:       'bg-green-100 text-green-800',
  DISMISSED:    'bg-gray-100  text-gray-700',
}

function AppealBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── Resolution modal ──────────────────────────────────────────────────────────

function ResolveModal({ appeal, onClose }: { appeal: Appeal; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToastHelpers()
  const [status, setStatus]         = useState<string>(appeal.status === 'PENDING' ? 'UNDER_REVIEW' : appeal.status)
  const [resolution, setResolution] = useState(appeal.resolution_note ?? '')

  const mut = useMutation({
    mutationFn: (body: object) => api.patch(`/admin/appeals/${appeal.id}`, body),
    onSuccess: () => {
      toast.success('Appeal updated.')
      qc.invalidateQueries({ queryKey: ['appeals'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update appeal.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Review Appeal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Submission */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-800 truncate">{appeal.submission?.title ?? appeal.submission_id}</p>
            <p className="text-gray-500 mt-0.5">{appeal.submitter?.name} · {appeal.submitter?.email}</p>
          </div>

          {/* Grounds */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grounds</label>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{appeal.grounds}</p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="UPHELD">Upheld</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>

          {/* Resolution note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              rows={3}
              placeholder="Explain the decision to the submitter…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mut.mutate({ status, resolution_note: resolution || undefined })}
            disabled={mut.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {mut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AppealsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage]                 = useState(1)
  const [resolving, setResolving]       = useState<Appeal | null>(null)

  const { data, isLoading, refetch } = useQuery<AppealsResponse>({
    queryKey: ['appeals', statusFilter, page],
    queryFn: () =>
      api.get('/admin/appeals', { params: { status: statusFilter || undefined, page } })
        .then(r => r.data),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appeals</h1>
          <p className="text-sm text-gray-500 mt-1">Manage submission appeals from students.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {['', 'PENDING', 'UNDER_REVIEW', 'UPHELD', 'DISMISSED'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 text-sm rounded-full font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No appeals found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.data.map(appeal => (
              <button
                key={appeal.id}
                onClick={() => setResolving(appeal)}
                className="w-full text-left p-4 hover:bg-gray-50 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {appeal.submission?.title ?? appeal.submission_id}
                    </p>
                    <AppealBadge status={appeal.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {appeal.submitter?.name} · Submitted {new Date(appeal.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{appeal.grounds}</p>
                  {appeal.resolution_note && (
                    <p className="text-xs text-indigo-600 mt-1 truncate">↳ {appeal.resolution_note}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(data?.meta?.last_page ?? 1) > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data!.meta.last_page }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium ${
                p === page ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {resolving && (
        <ResolveModal
          appeal={resolving}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  )
}
