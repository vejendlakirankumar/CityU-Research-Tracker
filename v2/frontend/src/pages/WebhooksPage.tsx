import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Webhook, Plus, Trash2, ChevronDown, ChevronRight, Check, X, Eye, EyeOff, RotateCcw } from 'lucide-react'
import api from '../lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookSub {
  id: string
  url: string
  events: string[]
  description: string | null
  is_active: boolean
  masked_secret: string
  created_at: string
  deliveries_count?: number
}

interface DeliveryEntry {
  id: string
  event_type: string
  attempt: number
  status: 'pending' | 'success' | 'failed'
  response_code: number | null
  delivered_at: string | null
  created_at: string
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useWebhooks() {
  return useQuery<{ data: WebhookSub[] }>({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/admin/webhooks').then(r => r.data),
    staleTime: 30_000,
  })
}

function useEvents() {
  return useQuery<{ data: string[] }>({
    queryKey: ['webhook-events'],
    queryFn: () => api.get('/admin/webhooks/events').then(r => r.data),
    staleTime: 300_000,
  })
}

// ── Event chip ────────────────────────────────────────────────────────────────

function EventChip({ event }: { event: string }) {
  const parts = event.split('.')
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-100">
      {parts[0]}.<strong>{parts[1]}</strong>
    </span>
  )
}

