import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, FileText, Download, Upload,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Pencil, X, Check, StopCircle,
  Users, UserPlus, Mail, MailCheck, RefreshCw, Trash2,
  Search, UserCheck, Clock, MessageSquare, History,
  ThumbsUp, ThumbsDown, RotateCcw,
  Gavel, CircleAlert, Info, ListChecks,
  Calendar, EyeOff, ExternalLink, Eye, Printer,
} from 'lucide-react'
import { renderAsync } from 'docx-preview'
import api from '../lib/axios'
import { useAuthStore } from '../stores/authStore'
import { useToastHelpers } from '../lib/toast'
import type {
  Submission, SubmissionStatus, SubmissionAuthor, SubmissionReviewer,
  ActivityEvent, FeedbackItem, Appeal, ReviewProgressStage, SubmissionMeeting,
} from '../types/submissions'
import { STATUS_LABELS, STATUS_COLORS } from '../types/submissions'
import type { SubmissionTypeAdmin } from '../types/admin'

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Tab Navigation ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'documents' | 'feedback' | 'activity'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: Info },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'feedback',  label: 'Feedback',  icon: MessageSquare },
  { id: 'activity',  label: 'Activity',  icon: Clock },
]

// ── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmClass?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50 flex items-center gap-1.5 ${confirmClass ?? 'bg-red-600 hover:bg-red-700'}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appeal Modal ──────────────────────────────────────────────────────────────

