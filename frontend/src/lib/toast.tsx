import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  title: string
  body?: string
  duration?: number // ms; 0 = sticky
}

type ToastOptions = Omit<Toast, 'id'>

// ── Context ───────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: Toast[]
  addToast: (opts: ToastOptions) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>')
  return ctx
}

// Convenience wrappers
export function useToastHelpers() {
  const { addToast } = useToast()
  return {
    success: (title: string, body?: string) =>
      addToast({ variant: 'success', title, body }),
    error: (title: string, body?: string) =>
      addToast({ variant: 'error', title, body, duration: 6000 }),
    warning: (title: string, body?: string) =>
      addToast({ variant: 'warning', title, body }),
    info: (title: string, body?: string) =>
      addToast({ variant: 'info', title, body }),
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((opts: ToastOptions): string => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, duration: 4000, ...opts }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ── Toaster (fixed overlay) ───────────────────────────────────────────────────

function Toaster({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '22rem',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ── Single toast item ─────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; iconEl: typeof CheckCircle }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a', iconEl: CheckCircle },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626', iconEl: XCircle },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706', iconEl: AlertTriangle },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', iconEl: Info },
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const style = VARIANT_STYLES[toast.variant]
  const Icon = style.iconEl
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if ((toast.duration ?? 4000) > 0) {
      timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        padding: '0.75rem 1rem',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '0.625rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        animation: 'toast-in 0.2s ease',
      }}
    >
      <Icon size={18} color={style.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>
          {toast.title}
        </p>
        {toast.body && (
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>
            {toast.body}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0, background: 'transparent', border: 'none',
          cursor: 'pointer', padding: 2, borderRadius: 3,
          color: '#9ca3af', lineHeight: 1,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