// ── Delivery badge ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-green-400', failed: 'bg-red-400', pending: 'bg-amber-400'
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? 'bg-gray-300'}`} />
}

// ── Deliveries modal ──────────────────────────────────────────────────────────

function DeliveriesModal({ webhookId, onClose }: { webhookId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ data: DeliveryEntry[] }>({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => api.get(`/admin/webhooks/${webhookId}/deliveries`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Delivery History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : !data?.data?.length ? (
            <p className="text-sm text-gray-400 text-center py-12">No deliveries yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                <tr>
                  <th className="px-5 py-2.5 text-left">Event</th>
                  <th className="px-5 py-2.5 text-center">Status</th>
                  <th className="px-5 py-2.5 text-right">Code</th>
                  <th className="px-5 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.data.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><EventChip event={d.event_type} /></td>
                    <td className="px-5 py-3 text-center">
                      <span className="flex items-center justify-center gap-1.5">
                        <StatusDot status={d.status} />
                        <span className="capitalize text-xs text-gray-600">{d.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-gray-500">
                      {d.response_code ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-400">
                      {d.delivered_at
                        ? new Date(d.delivered_at).toLocaleString('en-HK', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create / Edit form ────────────────────────────────────────────────────────

interface FormState {
  url: string
  description: string
  events: string[]
  is_active: boolean
}

function WebhookForm({
  initial, onSave, onCancel, availableEvents,
}: {
  initial?: Partial<FormState>
  onSave: (form: FormState) => void
  onCancel: () => void
  availableEvents: string[]
}) {
  const [form, setForm] = useState<FormState>({
    url: initial?.url ?? '',
    description: initial?.description ?? '',
    events: initial?.events ?? [],
    is_active: initial?.is_active ?? true,
  })

  function toggleEvent(e: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter(x => x !== e) : [...f.events, e],
    }))
  }

  function valid() {
    try { new URL(form.url); return form.events.length > 0 } catch { return false }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Endpoint URL <span className="text-red-500">*</span></label>
        <input
          type="url"
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          placeholder="https://your-server.com/webhook"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Optional note"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Events to subscribe <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {availableEvents.map(ev => (
            <label key={ev} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
              form.events.includes(ev) ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="checkbox" className="sr-only" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
              <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                form.events.includes(ev) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
              }`}>
                {form.events.includes(ev) && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              {ev}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
        <label htmlFor="active" className="text-sm text-gray-700">Active</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
        <button
          onClick={() => valid() && onSave(form)}
          disabled={!valid()}
          className="px-4 py-2 text-sm font-medium bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-40 transition-colors"
        >
          Save Webhook
        </button>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function WebhookRow({
  sub, availableEvents, onDelete, onRotate, onDeliveries,
}: {
  sub: WebhookSub
  availableEvents: string[]
  onDelete: () => void
  onRotate: () => void
  onDeliveries: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (form: Partial<WebhookSub> & { rotate_secret?: boolean }) =>
      api.patch(`/admin/webhooks/${sub.id}`, form).then(r => r.data),
    onSuccess: (res) => {
      if (res.data?.plain_secret) setNewSecret(res.data.plain_secret)
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      setEditing(false)
    },
  })

  const rotateMutation = useMutation({
    mutationFn: () => api.patch(`/admin/webhooks/${sub.id}`, { rotate_secret: true }).then(r => r.data),
    onSuccess: (res) => {
      if (res.data?.plain_secret) setNewSecret(res.data.plain_secret)
      onRotate()
    },
  })

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${sub.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{sub.url}</p>
          {sub.description && <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>}
          <div className="flex flex-wrap gap-1 mt-2">
            {sub.events.map(ev => <EventChip key={ev} event={ev} />)}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onDeliveries} title="Delivery history"
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(e => !e)} title="Edit"
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${editing ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secret display */}
      {newSecret && (
        <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-1">New secret (copy now — shown once)</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-amber-900 flex-1 break-all">
              {showSecret ? newSecret : '•'.repeat(newSecret.length)}
            </code>
            <button onClick={() => setShowSecret(s => !s)} className="text-amber-600 hover:text-amber-800">
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(newSecret); setNewSecret(null) }}
              className="text-xs text-amber-700 font-medium hover:text-amber-900">Copy & dismiss</button>
          </div>
        </div>
      )}

      {/* Secret mask */}
      {!newSecret && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <code className="text-xs font-mono text-gray-400">{sub.masked_secret}</code>
          <button onClick={() => rotateMutation.mutate()} title="Rotate secret"
            disabled={rotateMutation.isPending}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-700 transition-colors disabled:opacity-40">
            <RotateCcw className="w-3 h-3" />Rotate
          </button>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <WebhookForm
            initial={{ url: sub.url, description: sub.description ?? '', events: sub.events, is_active: sub.is_active }}
            availableEvents={availableEvents}
            onCancel={() => setEditing(false)}
            onSave={form => updateMutation.mutate(form)}
          />
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [creating, setCreating] = useState(false)
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useWebhooks()
  const { data: eventsData }  = useEvents()

  const subs            = data?.data ?? []
  const availableEvents = eventsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: (form: FormState) => api.post('/admin/webhooks', form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); setCreating(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-gray-400" />
            <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Receive HTTP POST notifications for portal events</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors">
            <Plus className="w-4 h-4" />Add Webhook
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">New Webhook Subscription</h3>
          <WebhookForm
            availableEvents={availableEvents}
            onCancel={() => setCreating(false)}
            onSave={form => createMutation.mutate(form)}
          />
          {createMutation.data?.data?.plain_secret && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-semibold text-green-700 mb-1">Signing secret (save now — shown only once)</p>
              <code className="text-xs font-mono text-green-900 break-all">{createMutation.data.data.plain_secret}</code>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !subs.length ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-20">
          <Webhook className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">No webhooks configured</p>
          <p className="text-xs text-gray-400 mt-1">Add a webhook above to start receiving event notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map(sub => (
            <WebhookRow
              key={sub.id}
              sub={sub}
              availableEvents={availableEvents}
              onDelete={() => { if (window.confirm('Delete this webhook?')) deleteMutation.mutate(sub.id) }}
              onRotate={() => qc.invalidateQueries({ queryKey: ['webhooks'] })}
              onDeliveries={() => setDeliveriesFor(sub.id)}
            />
          ))}
        </div>
      )}

      {/* Deliveries modal */}
      {deliveriesFor && (
        <DeliveriesModal webhookId={deliveriesFor} onClose={() => setDeliveriesFor(null)} />
      )}
    </div>
  )
}