function AppealModal({
  submissionId, onClose, onSubmitted,
}: {
  submissionId: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const [grounds, setGrounds] = useState('')
  const [error, setError] = useState('')

  const appealMutation = useMutation({
    mutationFn: () => api.post(`/submissions/${submissionId}/appeal`, { grounds }),
    onSuccess: () => { onClose(); onSubmitted() },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to submit appeal.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-semibold text-gray-900">Appeal Rejection</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Provide a detailed explanation of the grounds for your appeal. This will be reviewed by the coordinator.
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          rows={6}
          placeholder="Describe the grounds for your appeal (minimum 20 characters)…"
          value={grounds}
          onChange={e => setGrounds(e.target.value)}
          maxLength={5000}
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          <span className="text-xs text-gray-400">{grounds.length}/5000 characters</span>
          {grounds.length > 0 && grounds.length < 20 && (
            <span className="text-xs text-red-500">At least 20 characters required</span>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => appealMutation.mutate()}
            disabled={appealMutation.isPending || grounds.length < 20}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {appealMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit Appeal
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Review Progress Panel ────────────────────────────────────────────────────

const STAGE_STATUS_CONFIG: Record<string, { label: string; cls: string; numCls: string }> = {
  pending:          { label: 'Not started',        cls: 'bg-gray-100 text-gray-500',     numCls: 'bg-gray-200 text-gray-500' },
  needs_assignment: { label: 'Needs reviewers',     cls: 'bg-purple-100 text-purple-700', numCls: 'bg-purple-500 text-white' },
  assigned:         { label: 'Reviewers assigned',  cls: 'bg-blue-100 text-blue-700',     numCls: 'bg-blue-500 text-white' },
  in_progress:      { label: 'In progress',         cls: 'bg-yellow-100 text-yellow-700', numCls: 'bg-yellow-400 text-white' },
  completed:        { label: 'Completed',           cls: 'bg-green-100 text-green-700',   numCls: 'bg-green-500 text-white' },
}

const OUTCOME_CONFIG: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  revision: { label: 'Revision', cls: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },
}

const MEETING_STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-blue-100 text-blue-700',
}

function MeetingItem({
  meeting, isAdmin, currentUserId, onCancel, onConfirm, isConfirming,
}: {
  meeting: SubmissionMeeting
  isAdmin: boolean
  currentUserId: string
  onCancel: () => void
  onConfirm: (data: { confirmed_at: string | null; meeting_link: string | null }) => void
  isConfirming: boolean
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmLink, setConfirmLink] = useState(meeting.meeting_link ?? '')
  const [confirmTime, setConfirmTime] = useState(
    meeting.confirmed_at ? new Date(meeting.confirmed_at).toISOString().slice(0, 16) : ''
  )
  const canCancel = (meeting.requested_by === currentUserId || isAdmin)
    && ['requested', 'confirmed'].includes(meeting.status)

  return (
    <div className="p-2.5 border border-gray-100 rounded-lg bg-white">
      <div className="flex items-start gap-2">
        <Calendar className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-gray-800">{meeting.title}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${MEETING_STATUS_COLORS[meeting.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {meeting.status}
            </span>
          </div>
          {meeting.description && <p className="text-xs text-gray-500 mt-0.5 italic">{meeting.description}</p>}
          {meeting.proposed_at && (
            <p className="text-xs text-gray-400 mt-0.5">Proposed: {new Date(meeting.proposed_at).toLocaleString()}</p>
          )}
          {meeting.confirmed_at && (
            <p className="text-xs text-gray-500 mt-0.5">Confirmed: {new Date(meeting.confirmed_at).toLocaleString()}</p>
          )}
          {meeting.meeting_link && (
            <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5">
              <ExternalLink className="w-3 h-3" /> Join Meeting
            </a>
          )}
          <p className="text-xs text-gray-400 mt-0.5">By {meeting.requester?.name ?? 'Unknown'}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAdmin && meeting.status === 'requested' && !showConfirm && (
            <button onClick={() => setShowConfirm(true)}
              className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">
              Confirm
            </button>
          )}
          {canCancel && !showConfirm && (
            <button onClick={onCancel} className="p-1 text-gray-400 hover:text-red-500" title="Cancel meeting">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {showConfirm && isAdmin && (
        <div className="mt-2 p-2.5 bg-green-50 rounded-lg border border-green-100 space-y-1.5">
          <p className="text-xs font-semibold text-green-700">Confirm meeting details</p>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Date &amp; time</label>
            <input type="datetime-local"
              className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-green-400"
              value={confirmTime} onChange={e => setConfirmTime(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Meeting link (optional)</label>
            <input className="border border-gray-300 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-green-400"
              placeholder="https://zoom.us/j/..."
              value={confirmLink} onChange={e => setConfirmLink(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm({ confirmed_at: confirmTime || null, meeting_link: confirmLink || null })}
              disabled={isConfirming}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">
              {isConfirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={() => setShowConfirm(false)}
              className="px-2.5 py-1 border border-gray-200 text-xs rounded text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewProgressPanel({
  submissionId,
  isAdmin,
  onAssignClick,
}: {
  submissionId: string
  isAdmin: boolean
  onAssignClick?: () => void
}) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [requestingStageId, setRequestingStageId] = useState<string | null>(null)
  const [meetingForm, setMeetingForm] = useState({ title: '', description: '', proposed_at: '' })

  const { data, isLoading } = useQuery<{
    data: ReviewProgressStage[]
    is_blind: boolean
    allow_meetings: boolean
  }>({
    queryKey: ['review-progress', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/review-progress`).then(r => r.data),
  })

  const allowMeetings = data?.allow_meetings ?? false

  const { data: meetingsData } = useQuery<{ data: SubmissionMeeting[] }>({
    queryKey: ['submission-meetings', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/meetings`).then(r => r.data),
    enabled: allowMeetings,
  })

  const requestMeetingMutation = useMutation({
    mutationFn: (payload: { stage_id: string; title: string; description: string; proposed_at: string | null }) =>
      api.post(`/submissions/${submissionId}/meetings`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission-meetings', submissionId] })
      setRequestingStageId(null)
      setMeetingForm({ title: '', description: '', proposed_at: '' })
    },
  })

  const confirmMeetingMutation = useMutation({
    mutationFn: ({ meetingId, ...payload }: { meetingId: string; confirmed_at: string | null; meeting_link: string | null }) =>
      api.patch(`/submissions/${submissionId}/meetings/${meetingId}`, { status: 'confirmed', ...payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission-meetings', submissionId] }),
  })

  const cancelMeetingMutation = useMutation({
    mutationFn: (meetingId: string) =>
      api.delete(`/submissions/${submissionId}/meetings/${meetingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission-meetings', submissionId] }),
  })

  const stages = data?.data ?? []
  const isBlind = data?.is_blind ?? false
  const meetings = meetingsData?.data ?? []
  const meetingsByStage = (stageId: string) => meetings.filter(m => m.stage_id === stageId)
  const hasNeedsAssignment = stages.some(s => s.status === 'needs_assignment')

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      </div>
    )
  }

  if (stages.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">Review Progress</h2>
        {isBlind && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <EyeOff className="w-3 h-3" /> Blind Review
          </span>
        )}
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {stages.length} stage{stages.length !== 1 ? 's' : ''}
        </span>
        {hasNeedsAssignment && onAssignClick && (
          <button
            onClick={onAssignClick}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
          >
            <UserPlus className="w-3 h-3" />
            Assign Reviewers
          </button>
        )}
      </div>

      <ol className="space-y-3">
        {stages.map((stage, idx) => {
          const cfg = STAGE_STATUS_CONFIG[stage.status] ?? STAGE_STATUS_CONFIG.pending
          const outcomeCfg = stage.outcome ? OUTCOME_CONFIG[stage.outcome] : null
          const stageMeetings = allowMeetings ? meetingsByStage(stage.id) : []
          const isActiveStage = ['assigned', 'in_progress', 'needs_assignment'].includes(stage.status)

          return (
            <li key={stage.id} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* Stage header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50">
                <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${cfg.numCls}`}>
                  {stage.status === 'completed' ? <Check className="w-3 h-3" /> : idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{stage.name}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {stage.role_label && <span className="text-xs text-gray-400">{stage.role_label}</span>}
                    {stage.due_days ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> {stage.due_days}d review window
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400 tabular-nums">
                    {stage.reviewers_count > 0
                      ? `${stage.completed_count}/${stage.reviewers_count} reviewed`
                      : <span className="text-gray-300">0 assigned</span>}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                  {outcomeCfg && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${outcomeCfg.cls}`}>{outcomeCfg.label}</span>
                  )}
                </div>
              </div>

              {/* Reviewer names — shown when not blind review (or admin override) */}
              {stage.reviewers !== null && (
                <div className="px-4 py-2 border-t border-gray-100 bg-white">
                  {stage.reviewers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No reviewers assigned yet.</p>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-gray-400 flex-shrink-0">Reviewers:</span>
                      {stage.reviewers.map(r => (
                        <span key={r.id}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${REVIEWER_STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.name ?? 'Anonymous'}
                          {r.due_at && <span className="opacity-60">· due {new Date(r.due_at).toLocaleDateString()}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Meetings section */}
              {allowMeetings && (isActiveStage || stageMeetings.length > 0 || isAdmin) && (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-white space-y-2">
                  {stageMeetings.length > 0 && (
                    <div className="space-y-2">
                      {stageMeetings.map(m => (
                        <MeetingItem
                          key={m.id}
                          meeting={m}
                          isAdmin={isAdmin}
                          currentUserId={user?.id ?? ''}
                          onCancel={() => cancelMeetingMutation.mutate(m.id)}
                          onConfirm={(d) => confirmMeetingMutation.mutate({ meetingId: m.id, ...d })}
                          isConfirming={confirmMeetingMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                  {requestingStageId === stage.id ? (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                      <p className="text-xs font-semibold text-blue-700">Request a Meeting</p>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Meeting title *"
                        value={meetingForm.title}
                        onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))}
                      />
                      <input
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Description (optional)"
                        value={meetingForm.description}
                        onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                      />
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Proposed date/time (optional)</label>
                        <input type="datetime-local"
                          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={meetingForm.proposed_at}
                          onChange={e => setMeetingForm(f => ({ ...f, proposed_at: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => requestMeetingMutation.mutate({
                            stage_id: stage.id,
                            title: meetingForm.title,
                            description: meetingForm.description,
                            proposed_at: meetingForm.proposed_at || null,
                          })}
                          disabled={requestMeetingMutation.isPending || !meetingForm.title.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {requestMeetingMutation.isPending
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Calendar className="w-3 h-3" />}
                          Submit Request
                        </button>
                        <button
                          onClick={() => { setRequestingStageId(null); setMeetingForm({ title: '', description: '', proposed_at: '' }) }}
                          className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg text-gray-600 hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setRequestingStageId(stage.id)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
                      <Calendar className="w-3.5 h-3.5" />
                      Request Meeting
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── Authors Panel ─────────────────────────────────────────────────────────────

function AuthorsPanel({ submissionId, canEdit }: { submissionId: string; canEdit: boolean }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', affiliation: '' })
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery<{ data: SubmissionAuthor[] }>({
    queryKey: ['submission-authors', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/authors`).then(r => r.data),
  })

  const authors = data?.data ?? []

  const addMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post(`/submissions/${submissionId}/authors`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission-authors', submissionId] })
      setForm({ name: '', email: '', affiliation: '' })
      setShowForm(false)
      setFormError('')
    },
    onError: (e: any) => setFormError(e?.response?.data?.message ?? 'Failed to add author.'),
  })

  const removeMutation = useMutation({
    mutationFn: (authorId: string) =>
      api.delete(`/submissions/${submissionId}/authors/${authorId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission-authors', submissionId] }),
  })

  const resendMutation = useMutation({
    mutationFn: (authorId: string) =>
      api.post(`/submissions/${submissionId}/authors/${authorId}/resend-invite`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission-authors', submissionId] }),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Authors</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{authors.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ['submission-authors', submissionId] })} className="p-1.5 text-gray-400 hover:text-gray-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {canEdit && (
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Co-Author
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Full name *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Dr. Jane Smith"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jane@university.edu"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Affiliation</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="City University of Hong Kong"
              value={form.affiliation}
              onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))}
            />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => addMutation.mutate(form)}
              disabled={addMutation.isPending || !form.name.trim() || !form.email.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              Add Author
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError('') }}
              className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-400">
            If this person doesn't have an account, they'll receive an invitation email.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : authors.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">No authors listed yet.</p>
      ) : (
        <ul className="space-y-2">
          {authors.map(a => (
            <li key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl group">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                {a.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  {a.is_corresponding && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Corresponding</span>
                  )}
                  {a.has_account ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <MailCheck className="w-3 h-3" /> Has account
                    </span>
                  ) : a.invite_pending ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Mail className="w-3 h-3" /> Invite pending
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">{a.email}</p>
                {a.affiliation && <p className="text-xs text-gray-400">{a.affiliation}</p>}
              </div>
              {canEdit && !a.is_corresponding && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {a.invite_pending && (
                    <button
                      onClick={() => resendMutation.mutate(a.id)}
                      disabled={resendMutation.isPending}
                      className="p-1.5 text-amber-500 hover:text-amber-700"
                      title="Resend invite"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeMutation.mutate(a.id)}
                    disabled={removeMutation.isPending}
                    className="p-1.5 text-gray-300 hover:text-red-500"
                    title="Remove author"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Reviewers Panel (admin/coordinator only) ──────────────────────────────────

const REVIEWER_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  accepted:  'bg-blue-100 text-blue-700',
  declined:  'bg-red-100 text-red-600',
  completed: 'bg-green-100 text-green-700',
}

const DECISION_STYLES: Record<string, string> = {
  approve: 'bg-green-100 text-green-700',
  reject:  'bg-red-100 text-red-600',
  revise:  'bg-orange-100 text-orange-700',
}

function ReviewerSearchAdder({
  submissionId, stageId, existingUserIds, onAdded,
}: {
  submissionId: string
  stageId: string
  existingUserIds: string[]
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: searchData, isFetching } = useQuery<{ data: Array<{ id: string; name: string; email: string; org_role: string | null }> }>({
    queryKey: ['reviewer-search', query],
    queryFn: () =>
      api.get('/users', { params: { search: query, role: 'reviewer', per_page: 10, is_active: true } }).then(r => r.data),
    enabled: query.length >= 2,
    placeholderData: prev => prev,
  })

  const { data: poolData } = useQuery<{ data: Array<{ user_id: string; user: { id: string; name: string; email: string; org_role: string | null } }> }>({
    queryKey: ['pool-suggestions', submissionId, stageId],
    queryFn: () =>
      api.get(`/submissions/${submissionId}/reviewer-pool-suggestions`, { params: { stage_id: stageId } }).then(r => r.data),
    enabled: showSuggestions,
  })

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/submissions/${submissionId}/reviewers`, { stage_id: stageId, user_id: userId }),
    onSuccess: () => { onAdded(); setQuery(''); setOpen(false) },
  })

  const results = (searchData?.data ?? []).filter(u => !existingUserIds.includes(u.id))
  const suggestions = (poolData?.data ?? []).filter(p => !existingUserIds.includes(p.user_id))

  return (
    <div ref={ref} className="space-y-2">
      {/* Pool suggestions */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">From pool:</span>
          {suggestions.map(s => (
            <button
              key={s.user_id}
              onClick={() => addMutation.mutate(s.user_id)}
              disabled={addMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100"
            >
              <UserPlus className="w-3 h-3" />
              {s.user.name}
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div
          className="flex items-center gap-1.5 border border-dashed border-blue-300 rounded-lg px-2.5 py-1.5 bg-blue-50 cursor-text"
          onClick={() => { setOpen(true); setShowSuggestions(true) }}
        >
          <Search className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <input
            className="flex-1 text-xs bg-transparent outline-none text-blue-700 placeholder:text-blue-400 min-w-0"
            placeholder="Search reviewers by name or email…"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { setOpen(true); setShowSuggestions(true) }}
          />
          {isFetching && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
        </div>
        {open && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white rounded-xl shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No reviewers found</p>
            ) : (
              results.map(u => (
                <button
                  key={u.id}
                  onClick={() => addMutation.mutate(u.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewersPanel({ submissionId, submissionTypeId }: { submissionId: string; submissionTypeId: string }) {
  const qc = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const { data: reviewersData, isLoading } = useQuery<{ data: SubmissionReviewer[] }>({
    queryKey: ['submission-reviewers', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/reviewers`).then(r => r.data),
  })

  const { data: typeData } = useQuery<{ data: SubmissionTypeAdmin }>({
    queryKey: ['admin-type', submissionTypeId],
    queryFn: () => api.get(`/admin/submission-types/${submissionTypeId}`).then(r => r.data),
    enabled: !!submissionTypeId,
  })

  const removeMutation = useMutation({
    mutationFn: (reviewerId: string) =>
      api.delete(`/submissions/${submissionId}/reviewers/${reviewerId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submission-reviewers', submissionId] }),
  })

  const reviewers = reviewersData?.data ?? []
  const stages = typeData?.data?.workflow?.stages ?? []

  const reviewersByStage = (stageId: string) => reviewers.filter(r => r.stage_id === stageId)
  const existingUserIds = (stageId: string) => reviewersByStage(stageId).map(r => r.user_id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">Reviewer Assignments</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{reviewers.length} total</span>
        <div className="ml-auto">
          {isEditing ? (
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
            >
              <Check className="w-3.5 h-3.5" /> Done
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-700">Edit mode — remove existing reviewers or add new ones below. Click <strong>Done</strong> when finished.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : stages.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No workflow stages configured for this submission type.</p>
      ) : (
        <div className="space-y-4">
          {stages.map((stage, idx) => {
            const stageReviewers = reviewersByStage(stage.id)
            return (
              <div key={stage.id} className="border border-gray-100 rounded-xl">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-t-xl border-b border-gray-100">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-gray-800">{stage.name}</p>
                  <span className="text-xs text-gray-400 font-mono">{stage.stage_role_label}</span>
                  <span className="ml-auto text-xs text-gray-400">{stageReviewers.length} assigned</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {stageReviewers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No reviewers assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {stageReviewers.map(r => (
                        <li key={r.id} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700 flex-shrink-0">
                            {r.user?.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-medium text-gray-900">{r.user?.name}</p>
                              {r.decision && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${DECISION_STYLES[r.decision]}`}>
                                  {r.decision}
                                </span>
                              )}
                              {r.due_at && (
                                <span className="text-xs text-gray-400">Due {new Date(r.due_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{r.user?.email}</p>
                            {r.comments && (
                              <p className="text-xs text-gray-500 mt-0.5 italic">"{r.comments}"</p>
                            )}
                          </div>
                          {isEditing && (
                            <button
                              onClick={() => removeMutation.mutate(r.id)}
                              className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                              title="Remove reviewer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {isEditing && (
                    <ReviewerSearchAdder
                      submissionId={submissionId}
                      stageId={stage.id}
                      existingUserIds={existingUserIds(stage.id)}
                      onAdded={() => qc.invalidateQueries({ queryKey: ['submission-reviewers', submissionId] })}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inline Document Viewer ────────────────────────────────────────────────────

type ViewingDoc = { submissionId: string; versionNumber: number; filename: string; fileType: 'pdf' | 'docx' }

function InlineDocViewer({ doc, onClose }: { doc: ViewingDoc; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const fileUrl = `/api/submissions/${doc.submissionId}/files/${doc.versionNumber}/${encodeURIComponent(doc.filename)}`

  useEffect(() => {
    let objectUrl: string | null = null
    setLoading(true)
    setError(null)
    setBlobUrl(null)

    api.get(fileUrl, { responseType: 'arraybuffer' })
      .then(res => {
        const buf = res.data as ArrayBuffer
        if (doc.fileType === 'pdf') {
          const blob = new Blob([buf], { type: 'application/pdf' })
          objectUrl = URL.createObjectURL(blob)
          setBlobUrl(objectUrl)
          setLoading(false)
        } else {
          // DOCX — render using docx-preview
          const container = containerRef.current
          if (!container) { setLoading(false); return }
          renderAsync(buf, container, undefined, {
            className: 'docx-viewer',
            inWrapper: false,
            ignoreLastRenderedPageBreak: true,
          }).then(() => setLoading(false)).catch(() => {
            setError('Could not render document. Please use Download instead.')
            setLoading(false)
          })
        }
      })
      .catch(() => {
        setError('Failed to load document.')
        setLoading(false)
      })

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, doc.fileType])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <FileText className="w-4 h-4 text-gray-500" />
        <p className="text-sm font-medium text-gray-800 flex-1 truncate">{doc.filename}</p>
        <a
          href={fileUrl}
          download={doc.filename}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          title="Close viewer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-100 flex flex-col">
        {loading && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{error}</p>
              <a
                href={fileUrl}
                download={doc.filename}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" /> Download Instead
              </a>
            </div>
          </div>
        )}
        {doc.fileType === 'pdf' && blobUrl && (
          <iframe
            src={blobUrl}
            title={doc.filename}
            className="flex-1 w-full"
            style={{ minHeight: 'calc(100vh - 57px)', border: 'none' }}
          />
        )}
        {doc.fileType === 'docx' && (
          <div
            ref={containerRef}
            className="flex-1 bg-white mx-auto my-4 shadow-sm rounded"
            style={{
              maxWidth: '900px',
              width: '100%',
              padding: '2rem 3rem',
              overflowY: 'auto',
              display: loading ? 'none' : 'block',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ sub, canEdit }: { sub: Submission; canEdit: boolean }) {
  const navigate = useNavigate()
  const [viewingDoc, setViewingDoc] = useState<ViewingDoc | null>(null)

  return (
    <>
      {viewingDoc && (
        <InlineDocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Documents</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sub.versions.length} version{sub.versions.length !== 1 ? 's' : ''}</span>
          </div>
          {canEdit && (
            <button
              onClick={() => navigate(`/submissions/${sub.id}/upload`)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Upload New Version
            </button>
          )}
        </div>

        {sub.versions.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <FileText className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">No files uploaded yet.</p>
            {canEdit && (
              <button
                onClick={() => navigate(`/submissions/${sub.id}/upload`)}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" /> Upload Document
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {sub.versions.map(v => {
              const isLatest = v.version_number === sub.current_version
              return (
                <li key={v.id} className={`border rounded-xl overflow-hidden ${isLatest ? 'border-blue-200' : 'border-gray-100'}`}>
                  {/* Version header */}
                  <div className={`flex items-center gap-3 px-4 py-3 ${isLatest ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b border-gray-100'}`}>
                    <FileText className={`w-4 h-4 flex-shrink-0 ${isLatest ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {v.version_number === 0 ? 'Original Submission' : `Revision ${v.version_number}`}
                        </p>
                        {isLatest && (
                          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-medium">Latest</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Uploaded {new Date(v.submitted_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {v.change_summary && (
                    <div className="px-4 py-2 bg-white border-b border-gray-100">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Change note: </span>
                        {v.change_summary}
                      </p>
                    </div>
                  )}

                  {/* Files */}
                  <div className="px-4 py-3 bg-white space-y-2">
                    {v.document_paths.map((path, pi) => {
                      const filename = path.split('/').pop() ?? 'file'
                      const ext = filename.split('.').pop()?.toLowerCase() ?? ''
                      const isPdf = ext === 'pdf'
                      const isDocx = ext === 'docx'
                      const canView = isPdf || isDocx
                      const downloadUrl = `/api/submissions/${sub.id}/files/${v.version_number}/${encodeURIComponent(filename)}`
                      return (
                        <div key={pi} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg bg-gray-50">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <p className="flex-1 text-sm text-gray-700 truncate min-w-0">{filename}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {canView && (
                              <button
                                onClick={() => setViewingDoc({
                                  submissionId: sub.id,
                                  versionNumber: v.version_number,
                                  filename,
                                  fileType: isPdf ? 'pdf' : 'docx',
                                })}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            )}
                            <a
                              href={downloadUrl}
                              download={filename}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────

const DECISION_ICON: Record<string, React.ElementType> = {
  approve: ThumbsUp,
  reject:  ThumbsDown,
  revise:  RotateCcw,
}

const DECISION_COLOR: Record<string, string> = {
  approve: 'text-green-600 bg-green-50 border-green-200',
  reject:  'text-red-600 bg-red-50 border-red-200',
  revise:  'text-orange-600 bg-orange-50 border-orange-200',
}

const DECISION_LABEL: Record<string, string> = {
  approve: 'Approved',
  reject:  'Rejected',
  revise:  'Revision Requested',
}

const APPEAL_STATUS_COLORS: Record<string, string> = {
  PENDING:      'bg-yellow-100 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-100 text-blue-700',
  UPHELD:       'bg-green-100 text-green-700',
  DISMISSED:    'bg-red-100 text-red-700',
}

function FeedbackTab({
  submissionId, submissionStatus, isAdmin,
}: {
  submissionId: string
  submissionStatus: SubmissionStatus
  isAdmin: boolean
}) {
  const qc = useQueryClient()
  const [showAppeal, setShowAppeal] = useState(false)

  const { data, isLoading } = useQuery<{ data: FeedbackItem[]; appeal: Appeal | null }>({
    queryKey: ['submission-feedback', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/feedback`).then(r => r.data),
  })

  const feedbackItems = data?.data ?? []
  const appeal = data?.appeal ?? null
  const isDraft = submissionStatus === 'DRAFT'

  if (isDraft) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Reviewer feedback will appear here after your submission is reviewed.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {feedbackItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No reviewer feedback yet.</p>
          <p className="text-xs text-gray-400 mt-1">Feedback will appear once a reviewer submits their decision.</p>
        </div>
      ) : (
        feedbackItems.map((item) => {
          const Icon = DECISION_ICON[item.decision] ?? Info
          const colorClass = DECISION_COLOR[item.decision] ?? 'text-gray-600 bg-gray-50 border-gray-200'
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${colorClass}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{DECISION_LABEL[item.decision] ?? item.decision}</p>
                  {item.stage && <p className="text-xs opacity-70">{item.stage.name}</p>}
                </div>
                <div className="text-right">
                  {item.reviewer && <p className="text-xs font-medium">{item.reviewer.name}</p>}
                  <p className="text-xs opacity-60">{new Date(item.decision_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
              <div className="px-5 py-4">
                {item.comments ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.comments}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No comments provided.</p>
                )}
              </div>
            </div>
          )
        })
      )}

      {/* Gated release: pending notice */}
      {submissionStatus === 'PENDING_RELEASE' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Awaiting Release Decision</p>
            <p className="text-sm text-amber-700 mt-0.5">
              All review stages are complete. A coordinator will issue the final release decision.
            </p>
          </div>
        </div>
      )}

      {/* Gated release: decision received */}
      {(submissionStatus === 'ACCEPTED' || submissionStatus === 'CONDITIONALLY_ACCEPTED') && !isAdmin && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {submissionStatus === 'ACCEPTED' ? 'Submission Accepted' : 'Conditionally Accepted'}
            </p>
            <p className="text-sm text-green-700 mt-0.5">
              A formal release decision has been issued. Check feedback below for any conditions.
            </p>
          </div>
        </div>
      )}

      {/* Appeal section */}
      {(submissionStatus === 'REJECTED' || submissionStatus === 'APPEAL_PENDING') && !isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">Appeal Decision</h3>
          </div>

          {appeal ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPEAL_STATUS_COLORS[appeal.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  Appeal {appeal.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-gray-400">{new Date(appeal.created_at).toLocaleDateString()}</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 mb-1">Your grounds:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{appeal.grounds}</p>
              </div>
              {appeal.resolution_note && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-700 mb-1">Coordinator response:</p>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{appeal.resolution_note}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                If you believe this rejection was made in error, you may submit a formal appeal for coordinator review.
              </p>
              <button
                onClick={() => setShowAppeal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
              >
                <Gavel className="w-4 h-4" /> Submit Appeal
              </button>
            </div>
          )}
        </div>
      )}

      {showAppeal && (
        <AppealModal
          submissionId={submissionId}
          onClose={() => setShowAppeal(false)}
          onSubmitted={() => {
            qc.invalidateQueries({ queryKey: ['submission-feedback', submissionId] })
          }}
        />
      )}
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ElementType> = {
  created:          CheckCircle2,
  version_uploaded: Upload,
  review_decision:  UserCheck,
  system:           Info,
}

const EVENT_COLOR: Record<string, string> = {
  created:          'bg-green-100 text-green-700',
  version_uploaded: 'bg-blue-100 text-blue-700',
  review_decision:  'bg-purple-100 text-purple-700',
  system:           'bg-gray-100 text-gray-600',
}

function ActivityTab({ submissionId }: { submissionId: string }) {
  const { data, isLoading } = useQuery<{ data: ActivityEvent[] }>({
    queryKey: ['submission-activity', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/activity`).then(r => r.data),
  })

  const events = data?.data ?? []

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />

        <ul className="space-y-5">
          {events.map(event => {
            const Icon = EVENT_ICON[event.type] ?? Info
            const colorClass = EVENT_COLOR[event.type] ?? 'bg-gray-100 text-gray-600'
            return (
              <li key={event.id} className="relative flex gap-4 pl-10">
                {/* Dot */}
                <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{event.label}</p>
                    <time className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </time>
                  </div>
                  {event.actor && (
                    <p className="text-xs text-gray-500 mt-0.5">by {event.actor}</p>
                  )}
                  {event.stage && (
                    <p className="text-xs text-gray-400">Stage: {event.stage}</p>
                  )}
                  {event.note && (
                    <p className="text-xs text-gray-500 mt-1 italic">"{event.note}"</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ── Reviewer Decision Panel ───────────────────────────────────────────────────

const DECISION_OPTIONS = [
  {
    value: 'approve',
    label: 'Approve',
    description: 'The submission meets the required standards.',
    color: 'border-green-300 bg-green-50 text-green-800',
    selectedColor: 'border-green-500 bg-green-100 ring-2 ring-green-400',
    icon: ThumbsUp,
  },
  {
    value: 'revise',
    label: 'Request Revision',
    description: 'Changes are needed before approval.',
    color: 'border-orange-300 bg-orange-50 text-orange-800',
    selectedColor: 'border-orange-500 bg-orange-100 ring-2 ring-orange-400',
    icon: RotateCcw,
  },
  {
    value: 'reject',
    label: 'Reject',
    description: 'The submission does not meet requirements.',
    color: 'border-red-300 bg-red-50 text-red-800',
    selectedColor: 'border-red-500 bg-red-100 ring-2 ring-red-400',
    icon: ThumbsDown,
  },
]

function ReviewerDecisionPanel({
  submissionId,
  submissionStatus,
}: {
  submissionId: string
  submissionStatus: SubmissionStatus
}) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const toast = useToastHelpers()
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Fetch the reviewer assignments for this submission to find current user's record
  const { data: reviewersData } = useQuery<{ data: SubmissionReviewer[] }>({
    queryKey: ['submission-reviewers', submissionId],
    queryFn: () => api.get(`/submissions/${submissionId}/reviewers`).then(r => r.data),
    enabled: !!user && submissionStatus === 'IN_REVIEW',
  })

  const myAssignment = reviewersData?.data?.find(r => r.user_id === user?.id) ?? null

  const decisionMutation = useMutation({
    mutationFn: () =>
      api.patch(`/submissions/${submissionId}/reviewers/${myAssignment!.id}`, {
        decision: selectedDecision,
        comments: comments.trim() || null,
      }),
    onSuccess: () => {
      setShowConfirm(false)
      qc.invalidateQueries({ queryKey: ['submission', submissionId] })
      qc.invalidateQueries({ queryKey: ['submission-reviewers', submissionId] })
      qc.invalidateQueries({ queryKey: ['review-progress', submissionId] })
      qc.invalidateQueries({ queryKey: ['my-reviews'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Decision submitted.', 'Your review has been recorded.')
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Failed to submit decision.'
      setSubmitError(msg)
      setShowConfirm(false)
      toast.error('Decision failed.', msg)
    },
  })

  // Only show when user is an assigned reviewer and hasn't decided yet
  if (!myAssignment || myAssignment.decision !== null) return null
  if (submissionStatus !== 'IN_REVIEW') return null

  // Already submitted — show confirmation
  if (myAssignment.status === 'completed' && myAssignment.decision) {
    return null
  }

  const selectedOption = DECISION_OPTIONS.find(o => o.value === selectedDecision)

  return (
    <div className="mb-5 bg-white rounded-xl border-2 border-blue-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 bg-blue-50 border-b border-blue-100">
        <Gavel className="w-4 h-4 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Your Review Decision</p>
          {myAssignment.stage && (
            <p className="text-xs text-blue-600 mt-0.5">
              Stage: {myAssignment.stage.name} · {myAssignment.stage.stage_role_label}
            </p>
          )}
        </div>
        {myAssignment.due_at && (
          <span className="ml-auto text-xs text-blue-500">
            Due {new Date(myAssignment.due_at).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Decision options */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Select your decision</p>
          <div className="grid grid-cols-3 gap-2">
            {DECISION_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isSelected = selectedDecision === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDecision(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${isSelected ? opt.selectedColor : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? '' : 'text-gray-400'}`} />
                  <span className={`text-xs font-semibold ${isSelected ? '' : 'text-gray-600'}`}>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Comments */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block uppercase tracking-wide">
            Comments <span className="text-gray-400 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            rows={4}
            placeholder="Provide detailed feedback to the author…"
            value={comments}
            onChange={e => setComments(e.target.value)}
            maxLength={10000}
          />
          <p className="text-xs text-gray-400 mt-1">{comments.length}/10000</p>
        </div>

        {submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!selectedDecision}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              selectedDecision === 'approve'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : selectedDecision === 'reject'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : selectedDecision === 'revise'
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Gavel className="w-4 h-4" />
            Submit Decision
          </button>
          {selectedDecision && (
            <p className="text-xs text-gray-500">
              You are about to <strong>{selectedOption?.label.toLowerCase()}</strong> this submission. This cannot be undone.
            </p>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && selectedOption && (
        <ConfirmModal
          title={`Confirm: ${selectedOption.label}`}
          message={`${selectedOption.description} This decision is permanent and cannot be changed after submission.`}
          confirmLabel={`Yes, ${selectedOption.label}`}
          confirmClass={
            selectedDecision === 'approve'
              ? 'bg-green-600 hover:bg-green-700'
              : selectedDecision === 'reject'
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-orange-500 hover:bg-orange-600'
          }
          onConfirm={() => decisionMutation.mutate()}
          onCancel={() => setShowConfirm(false)}
          loading={decisionMutation.isPending}
        />
      )}
    </div>
  )
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAbstract, setEditAbstract] = useState('')
  const [editError, setEditError] = useState('')
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const reviewersRef = useRef<HTMLDivElement>(null)

  const isAdmin = user?.roles?.some((r: string) => ['admin', 'coordinator'].includes(r))

  const { data, isLoading, isError } = useQuery<{ data: Submission }>({
    queryKey: ['submission', id],
    queryFn: () => api.get(`/submissions/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const sub = data?.data

  const toast = useToastHelpers()

  const updateMutation = useMutation({
    mutationFn: (payload: { title?: string; abstract?: string }) =>
      api.patch(`/submissions/${id}`, payload),
    onSuccess: (r) => {
      qc.setQueryData(['submission', id], (old: { data: Submission } | undefined) =>
        old ? { data: { ...old.data, ...r.data.data } } : old,
      )
      setEditing(false)
      toast.success('Submission updated.')
    },
    onError: () => { setEditError('Update failed.'); toast.error('Update failed.') },
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/submissions/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submission', id] })
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success('Submission submitted successfully.', 'It will be assigned for review shortly.')
    },
    onError: (e: any) => toast.error('Submit failed.', e?.response?.data?.message),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => api.post(`/submissions/${id}/withdraw`),
    onSuccess: () => {
      setShowWithdrawConfirm(false)
      qc.invalidateQueries({ queryKey: ['submission', id] })
      qc.invalidateQueries({ queryKey: ['submissions'] })
      toast.success('Submission withdrawn.')
    },
    onError: (e: any) => toast.error('Withdraw failed.', e?.response?.data?.message),
  })

  const advanceReviewMutation = useMutation({
    mutationFn: () => api.post(`/submissions/${id}/advance-review`),
    onSuccess: (r) => {
      qc.setQueryData(['submission', id], (old: { data: Submission } | undefined) =>
        old ? { data: { ...old.data, ...r.data.data } } : old,
      )
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['review-progress', id] })
      toast.success('Review advanced to next stage.')
    },
    onError: (e: any) => toast.error('Advance failed.', e?.response?.data?.message),
  })

  const startEdit = () => {
    if (!sub) return
    setEditTitle(sub.title)
    setEditAbstract(sub.abstract ?? '')
    setEditError('')
    setEditing(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError || !sub) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <XCircle className="w-10 h-10 text-red-300 mb-3" />
        <p className="text-gray-500">Submission not found or access denied.</p>
        <button onClick={() => navigate('/submissions')} className="mt-3 text-blue-600 text-sm hover:underline">
          Back to submissions
        </button>
      </div>
    )
  }

  const canEdit    = (sub.status === 'DRAFT' || sub.status === 'REVISION_REQUIRED') && !sub.is_locked
  const canSubmit  = sub.status === 'DRAFT' && !sub.is_locked && sub.versions.length > 0
  const canWithdraw = (sub.status === 'DRAFT' || sub.status === 'SUBMITTED' || sub.status === 'AWAITING_REVIEWERS') && !sub.is_locked

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/submissions')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to submissions
        </button>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          title="Print / Save as PDF"
        >
          <Printer className="w-4 h-4" />
          Print / PDF
        </button>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          {editing ? (
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={500}
            />
          ) : (
            <h1 className="text-xl font-bold text-gray-900 flex-1">{sub.title}</h1>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={sub.status} />
            {canEdit && !editing && (
              <button
                onClick={startEdit}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Type</span>
            <span className="font-medium text-gray-800">{sub.submission_type?.label ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Program</span>
            <span className="font-medium text-gray-800">{sub.program?.name ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Version</span>
            <span className="font-medium text-gray-800">
              {sub.current_version > 0 ? `v${sub.current_version}` : 'Draft (unsubmitted)'}
            </span>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <span className="text-gray-500 w-24">Submitter</span>
              <span className="font-medium text-gray-800">{sub.submitter.name}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Created</span>
            <span className="text-gray-600">{new Date(sub.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-24">Updated</span>
            <span className="text-gray-600">{new Date(sub.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Abstract */}
        {editing ? (
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Abstract</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              value={editAbstract}
              onChange={(e) => setEditAbstract(e.target.value)}
              maxLength={10000}
            />
            {editError && <p className="text-xs text-red-600 mt-1">{editError}</p>}
          </div>
        ) : sub.abstract ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Abstract</p>
            <p className="text-sm text-gray-700 leading-relaxed">{sub.abstract}</p>
          </div>
        ) : null}

        {/* Edit actions */}
        {editing && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => updateMutation.mutate({ title: editTitle.trim(), abstract: editAbstract.trim() || undefined })}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Status banners */}
      {/* Admin: accept submitted submission for review */}
      {sub.status === 'SUBMITTED' && isAdmin && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">Submission Ready for Review</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Accept this submission to begin assigning reviewers to each stage.
            </p>
            <button
              onClick={() => advanceReviewMutation.mutate()}
              disabled={advanceReviewMutation.isPending}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {advanceReviewMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <CheckCircle2 className="w-3 h-3" />}
              Accept for Review
            </button>
          </div>
        </div>
      )}

      {/* Awaiting reviewers banner */}
      {sub.status === 'AWAITING_REVIEWERS' && (
        <div className="mb-5 p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
          <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {isAdmin ? (
              <>
                <p className="text-sm font-semibold text-purple-800">Awaiting Reviewer Assignment</p>
                <p className="text-sm text-purple-700 mt-0.5">
                  Assign reviewers to the stages in the Overview tab, then start the review.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => {
                      setTab('overview')
                      setTimeout(() => reviewersRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
                  >
                    <UserPlus className="w-3 h-3" />
                    Assign Reviewers
                  </button>
                  <button
                    onClick={() => advanceReviewMutation.mutate()}
                    disabled={advanceReviewMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {advanceReviewMutation.isPending
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <CheckCircle2 className="w-3 h-3" />}
                    Start Review
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-purple-800">Awaiting Reviewer Assignment</p>
                <p className="text-sm text-purple-700 mt-0.5">
                  Your submission has been accepted for review. Reviewers will be assigned shortly.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {sub.status === 'REVISION_REQUIRED' && (
        <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">Revision Required</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Reviewers have requested changes. Upload a revised document and re-submit.{' '}
              <button onClick={() => setTab('feedback')} className="underline font-medium">View feedback →</button>
            </p>
          </div>
        </div>
      )}

      {(sub.status === 'ACCEPTED' || sub.status === 'CONDITIONALLY_ACCEPTED') && (
        <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              {sub.status === 'ACCEPTED' ? 'Submission Accepted' : 'Conditionally Accepted'}
            </p>
            {sub.status === 'CONDITIONALLY_ACCEPTED' && (
              <p className="text-sm text-green-700 mt-0.5">
                Please review the conditions in the{' '}
                <button onClick={() => setTab('feedback')} className="underline font-medium">Feedback tab</button>.
              </p>
            )}
          </div>
        </div>
      )}

      {sub.status === 'REJECTED' && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <CircleAlert className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Submission Rejected</p>
            <p className="text-sm text-red-700 mt-0.5">
              Your submission was not approved.{' '}
              <button onClick={() => setTab('feedback')} className="underline font-medium">View feedback and appeal options →</button>
            </p>
          </div>
        </div>
      )}

      {/* Reviewer decision panel — only visible to the assigned reviewer */}
      {!isAdmin && sub.status === 'IN_REVIEW' && (
        <ReviewerDecisionPanel
          submissionId={sub.id}
          submissionStatus={sub.status}
        />
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div>
          <AuthorsPanel submissionId={sub.id} canEdit={canEdit} />
          <ReviewProgressPanel
            submissionId={sub.id}
            isAdmin={!!isAdmin}
            onAssignClick={isAdmin ? () => {
              setTimeout(() => reviewersRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            } : undefined}
          />
          {isAdmin && sub.submission_type && (
            <div ref={reviewersRef}>
              <ReviewersPanel submissionId={sub.id} submissionTypeId={sub.submission_type.id} />
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <DocumentsTab sub={sub} canEdit={canEdit} />
      )}

      {tab === 'feedback' && (
        <FeedbackTab
          submissionId={sub.id}
          submissionStatus={sub.status}
          isAdmin={!!isAdmin}
        />
      )}

      {tab === 'activity' && (
        <ActivityTab submissionId={sub.id} />
      )}

      {/* Action bar */}
      {(canSubmit || canWithdraw) && (
        <div className="flex items-center gap-3 mt-5">
          {canSubmit && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Submit for Review
            </button>
          )}
          {canWithdraw && (
            <button
              onClick={() => setShowWithdrawConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"
            >
              <StopCircle className="w-4 h-4" />
              Withdraw
            </button>
          )}
        </div>
      )}

      {/* Withdraw confirm modal */}
      {showWithdrawConfirm && (
        <ConfirmModal
          title="Withdraw Submission"
          message="Are you sure you want to withdraw this submission? The coordinator will be notified and the submission will be locked."
          confirmLabel="Yes, Withdraw"
          confirmClass="bg-red-600 hover:bg-red-700"
          onConfirm={() => withdrawMutation.mutate()}
          onCancel={() => setShowWithdrawConfirm(false)}
          loading={withdrawMutation.isPending}
        />
      )}
    </div>
  )
}
