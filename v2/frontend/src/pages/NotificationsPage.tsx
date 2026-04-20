import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ArrowRight } from 'lucide-react'
import api from '../lib/axios'
import type { AppNotification, NotificationsResponse } from '../types/notifications'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: (ids?: string[]) =>
      api.post('/notifications/read', ids ? { ids } : {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.data ?? []
  const unreadCount = data?.unread_count ?? 0

  function handleClick(n: AppNotification) {
    if (!n.read_at) {
      markRead.mutate([n.id])
    }
    if (n.link) navigate(n.link)
  }

  const unread = notifications.filter((n) => !n.read_at)
  const read = notifications.filter((n) => n.read_at)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Your alerts and system notifications</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markRead.mutate(undefined)}
            disabled={markRead.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-72 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Bell className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-base font-medium text-gray-500">No notifications</p>
            <p className="text-sm text-gray-400 mt-1">You're all caught up. Notifications will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                Unread ({unread.length})
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {unread.map((n) => (
                  <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />
                ))}
              </div>
            </section>
          )}

          {read.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                Earlier
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden opacity-80">
                {read.map((n) => (
                  <NotificationRow key={n.id} notification={n} onClick={() => handleClick(n)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  notification: n,
  onClick,
}: {
  notification: AppNotification
  onClick: () => void
}) {
  const isUnread = !n.read_at

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors ${isUnread ? 'bg-indigo-50/40' : ''}`}
    >
      {/* Dot */}
      <span
        className={`mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${isUnread ? 'bg-indigo-500' : 'bg-gray-200'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
          {n.title}
        </p>
        <p className="text-sm text-gray-500 mt-0.5 leading-snug">{n.body}</p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(n.created_at).toLocaleString()}
        </p>
      </div>
      {n.link && (
        <ArrowRight size={16} className="mt-1 text-gray-400 flex-shrink-0" />
      )}
    </button>
  )
}

