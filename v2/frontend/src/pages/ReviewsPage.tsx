import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock, CheckCircle2, AlertTriangle, FileText, ChevronRight, ShieldCheck } from 'lucide-react'
import api from '../lib/axios'
import { useAuthStore } from '../stores/authStore'
import { STATUS_LABELS, STATUS_COLORS } from '../types/submissions'
import type { SubmissionStatus } from '../types/submissions'

interface ReviewAssignment {
  assignment_id: string
  assignment_status: 'pending' | 'accepted' | 'declined' | 'completed'
  due_at: string | null
  decision: 'approve' | 'reject' | 'revise' | null
  decision_at: string | null
  is_overdue: boolean
  is_due_soon: boolean
  stage: { id: string; name: string; role: string } | null
  submission: {
    id: string
    title: string
    status: SubmissionStatus
    current_version: number
    submission_type: { id: string; slug: string; label: string } | null
    submitter: { id: string; name: string; email: string }
    created_at: string
  }
}

const DECISION_LABELS: Record<string, string> = {
  approve: 'Approved',
  reject:  'Rejected',
  revise:  'Revision requested',
}

const DECISION_COLORS: Record<string, string> = {
  approve: 'bg-green-100 text-green-700',
  reject:  'bg-red-100 text-red-600',
  revise:  'bg-orange-100 text-orange-700',
}

function AssignmentRow({ item, onClick }: { item: ReviewAssignment; onClick: () => void }) {
  const sub = item.submission

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left group"
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {item.decision ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : item.is_overdue ? (
          <AlertTriangle className="w-5 h-5 text-red-500" />
        ) : item.is_due_soon ? (
          <Clock className="w-5 h-5 text-amber-500" />
        ) : (
          <FileText className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{sub.title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[sub.status]}`}>
            {STATUS_LABELS[sub.status]}
          </span>
          {item.decision && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DECISION_COLORS[item.decision]}`}>
              {DECISION_LABELS[item.decision]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500">
            {sub.submitter.name}
          </span>
          {item.stage && (
            <span className="text-xs text-gray-400">
              · {item.stage.name} ({item.stage.role})
            </span>
          )}
          {item.due_at && (
            <span className={`text-xs flex items-center gap-1 ${item.is_overdue ? 'text-red-600 font-medium' : item.is_due_soon ? 'text-amber-600' : 'text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              Due {new Date(item.due_at).toLocaleDateString()} 
              {item.is_overdue ? ' (overdue)' : item.is_due_soon ? ' (soon)' : ''}
            </span>
          )}
          {sub.submission_type && (
            <span className="text-xs text-gray-400">· {sub.submission_type.label}</span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
    </button>
  )
}

function SectionHeader({ title, count, icon: Icon, color }: {
  title: string
  count: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className={`flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">{count}</span>
    </div>
  )
}

export default function ReviewsPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery<{ data: ReviewAssignment[] }>({
    queryKey: ['my-reviews'],
    queryFn: () => api.get('/submissions/my-reviews').then(r => r.data),
    staleTime: 30_000,
  })

  const items = data?.data ?? []

  const overdue   = items.filter(i => i.is_overdue && !i.decision)
  const dueSoon   = items.filter(i => i.is_due_soon && !i.decision && !i.is_overdue)
  const pending   = items.filter(i => !i.decision && !i.is_overdue && !i.is_due_soon)
  const completed = items.filter(i => i.decision !== null)

  const isAdminOrCoord = user?.roles?.some(r => r === 'admin' || r === 'coordinator')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdminOrCoord
            ? 'Manage peer review assignments and track decisions'
            : 'Submissions assigned to you for review'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse flex items-center gap-4">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/5 bg-gray-100 rounded" />
                <div className="h-3 w-2/5 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ShieldCheck className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-base font-medium text-gray-500">No reviews assigned</p>
            <p className="text-sm text-gray-400 mt-1">
              Submissions assigned to you for review will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <SectionHeader title="Overdue" count={overdue.length} icon={AlertTriangle} color="bg-red-50 text-red-700" />
              {overdue.map(item => (
                <AssignmentRow key={item.assignment_id} item={item}
                  onClick={() => navigate(`/submissions/${item.submission.id}`)} />
              ))}
            </div>
          )}

          {/* Due soon */}
          {dueSoon.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
              <SectionHeader title="Due Soon" count={dueSoon.length} icon={Clock} color="bg-amber-50 text-amber-700" />
              {dueSoon.map(item => (
                <AssignmentRow key={item.assignment_id} item={item}
                  onClick={() => navigate(`/submissions/${item.submission.id}`)} />
              ))}
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <SectionHeader title="Pending Review" count={pending.length} icon={FileText} color="bg-gray-50 text-gray-700" />
              {pending.map(item => (
                <AssignmentRow key={item.assignment_id} item={item}
                  onClick={() => navigate(`/submissions/${item.submission.id}`)} />
              ))}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <SectionHeader title="Completed" count={completed.length} icon={CheckCircle2} color="bg-green-50 text-green-700" />
              {completed.map(item => (
                <AssignmentRow key={item.assignment_id} item={item}
                  onClick={() => navigate(`/submissions/${item.submission.id}`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
