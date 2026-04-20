import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, RefreshCw, Loader2,
  CheckCircle2, XCircle, Tag, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '../lib/axios'
import type { SubmissionTypeAdmin, SubmissionTypeFormData, WorkflowDefinition } from '../types/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMMON_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'zip', 'png', 'jpg']

const DEFAULT_FORM: SubmissionTypeFormData = {
  label: '', slug: '', description: '',
  is_gated_review: false, is_blind_review: false, allow_meetings: false,
  max_file_size_mb: 8, allowed_extensions: ['pdf', 'docx'], max_files: 5, is_active: true,
  workflow_id: null,
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ── Form Modal ────────────────────────────────────────────────────────────────

function TypeFormModal({
  initial, workflows, onClose, onSave,
}: {
  initial?: SubmissionTypeAdmin | null
  workflows: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: SubmissionTypeFormData) => void
}) {
  const [form, setForm] = useState<SubmissionTypeFormData>(
    initial
      ? {
          label: initial.label, slug: initial.slug, description: initial.description ?? '',
          is_gated_review: initial.is_gated_review, is_blind_review: initial.is_blind_review,
          allow_meetings: initial.allow_meetings, max_file_size_mb: initial.max_file_size_mb,
          allowed_extensions: initial.allowed_extensions, max_files: initial.max_files, is_active: initial.is_active,
          workflow_id: initial.workflow_id ?? null,
        }
      : DEFAULT_FORM,
  )
  const [slugManual, setSlugManual] = useState(!!initial)

  const setField = <K extends keyof SubmissionTypeFormData>(k: K, v: SubmissionTypeFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'label' && !slugManual) {
      setForm((f) => ({ ...f, label: v as string, slug: slugify(v as string) }))
    }
  }

  const toggleExt = (ext: string) => {
    setForm((f) => ({
      ...f,
      allowed_extensions: f.allowed_extensions.includes(ext)
        ? f.allowed_extensions.filter((e) => e !== ext)
        : [...f.allowed_extensions, ext],
    }))
  }

  const isValid = form.label.trim() && form.slug.trim() && form.allowed_extensions.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Submission Category' : 'New Submission Category'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Label *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
              placeholder="e.g. Dissertation Proposal"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Slug * <span className="font-normal text-gray-400">(URL-safe identifier)</span></label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.slug}
              onChange={(e) => { setSlugManual(true); setField('slug', slugify(e.target.value)) }}
              placeholder="e.g. dissertation-proposal"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          {/* File settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Max file size (MB)</label>
              <input
                type="number" min={1} max={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.max_file_size_mb}
                onChange={(e) => setField('max_file_size_mb', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Max files</label>
              <input
                type="number" min={1} max={50}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.max_files}
                onChange={(e) => setField('max_files', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Extensions */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Allowed file extensions *</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_EXTENSIONS.map((ext) => (
                <button
                  key={ext}
                  type="button"
                  onClick={() => toggleExt(ext)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.allowed_extensions.includes(ext)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  .{ext}
                </button>
              ))}
            </div>
          </div>

          {/* Workflow */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Attached Workflow <span className="font-normal text-gray-400">(optional)</span></label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.workflow_id ?? ''}
              onChange={(e) => setField('workflow_id', e.target.value || null)}
            >
              <option value="">— None —</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Flags */}
          <div className="space-y-2.5 pt-1">
            <Toggle
              checked={form.is_gated_review}
              onChange={(v) => setField('is_gated_review', v)}
              label="Gated review — one reviewer handles all submitter communication, gathers feedback from approvers, and controls whether the submission moves forward or is returned"
            />
            <Toggle
              checked={form.is_blind_review}
              onChange={(v) => setField('is_blind_review', v)}
              label="Blind review — submitter and reviewer identities are hidden from both of them; only admin or coordinator can see"
            />
            <Toggle checked={form.allow_meetings} onChange={(v) => setField('allow_meetings', v)} label="Allow meeting scheduling" />
            <Toggle checked={form.is_active} onChange={(v) => setField('is_active', v)} label="Active (visible to submitters)" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => isValid && onSave(form)}
            disabled={!isValid}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {initial ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface TypeListResponse {
  data: SubmissionTypeAdmin[]
  meta: { current_page: number; last_page: number; total: number; per_page: number }
}

export default function SubmissionCategoriesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SubmissionTypeAdmin | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<TypeListResponse>({
    queryKey: ['admin-submission-types', page, search],
    queryFn: () =>
      api.get('/admin/submission-types', { params: { page, per_page: 20, search: search || undefined } })
        .then((r) => r.data),
  })

  const { data: workflowsData } = useQuery<{ data: WorkflowDefinition[] }>({
    queryKey: ['admin-workflows-all'],
    queryFn: () => api.get('/admin/workflows', { params: { all: true } }).then((r) => r.data),
  })
  const workflows = workflowsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: (body: SubmissionTypeFormData) => api.post('/admin/submission-types', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-submission-types'] }); setShowModal(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmissionTypeFormData }) =>
      api.patch(`/admin/submission-types/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-submission-types'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/submission-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-submission-types'] }); setDeleteConfirm(null) },
  })

  const handleSave = (form: SubmissionTypeFormData) => {
    if (editing) updateMutation.mutate({ id: editing.id, body: form })
    else createMutation.mutate(form)
  }

  const types = data?.data ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submission Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure the types of research submissions available to users</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search categories…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center py-20">
            <XCircle className="w-8 h-8 text-red-300 mb-2" />
            <p className="text-gray-500 text-sm">Failed to load.</p>
            <button onClick={() => refetch()} className="mt-2 text-blue-600 text-sm hover:underline">Retry</button>
          </div>
        ) : types.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <Tag className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No submission categories yet.</p>
            <button onClick={() => setShowModal(true)} className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Create First Category
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Workflow</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">File Settings</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Flags</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Submissions</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {types.map((t) => (
                  <>
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                        <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        {t.workflow
                          ? <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{t.workflow.name}</span>
                          : <span className="text-xs text-gray-400 italic">None</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span>{t.max_file_size_mb} MB · {t.max_files} file{t.max_files !== 1 ? 's' : ''}</span>
                        <p className="text-xs text-gray-400">{t.allowed_extensions.map(e => `.${e}`).join(', ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.is_gated_review && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Gated</span>}
                          {t.is_blind_review && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Blind</span>}
                          {t.allow_meetings && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Meetings</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.submissions_count ?? 0}</td>
                      <td className="px-4 py-3">
                        {t.is_active
                          ? <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="w-3 h-3" /> Active</span>
                          : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle className="w-3 h-3" /> Inactive</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Details"
                          >
                            {expandedId === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditing(t)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(t.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <tr key={`${t.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <p className="text-sm text-gray-600 mb-1">
                            {t.description || <span className="italic text-gray-400">No description</span>}
                          </p>
                          {/* Group access moved to Researcher Access page */}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {(data?.meta?.last_page ?? 1) > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">Page {data!.meta.current_page} of {data!.meta.last_page} · {data!.meta.total} total</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40">Previous</button>
                  <button disabled={page >= (data?.meta?.last_page ?? 1)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-gray-200 rounded text-sm disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete category?</h3>
            <p className="text-sm text-gray-600 mb-5">
              If this category has submissions it will be deactivated instead of deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {(showModal || editing) && (
        <TypeFormModal
          initial={editing}
          workflows={workflows}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
