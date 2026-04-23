export interface AppNotification {
  id: string
  type: string
  data: Record<string, string | undefined>
  read_at: string | null
  created_at: string
  title: string
  body: string
  link: string | null
}

export interface NotificationsResponse {
  data: AppNotification[]
  unread_count: number
}
