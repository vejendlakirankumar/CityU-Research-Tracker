import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Loader2, UserCheck, UserPlus, Trash2,
  ChevronRight, GitBranch, RefreshCw,
} from 'lucide-react'
import api from '../lib/axios'
import type { SubmissionTypeAdmin, StageDefinition } from '../types/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PoolEntry {
  id: string
  submission_type_id: string
  user_id: string
  stage_id: string | null
  stage_role_label: string | null
  added_at: string
  user: {
    id: string
    name: string
    email: string
    first_name: string | null
    last_name: string | null
    org_role: string | null
  }
}

interface UserResult {
  id: string
  name: string
  email: string
  first_name: string | null
  last_name: string | null
  org_role: string | null
}

// ── User Search Popover ───────────────────────────────────────────────────────

function UserSearchAdder({
  stageId, submissionTypeId, existingUserIds, onAdded,
}: {
  stageId: string
  submissionTypeId: string
  existingUserIds: string[]
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery<{ data: UserResult[] }>({
    queryKey: ['user-search', query],
    queryFn: () =>
      api.get('/users', { params: { search: query, role: 'reviewer', per_page: 10, is_active: true } }).then((r) => r.data),
    enabled: query.length >= 2,
    placeholderData: (prev) => prev,
  })

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post('/admin/reviewer-pools', {
        submission_type_id: submissionTypeId,
        user_id: userId,
        stage_id: stageId,
      }),
    onSuccess: () => { onAdded(); setQuery(''); setOpen(false) },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const results = (data?.data ?? []).filter((u) => !existingUserIds.includes(u.id))

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 border border-dashed border-blue-300 rounded-lg px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 cursor-text"
        onClick={() => setOpen(true)}>
        <UserPlus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <input
          className="flex-1 text-xs bg-transparent outline-none text-blue-700 placeholder:text-blue-400 min-w-0"
          placeholder="Search and add reviewer..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {isFetching && <Loader2 className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" />}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-52 overflow-y-auto">
          {isFetching && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span className="text-xs text-gray-400">Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No reviewers found</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => addMutation.mutate(u.id)}
                disabled={addMutation.isPending}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                  {(u.name || u.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{u.name || `${u.first_name} ${u.last_name}`}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                {addMutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-auto" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Stage Panel ───────────────────────────────────────────────────────────────

function StageAssignmentPanel({
  stage, order, poolEntries, onRemove, onAdded,
  submissionTypeId,
}: {
  stage: StageDefinition
  order: number
  poolEntries: PoolEntry[]
  onRemove: (id: string) => void
  onAdded: () => void
  submissionTypeId: string
}) {
  const existingUserIds = poolEntries.map((p) => p.user_id)

  return (
    <div className="border border-gray-200 rounded-xl">
      {/* Stage header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl">
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
          {order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{stage.name}</p>
          <p className="text-xs text-gray-500">
            Role: <span className="font-mono text-blue-700">{stage.stage_role_label}</span>
            {' · '}{stage.due_days}d deadline
            {' · '}{stage.approval_strategy === 'ALL' ? 'All must approve' : stage.approval_strategy === 'MAJORITY' ? 'Majority' : 'Any one'}
            {stage.is_gatekeeper && <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Gatekeeper</span>}
            {stage.is_anonymous && <span className="ml-1.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">Anonymous</span>}
          </p>
        </div>
        <span className="text-xs text-gray-400">{poolEntries.length} assigned</span>
      </div>

      {/* Assigned reviewers */}
      <div className="px-4 py-3 space-y-2">
        {poolEntries.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No reviewers assigned yet.</p>
        ) : (
          poolEntries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700 flex-shrink-0">
                {(entry.user.name || entry.user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{entry.user.name}</p>
                <p className="text-xs text-gray-400 truncate">{entry.user.email}</p>
              </div>
              {entry.user.org_role && (
                <span className="text-xs text-gray-400 hidden group-hover:hidden">{entry.user.org_role}</span>
              )}
              <button
                onClick={() => onRemove(entry.id)}
                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Remove from pool"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}

        {/* Add reviewer */}
        <div className="pt-1">
          <UserSearchAdder
            stageId={stage.id}
            submissionTypeId={submissionTypeId}
            existingUserIds={existingUserIds}
            onAdded={onAdded}
          />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TypeWithWorkflow = SubmissionTypeAdmin

export default function ReviewerAssignmentsPage() {
  const qc = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Fetch all submission types with their workflow + stages
  const { data: typesData, isLoading: typesLoading, refetch: refetchTypes } = useQuery<{ data: TypeWithWorkflow[] }>({
    queryKey: ['admin-types-with-workflows'],
    queryFn: () =>
      api.get('/admin/submission-types', { params: { all: true } }).then((r) => r.data),
  })

  const types = (typesData?.data ?? [])
    .filter((t) => t.workflow && t.workflow.stages && t.workflow.stages.length > 0)
    .filter((t) =>
      !search || t.label.toLowerCase().includes(search.toLowerCase()),
    )

  const selectedType = types.find((t) => t.id === selectedTypeId) ?? null

  // Auto-select first if nothing selected
  useEffect(() => {
    if (!selectedTypeId && types.length > 0) setSelectedTypeId(types[0].id)
  }, [types.length])

  // Fetch pool entries for selected type
  const { data: poolData, refetch: refetchPool } = useQuery<{ data: PoolEntry[] }>({
    queryKey: ['reviewer-pools', selectedTypeId],
    queryFn: () =>
      api.get('/admin/reviewer-pools', { params: { submission_type_id: selectedTypeId } }).then((r) => r.data),
    enabled: !!selectedTypeId,
  })

  const poolEntries = poolData?.data ?? []

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/reviewer-pools/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewer-pools', selectedTypeId] }),
  })

  const poolByStage = (stageId: string) =>
    poolEntries.filter((p) => p.stage_id === stageId)

  const stages = selectedType?.workflow?.stages ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Default Reviewer Pool</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pre-configure default reviewers per stage — used as suggestions when a new submission arrives
          </p>
        </div>
        <button onClick={() => { refetchTypes(); refetchPool() }}
          className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-5 h-[calc(100vh-13rem)]">
        {/* ── Left: Category List ── */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Filter categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {typesLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
            ) : types.length === 0 ? (
              <div className="flex flex-col items-center py-10 px-4 text-center">
                <GitBranch className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No categories with a workflow attached.</p>
                <p className="text-xs text-gray-400 mt-1">Go to Submission Categories to attach a workflow first.</p>
              </div>
            ) : (
              types.map((t) => {

                const isSelected = t.id === selectedTypeId
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTypeId(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                      isSelected ? 'bg-blue-50 border-r-2 border-blue-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{t.workflow?.name}</p>
                      <p className="text-xs text-gray-400">{t.workflow?.stages?.length ?? 0} stages</p>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-300'}`} />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right: Stage Assignment Panels ── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedType ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <UserCheck className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">Select a submission category</p>
              <p className="text-sm text-gray-400 mt-1">to manage reviewer assignments for each workflow stage</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category header */}
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{selectedType.label}</h2>
                    <p className="text-sm text-gray-500">Workflow: <span className="font-medium text-gray-700">{selectedType.workflow?.name}</span></p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-gray-400">{poolEntries.length} total assigned</p>
                    <p className="text-xs text-gray-400">{stages.length} stages</p>
                  </div>
                </div>
              </div>

              {/* One panel per stage */}
              {stages.map((stage, idx) => (
                <StageAssignmentPanel
                  key={stage.id}
                  stage={stage}
                  order={idx + 1}
                  submissionTypeId={selectedType.id}
                  poolEntries={poolByStage(stage.id)}
                  onRemove={(id) => removeMutation.mutate(id)}
                  onAdded={() => qc.invalidateQueries({ queryKey: ['reviewer-pools', selectedTypeId] })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
