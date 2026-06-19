import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import api from '../../lib/axios'
import type { LoginResponse } from '../../types/auth'
import type { PublicOrgInfo } from '../../types/organization'
import axios from 'axios'
import cityuLogo from '../../assets/city-university-logo.svg'

const schema = z.object({
  email:    z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

/* Microsoft logo SVG (4 coloured squares) */
function MsLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export default function LoginForm() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { token, setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)
  const [serverError, setServerError]   = useState<string | null>(null)

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'

  useEffect(() => {
    if (token) navigate(from, { replace: true })
  }, [token, navigate, from])

  const { data: org } = useQuery<PublicOrgInfo>({
    queryKey: ['public-org'],
    queryFn: () => api.get('/system/public').then((r) => r.data),
    retry: false,
    staleTime: Infinity,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const loginMutation = useMutation({
    mutationFn: (data: FormValues) =>
      api.post<LoginResponse>('/auth/login', data).then((r) => r.data),
    onSuccess: ({ user, token }) => {
      setAuth(user, token)
      navigate(from, { replace: true })
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        setServerError('Invalid username or password.')
      } else {
        setServerError('An unexpected error occurred.')
      }
    },
  })

  const onSubmit = (data: FormValues) => {
    setServerError(null)
    loginMutation.mutate(data)
  }

  const [emailFocused, setEmailFocused] = useState(false)
  const [passFocused, setPassFocused]   = useState(false)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const [logoOffsetX, setLogoOffsetX] = useState(0)

  const recenterLogoByVisiblePixels = () => {
    const img = logoRef.current
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight || !img.clientWidth) return

    try {
      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = srcW
      canvas.height = srcH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(img, 0, 0, srcW, srcH)
      const { data } = ctx.getImageData(0, 0, srcW, srcH)

      let minX = srcW
      let maxX = -1
      // Scan alpha channel to find visible horizontal bounds.
      for (let y = 0; y < srcH; y += 1) {
        for (let x = 0; x < srcW; x += 1) {
          const a = data[(y * srcW + x) * 4 + 3]
          if (a > 8) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
          }
        }
      }

      if (maxX < minX) {
        setLogoOffsetX(0)
        return
      }

      const imageCenter = srcW / 2
      const visibleCenter = (minX + maxX) / 2
      const sourceDelta = visibleCenter - imageCenter
      const renderedScale = img.clientWidth / srcW
      setLogoOffsetX(-sourceDelta * renderedScale)
    } catch {
      // If cross-origin or canvas read is blocked, keep normal centering.
      setLogoOffsetX(0)
    }
  }

  useEffect(() => {
    const onResize = () => recenterLogoByVisiblePixels()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Center logo by visible pixels so extra transparent margins do not skew alignment. */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <img
          ref={logoRef}
          src={cityuLogo}
          alt="City University of Seattle"
          onLoad={recenterLogoByVisiblePixels}
          style={{
            width: 260,
            maxWidth: '78%',
            height: 'auto',
            display: 'block',
            transform: `translateX(${logoOffsetX}px)`,
          }}
        />
      </div>

      {/* â”€â”€ SSO button (shown FIRST if enabled) â”€â”€ */}
      {org?.sso_enabled && (
        <div style={{
          background: '#fff', border: '1px solid #ddd', borderRadius: 4,
          padding: '10px 14px', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
          cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500, color: '#333',
          textDecoration: 'none',
        }}
          onClick={() => { window.location.href = '/api/auth/sso/redirect' }}
        >
          <MsLogo />
          Sign in with Microsoft
        </div>
      )}

      {/* â”€â”€ Divider â”€â”€ */}
      {org?.sso_enabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, height: 1, background: '#ddd' }} />
          <span style={{ fontSize: '0.78rem', color: '#999', whiteSpace: 'nowrap' }}>
            or sign in with username &amp; password
          </span>
          <div style={{ flex: 1, height: 1, background: '#ddd' }} />
        </div>
      )}

      {/* â”€â”€ Error box â”€â”€ */}
      {serverError && (
        <div style={{
          borderLeft: '4px solid #cc0000', background: '#fff8f8',
          padding: '8px 12px', marginBottom: '1rem',
          fontSize: '0.875rem', color: '#333',
          border: '1px solid #f5c6c6', borderLeftColor: '#cc0000', borderRadius: 2,
        }}>
          <strong>Error:</strong> {serverError}
        </div>
      )}

      {/* â”€â”€ Form card â”€â”€ */}
      <div style={{
        background: '#fff', border: '1px solid #ddd', borderRadius: 4,
        padding: '1.25rem 1.25rem 1rem',
      }}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* Username or Email */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="lf-email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#23282d', marginBottom: 4 }}>
              Username or Email Address
            </label>
            <input
              id="lf-email"
              type="text"
              autoComplete="username"
              style={{
                width: '100%', display: 'block', padding: '8px 10px', boxSizing: 'border-box',
                border: `1px solid ${errors.email ? '#cc0000' : emailFocused ? '#2271b1' : '#8c8f94'}`,
                boxShadow: emailFocused ? '0 0 0 1px #2271b1' : 'none',
                borderRadius: 4, fontSize: '0.9rem', outline: 'none', color: '#333', background: '#fff',
              }}
              onFocus={() => setEmailFocused(true)}
              {...register('email', { onBlur: () => setEmailFocused(false) })}
            />
            {errors.email && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#cc0000' }}>{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="lf-password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#23282d', marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="lf-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                style={{
                  width: '100%', display: 'block', padding: '8px 38px 8px 10px', boxSizing: 'border-box',
                  border: `1px solid ${errors.password ? '#cc0000' : passFocused ? '#2271b1' : '#8c8f94'}`,
                  boxShadow: passFocused ? '0 0 0 1px #2271b1' : 'none',
                  borderRadius: 4, fontSize: '0.9rem', outline: 'none', color: '#333', background: '#fff',
                }}
                onFocus={() => setPassFocused(true)}
                {...register('password', { onBlur: () => setPassFocused(false) })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: '#2271b1', display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#cc0000' }}>{errors.password.message}</p>}
          </div>

          {/* Remember Me + Log In row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: '#3c434a', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2271b1', cursor: 'pointer' }}
              />
              Remember Me
            </label>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              style={{
                background: '#1d2327', color: '#fff', border: 'none', borderRadius: 3,
                padding: '6px 18px', fontSize: '0.875rem', fontWeight: 600,
                cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: loginMutation.isPending ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {loginMutation.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Log In
            </button>
          </div>

        </form>
      </div>

      {/* â”€â”€ Lost your password â”€â”€ */}
      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <a href="#" style={{ fontSize: '0.875rem', color: '#2271b1', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Lost your password?
        </a>
      </div>

      {/* â”€â”€ Back to portal â”€â”€ */}
      <div style={{ marginTop: '0.6rem', textAlign: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#2271b1', padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          {'←'} Go to CityU Research Portal
        </button>
      </div>

    </div>
  )
}
