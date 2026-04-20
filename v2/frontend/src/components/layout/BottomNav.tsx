import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, ShieldCheck, Bell } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/axios'
import type { NotificationsResponse } from '../../types/notifications'

const ALL_ITEMS = [
  { label: 'Dashboard',    to: '/dashboard',      icon: LayoutDashboard, roles: ['admin','coordinator','reviewer','student'] },
  { label: 'Submissions',  to: '/submissions',    icon: FileText,        roles: ['admin','coordinator','reviewer','student'] },
  { label: 'Reviews',      to: '/reviews',        icon: ShieldCheck,     roles: ['admin','coordinator','reviewer'] },
  { label: 'Notifications',to: '/notifications',  icon: Bell,            roles: ['admin','coordinator','reviewer','student'] },
]

/**
 * Bottom tab bar rendered on screens narrower than `md` (768px).
 * Hidden on desktop via `md:hidden`.
 */
export default function BottomNav() {
  const user = useAuthStore((s) => s.user)
  const roles: string[] = user?.roles ?? []

  const { data: notifData } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 60_000,
    enabled: !!user,
    staleTime: 30_000,
  })
  const unreadCount = notifData?.unread_count ?? 0

  const visible = ALL_ITEMS.filter((item) =>
    item.roles.some((r) => roles.includes(r))
  )

  if (visible.length === 0) return null

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex items-stretch"
      style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visible.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors relative ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`
          }
          aria-label={item.label}
        >
          <span className="relative">
            <item.icon className="w-5 h-5" />
            {item.to === '/notifications' && unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-px leading-none"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
