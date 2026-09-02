import { useState, useEffect, useRef } from 'react'
import {
  Building2, Mail, Shield, Bell, Sliders, Key,
  Save, Send, Plus, Pencil, Trash2, CheckCircle2,
  XCircle, Eye, EyeOff, ChevronRight, AlertCircle,
  Upload, Loader2, ToggleLeft, ToggleRight, HardDrive,
  Clock, Puzzle, Archive, Download, RotateCcw,
  ShieldCheck, Copy, FileText, Paperclip,
} from 'lucide-react'
import api from '../lib/axios'

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgSettings {
  org_name: string
  portal_name: string
  org_short_name: string | null
  primary_color: string
  accent_color: string | null
  timezone: string
  locale: string
  date_format: string
  footer_text: string | null
  support_email: string | null
  allow_public_registration: boolean
  archive_after_days: number | null
  audit_retention_days: number | null
  logo_url?: string | null
}

interface EmailSettings {
  id: number
  driver: 'log' | 'smtp' | 'ses' | 'sendmail' | 'graph'
  host: string | null
  port: number
  encryption: string | null
  username: string | null
  password_set: boolean
  from_address: string
  from_name: string
  reply_to: string | null
  is_verified: boolean
  ses_region: string | null
  ses_key_set: boolean
  ses_secret_set: boolean
  graph_tenant_id: string | null
  graph_client_id: string | null
  graph_secret_set: boolean
}

interface PasswordPolicy {
  id: number
  min_length: number
  require_uppercase: boolean
  require_number: boolean
  require_special: boolean
  expiry_days: number | null
  history_count: number
  max_login_attempts: number
  lockout_duration_minutes: number
  session_timeout_minutes: number
  require_2fa: boolean
}

interface FeatureFlags { [key: string]: boolean }

interface NotificationTemplate {
  id: string
  event_type: string
  subject: string
  body_html: string
  body_text: string
  is_active: boolean
  variables: string[]
}

interface SsoProvider {
  id: string
  name: string
  protocol: 'OIDC' | 'OAUTH2' | 'SAML2'
  is_enabled: boolean
  is_default: boolean
  button_label: string | null
  auto_provision_users: boolean
  default_role: string
  config: Record<string, string>
}

// ── Nav tabs ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'org',           label: 'Organization',        icon: Building2 },
  { id: 'email',         label: 'Email',               icon: Mail },
  { id: 'sso',           label: 'SSO Providers',        icon: Key },
  { id: 'security',      label: 'Password & Security', icon: Shield },
  { id: 'notifications', label: 'Email Notifications', icon: Bell },
  { id: 'email_templates', label: 'Email Templates',   icon: Send },
  { id: 'flags',         label: 'Feature Flags',       icon: Sliders },
  { id: 'review',        label: 'Review Settings',     icon: Clock },
  { id: 'integrations',  label: 'Integrations',        icon: Puzzle },
  { id: 'backup',        label: 'Backup',              icon: HardDrive },
  { id: 'archive',       label: 'Archive',             icon: Archive },
] as const

type TabId = typeof TABS[number]['id']

// ── Helpers ───────────────────────────────────────────────────────────────────

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" /> Saved
        </span>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </button>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400 -mt-0.5">{hint}</p>}
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Organization Tab ──────────────────────────────────────────────────────────

function OrgTab() {
  const [data, setData] = useState<OrgSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/system/organization').then(r => setData(r.data)).catch(() => setError('Failed to load'))
  }, [])

  const save = async () => {
    if (!data) return
    setSaving(true); setSaved(false); setError('')
    try {
      const r = await api.patch('/system/organization', {
        org_name: data.org_name,
        portal_name: data.portal_name,
        org_short_name: data.org_short_name,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        timezone: data.timezone,
        locale: data.locale,
        date_format: data.date_format,
        footer_text: data.footer_text,
        support_email: data.support_email,
        allow_public_registration: data.allow_public_registration,
        archive_after_days: data.archive_after_days,
        audit_retention_days: data.audit_retention_days,
      })
      setData(r.data); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  const uploadLogo = async (file: File) => {
    setUploading(true)
    const form = new FormData()
    form.append('logo', file)
    try {
      const r = await api.post('/system/organization/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setData(prev => prev ? { ...prev, logo_url: r.data.logo_url } : prev)
    } catch { setError('Logo upload failed.') }
    finally { setUploading(false) }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  const set = (k: keyof OrgSettings, v: unknown) => setData(prev => prev ? { ...prev, [k]: v } : prev)

  return (
    <div>
      <SectionHeader title="Organization Settings" subtitle="Branding, regional settings, and portal behaviour." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Organization Name">
          <input className={INPUT} value={data.org_name} onChange={e => set('org_name', e.target.value)} />
        </Field>
        <Field label="Portal Name" hint="Displayed next to logo in the header (e.g. Research Review Portal)">
          <input className={INPUT} value={data.portal_name ?? ''} onChange={e => set('portal_name', e.target.value)} placeholder="Research Review Portal" />
        </Field>
        <Field label="Short Name / Abbreviation">
          <input className={INPUT} value={data.org_short_name ?? ''} onChange={e => set('org_short_name', e.target.value)} placeholder="e.g. CityU" />
        </Field>
        <Field label="Support Email">
          <input className={INPUT} type="email" value={data.support_email ?? ''} onChange={e => set('support_email', e.target.value)} />
        </Field>
        <Field label="Footer Text">
          <input className={INPUT} value={data.footer_text ?? ''} onChange={e => set('footer_text', e.target.value)} />
        </Field>
        <Field label="Primary Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={data.primary_color} onChange={e => set('primary_color', e.target.value)} className="w-10 h-10 rounded border border-gray-200 p-0.5 cursor-pointer" />
            <input className={INPUT} value={data.primary_color} onChange={e => set('primary_color', e.target.value)} />
          </div>
        </Field>
        <Field label="Accent Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={data.accent_color ?? '#6366f1'} onChange={e => set('accent_color', e.target.value)} className="w-10 h-10 rounded border border-gray-200 p-0.5 cursor-pointer" />
            <input className={INPUT} value={data.accent_color ?? ''} onChange={e => set('accent_color', e.target.value)} />
          </div>
        </Field>
        <Field label="Timezone">
          <select className={INPUT} value={data.timezone} onChange={e => set('timezone', e.target.value)}>
            {['UTC','Asia/Hong_Kong','Asia/Singapore','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Date Format">
          <select className={INPUT} value={data.date_format} onChange={e => set('date_format', e.target.value)}>
            {['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','DD-MMM-YYYY'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="Archive submissions after (days)" hint="Leave empty to never auto-archive.">
          <input className={INPUT} type="number" min={1} value={data.archive_after_days ?? ''} onChange={e => set('archive_after_days', e.target.value ? parseInt(e.target.value) : null)} />
        </Field>
        <Field label="Retain audit logs for (days)" hint="Leave empty to keep audit logs indefinitely.">
          <input className={INPUT} type="number" min={1} value={data.audit_retention_days ?? ''} onChange={e => set('audit_retention_days', e.target.value ? parseInt(e.target.value) : null)} />
        </Field>
        <Field label="Allow Public Registration">
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input type="checkbox" checked={data.allow_public_registration} onChange={e => set('allow_public_registration', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-600">Enable self-registration for students</span>
          </label>
        </Field>
      </div>

      {/* Logo upload */}
      <div className="mt-5">
        <p className="text-sm font-medium text-gray-700 mb-2">Organization Logo</p>
        <div className="flex items-center gap-4">
          {data.logo_url && <img src={data.logo_url} alt="Logo" className="h-12 w-auto border rounded object-contain p-1" />}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Logo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          <span className="text-xs text-gray-400">JPG, PNG, SVG, WebP · max 2 MB</span>
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} onSave={save} />
    </div>
  )
}

// ── Email Tab ─────────────────────────────────────────────────────────────────

function EmailTab() {
  const [data, setData] = useState<EmailSettings | null>(null)
  const [password, setPassword] = useState('')
  const [graphSecret, setGraphSecret] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testTo, setTestTo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { api.get('/system/email').then(r => setData(r.data)).catch(() => setError('Failed to load')) }, [])

  const save = async () => {
    if (!data) return
    setSaving(true); setSaved(false); setError('')
    try {
      const payload: Record<string, unknown> = {
        driver: data.driver, host: data.host, port: data.port,
        encryption: data.encryption, username: data.username,
        from_address: data.from_address, from_name: data.from_name,
        reply_to: data.reply_to, ses_region: data.ses_region,
        graph_tenant_id: data.graph_tenant_id, graph_client_id: data.graph_client_id,
      }
      if (password) payload['password_enc'] = password
      if (graphSecret) payload['graph_client_secret_enc'] = graphSecret
      const r = await api.patch('/system/email', payload)
      setData(r.data); setPassword(''); setGraphSecret(''); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  const test = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await api.post('/system/email/test', testTo ? { to: testTo } : {})
      setTestResult({ ok: true, msg: r.data.message })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Test failed.'
      setTestResult({ ok: false, msg })
    } finally { setTesting(false) }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  const set = (k: keyof EmailSettings, v: unknown) => setData(prev => prev ? { ...prev, [k]: v } : prev)

  return (
    <div>
      <SectionHeader title="Email Configuration" subtitle="Configure outbound mail delivery for notifications and invites." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {data.is_verified && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          <CheckCircle2 className="w-4 h-4" /> Email configuration verified — test was successful.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Driver">
          <select className={INPUT} value={data.driver} onChange={e => set('driver', e.target.value)}>
            <option value="log">Log (development only)</option>
            <option value="smtp">SMTP</option>
            <option value="ses">Amazon SES</option>
            <option value="graph">Microsoft 365 (Graph API)</option>
            <option value="sendmail">Sendmail</option>
          </select>
        </Field>
        <Field label="From Name">
          <input className={INPUT} value={data.from_name} onChange={e => set('from_name', e.target.value)} />
        </Field>
        <Field label="From Address">
          <input className={INPUT} type="email" value={data.from_address} onChange={e => set('from_address', e.target.value)} />
        </Field>
        <Field label="Reply-To">
          <input className={INPUT} type="email" value={data.reply_to ?? ''} onChange={e => set('reply_to', e.target.value)} />
        </Field>
      </div>

      {data.driver === 'smtp' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="SMTP Host">
            <input className={INPUT} value={data.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="smtp.example.com" />
          </Field>
          <Field label="Port">
            <input className={INPUT} type="number" value={data.port} onChange={e => set('port', parseInt(e.target.value) || 587)} />
          </Field>
          <Field label="Encryption">
            <select className={INPUT} value={data.encryption ?? ''} onChange={e => set('encryption', e.target.value)}>
              <option value="">None</option>
              <option value="tls">TLS (STARTTLS)</option>
              <option value="ssl">SSL</option>
            </select>
          </Field>
          <Field label="Username">
            <input className={INPUT} value={data.username ?? ''} onChange={e => set('username', e.target.value)} />
          </Field>
          <Field label="Password" hint={data.password_set ? 'Leave blank to keep existing password.' : ''}>
            <div className="relative">
              <input
                className={INPUT + ' pr-10'}
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={data.password_set ? '••••••••' : 'Enter password'}
              />
              <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
        </div>
      )}

      {data.driver === 'graph' && (
        <div className="mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Directory (Tenant) ID">
              <input className={INPUT} value={data.graph_tenant_id ?? ''} onChange={e => set('graph_tenant_id', e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <Field label="Application (Client) ID">
              <input className={INPUT} value={data.graph_client_id ?? ''} onChange={e => set('graph_client_id', e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <Field label="Client Secret" hint={data.graph_secret_set ? 'Leave blank to keep existing secret.' : 'Paste the secret Value (not the Secret ID).'}>
              <div className="relative">
                <input
                  className={INPUT + ' pr-10'}
                  type={showPwd ? 'text' : 'password'}
                  value={graphSecret}
                  onChange={e => setGraphSecret(e.target.value)}
                  placeholder={data.graph_secret_set ? '••••••••' : 'Enter client secret'}
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="text-blue-700">
              The app registration needs the <strong>application</strong> permission
              <code> Mail.Send</code> (admin-consented). The <strong>From Address</strong> above
              must be a licensed mailbox the app is permitted to send as.
            </p>
          </div>
        </div>
      )}

      {data.driver === 'ses' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="AWS Region">
            <input className={INPUT} value={data.ses_region ?? ''} onChange={e => set('ses_region', e.target.value)} placeholder="us-east-1" />
          </Field>
          <Field label="Access Key" hint={data.ses_key_set ? 'Leave blank to keep existing key.' : ''}>
            <input className={INPUT} placeholder={data.ses_key_set ? '[set — leave blank to keep]' : 'AKIA...'} />
          </Field>
          <Field label="Secret Key" hint={data.ses_secret_set ? 'Leave blank to keep existing secret.' : ''}>
            <input className={INPUT} type="password" placeholder={data.ses_secret_set ? '[set — leave blank to keep]' : 'Enter secret'} />
          </Field>
        </div>
      )}

      {/* Test send */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <p className="text-sm font-medium text-gray-700 mb-3">Send Test Email</p>
        <div className="flex gap-2">
          <input className={INPUT + ' flex-1'} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="recipient@example.com (leave blank = your account)" />
          <button onClick={test} disabled={testing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test
          </button>
        </div>
        {testResult && (
          <div className={`mt-2 flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {testResult.msg}
          </div>
        )}
      </div>

      <SaveBar saving={saving} saved={saved} onSave={save} />
    </div>
  )
}

// ── SSO Tab ───────────────────────────────────────────────────────────────────

type SsoEditing = {
  name: string; protocol: 'OIDC' | 'OAUTH2' | 'SAML2'; is_enabled: boolean; is_default: boolean;
  button_label: string | null; auto_provision_users: boolean; default_role: string;
  config: Record<string, string>;
}

const EMPTY_SSO: SsoEditing = {
  name: '', protocol: 'OIDC', is_enabled: false, is_default: false,
  button_label: '', auto_provision_users: true, default_role: 'student',
  config: { tenant_id: '', client_id: '', client_secret: '', scopes: 'openid email profile' },
}

function SsoTab() {
  const [providers, setProviders] = useState<SsoProvider[]>([])
  const [editing, setEditing] = useState<SsoEditing | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.get('/system/sso').then(r => setProviders(r.data.data)).catch(() => setError('Failed to load'))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    setSaving(true); setError('')
    try {
      if (editId) {
        await api.patch(`/system/sso/${editId}`, editing)
      } else {
        await api.post('/system/sso', editing)
      }
      await load(); setEditing(null); setEditId(null)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed.')
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this SSO provider?')) return
    await api.delete(`/system/sso/${id}`).catch(() => {})
    load()
  }

  const edit = (p: SsoProvider) => { setEditing({ ...p }); setEditId(p.id) }
  const add  = () => { setEditing({ ...EMPTY_SSO, config: { ...EMPTY_SSO.config } }); setEditId(null) }

  const setField = (k: string, v: unknown) => setEditing(prev => prev ? { ...prev, [k]: v } : prev)
  const setCfg   = (k: string, v: string)  => setEditing(prev => prev ? { ...prev, config: { ...prev.config, [k]: v } } : prev)

  return (
    <div>
      <SectionHeader title="SSO Providers" subtitle="Configure OIDC/OAuth2 providers for single sign-on." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

      {!editing && (
        <>
          <div className="space-y-3 mb-4">
            {providers.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No SSO providers configured.</p>}
            {providers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${p.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.protocol}{p.is_default ? ' · Default' : ''}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Callback: <code className="bg-gray-100 px-1 rounded font-mono select-all">{window.location.origin}/api/sso/{p.id}/callback</code>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => edit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={add} className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50">
            <Plus className="w-4 h-4" /> Add Provider
          </button>
          {providers.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Register the <strong>Callback URL</strong> shown on each provider above in your IdP application settings.
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-4">{editId ? 'Edit Provider' : 'New Provider'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Display Name">
              <input className={INPUT} value={editing.name} onChange={e => setField('name', e.target.value)} placeholder="Microsoft Entra" />
            </Field>
            <Field label="Protocol">
              <select className={INPUT} value={editing.protocol} onChange={e => setField('protocol', e.target.value)}>
                <option value="OIDC">OIDC</option>
                <option value="OAUTH2">OAuth2</option>
                <option value="SAML2">SAML2</option>
              </select>
            </Field>
            <Field label="Button Label">
              <input className={INPUT} value={editing.button_label ?? ''} onChange={e => setField('button_label', e.target.value)} placeholder="Sign in with Microsoft" />
            </Field>
            <Field label="Default Role for Auto-Provisioned Users">
              <select className={INPUT} value={editing.default_role} onChange={e => setField('default_role', e.target.value)}>
                <option value="student">Student</option>
                <option value="reviewer">Reviewer</option>
                <option value="coordinator">Coordinator</option>
              </select>
            </Field>
          </div>

          {(editing.protocol === 'OIDC' || editing.protocol === 'OAUTH2') && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tenant ID" hint="For Microsoft Entra: your tenant UUID or domain.">
                <input className={INPUT} value={editing.config.tenant_id ?? ''} onChange={e => setCfg('tenant_id', e.target.value)} placeholder="organizations or your-tenant.onmicrosoft.com" />
              </Field>
              <Field label="Client ID">
                <input className={INPUT} value={editing.config.client_id ?? ''} onChange={e => setCfg('client_id', e.target.value)} />
              </Field>
              <Field label="Client Secret" hint={editing.config.client_secret === '[set]' ? 'Leave blank to keep existing.' : ''}>
                <input className={INPUT} type="password"
                  value={editing.config.client_secret === '[set]' ? '' : editing.config.client_secret ?? ''}
                  onChange={e => setCfg('client_secret', e.target.value)}
                  placeholder={editing.config.client_secret === '[set]' ? '[set — leave blank to keep]' : ''}
                />
              </Field>
              <Field label="Scopes">
                <input className={INPUT} value={editing.config.scopes ?? 'openid email profile'} onChange={e => setCfg('scopes', e.target.value)} />
              </Field>
            </div>
          )}

          <div className="mt-4 flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.is_enabled} onChange={e => setField('is_enabled', e.target.checked)} className="w-4 h-4 rounded" />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.is_default} onChange={e => setField('is_default', e.target.checked)} className="w-4 h-4 rounded" />
              Default provider
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.auto_provision_users} onChange={e => setField('auto_provision_users', e.target.checked)} className="w-4 h-4 rounded" />
              Auto-provision new users
            </label>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            <button onClick={() => { setEditing(null); setEditId(null) }} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Security / Password Policy Tab ────────────────────────────────────────────

function SecurityTab() {
  const [data, setData] = useState<PasswordPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/system/password-policy').then(r => setData(r.data)).catch(() => setError('Failed to load')) }, [])

  const save = async () => {
    if (!data) return
    setSaving(true); setSaved(false); setError('')
    try {
      const r = await api.patch('/system/password-policy', data)
      setData(r.data); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      const msg = e?.response?.data?.message
        || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat()[0])
        || 'Save failed.'
      setError(msg as string)
    }
    finally { setSaving(false) }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  const set = (k: keyof PasswordPolicy, v: unknown) => setData(prev => prev ? { ...prev, [k]: v } : prev)

  const BoolRow = ({ k, label }: { k: keyof PasswordPolicy; label: string }) => (
    <label className="flex items-center justify-between py-3 border-b border-gray-100 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={data[k] as boolean} onChange={e => set(k, e.target.checked)} className="w-4 h-4 rounded" />
    </label>
  )

  const NumRow = ({ k, label, min, max }: { k: keyof PasswordPolicy; label: string; min?: number; max?: number }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <span className="text-sm text-gray-700">{label}</span>
      <input className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right" type="number" min={min} max={max}
        value={(data[k] as number | null) ?? ''} onChange={e => set(k, e.target.value ? parseInt(e.target.value) : null)} />
    </div>
  )

  return (
    <div>
      <SectionHeader title="Password & Security Policy" subtitle="Rules enforced on all password changes and new accounts." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      <div className="max-w-xl">
        <NumRow k="min_length"               label="Minimum password length"           min={8} max={128} />
        <BoolRow k="require_uppercase"        label="Require uppercase letter" />
        <BoolRow k="require_number"           label="Require number" />
        <BoolRow k="require_special"          label="Require special character" />
        <NumRow k="expiry_days"               label="Password expires after (days, blank = never)" min={0} />
        <NumRow k="history_count"             label="Prevent reuse of last N passwords" min={0} max={24} />
        <NumRow k="max_login_attempts"        label="Max failed login attempts before lockout" min={1} max={20} />
        <NumRow k="lockout_duration_minutes"  label="Lockout duration (minutes)" min={1} />
        <NumRow k="session_timeout_minutes"   label="Session timeout (minutes)" min={5} />
        <BoolRow k="require_2fa"              label="Require 2FA (coming soon)" />
      </div>
      <SaveBar saving={saving} saved={saved} onSave={save} />
    </div>
  )
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  SUBMISSION_RECEIVED: 'Submission Received',
  STAGE_ASSIGNED:      'Review Assignment',
  REVISION_REQUIRED:   'Revision Required',
  SUBMISSION_ACCEPTED: 'Submission Accepted',
  SUBMISSION_REJECTED: 'Submission Rejected',
  STAGE_OVERDUE:       'Review Overdue',
  APPEAL_SUBMITTED:    'Appeal Submitted',
}

function NotificationsTab() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [selected, setSelected] = useState<NotificationTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get('/system/notification-templates').then(r => setTemplates(r.data.data)).catch(() => setError('Failed to load')) }, [])

  const pick = (t: NotificationTemplate) => setSelected({ ...t })
  const setF  = (k: keyof NotificationTemplate, v: unknown) => setSelected(prev => prev ? { ...prev, [k]: v } : prev)

  const save = async () => {
    if (!selected) return
    setSaving(true); setSaved(false)
    try {
      const r = await api.patch(`/system/notification-templates/${selected.id}`, {
        subject: selected.subject, body_html: selected.body_html, body_text: selected.body_text, is_active: selected.is_active,
      })
      setTemplates(prev => prev.map(t => t.id === selected.id ? r.data : t))
      setSelected(r.data)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  return (
    <div className="flex gap-0 -mx-6 -mb-6 min-h-[480px]">
      {/* Left list */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 pt-1">
        {error && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
        {templates.map(t => (
          <button key={t.id} onClick={() => pick(t)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-center gap-2 hover:bg-gray-50 ${selected?.id === t.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-700 font-medium">{EVENT_LABELS[t.event_type] ?? t.event_type}</span>
          </button>
        ))}
      </div>

      {/* Right editor */}
      <div className="flex-1 px-6 py-4">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm">
            <Bell className="w-8 h-8 mb-2 text-gray-200" /> Select a template to edit
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{EVENT_LABELS[selected.event_type] ?? selected.event_type}</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.is_active} onChange={e => setF('is_active', e.target.checked)} className="w-4 h-4 rounded" />
                Active
              </label>
            </div>

            {/* Available variables */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Click to copy variable:</p>
              <div className="flex flex-wrap gap-1">
                {selected.variables.map(v => (
                  <code key={v} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 cursor-pointer hover:bg-gray-200"
                    onClick={() => navigator.clipboard.writeText(v)}>
                    {v}
                  </code>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Subject line">
                <input className={INPUT} value={selected.subject} onChange={e => setF('subject', e.target.value)} />
              </Field>
              <Field label="HTML Body" hint="Full HTML email body. Use variables above.">
                <textarea className={INPUT + ' h-36 font-mono text-xs'} value={selected.body_html} onChange={e => setF('body_html', e.target.value)} />
              </Field>
              <Field label="Plain Text Body" hint="Fallback for email clients that don't render HTML.">
                <textarea className={INPUT + ' h-20 font-mono text-xs'} value={selected.body_text} onChange={e => setF('body_text', e.target.value)} />
              </Field>
            </div>

            <SaveBar saving={saving} saved={saved} onSave={save} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Email Templates Tab (admin-managed, used inside workflow email stages) ────

interface AdminEmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  is_active: boolean
  updated_at: string | null
}

const BLANK_EMAIL_TEMPLATE: AdminEmailTemplate = {
  id: '', name: '', subject: '', body_html: '', body_text: '', is_active: true, updated_at: null,
}

function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([])
  const [variables, setVariables] = useState<string[]>([])
  const [selected, setSelected]   = useState<AdminEmailTemplate | null>(null)
  const [isNew, setIsNew]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.get('/admin/email-templates')
      .then(r => { setTemplates(r.data.data); setVariables(r.data.variables ?? []) })
      .catch(() => setError('Failed to load templates.'))
  }, [])

  const pickNew = () => { setSelected({ ...BLANK_EMAIL_TEMPLATE }); setIsNew(true); setError('') }
  const pick = (t: AdminEmailTemplate) => { setSelected({ ...t, body_text: t.body_text ?? '' }); setIsNew(false); setError('') }
  const setF = (k: keyof AdminEmailTemplate, v: unknown) => setSelected(prev => prev ? { ...prev, [k]: v } : prev)

  const save = async () => {
    if (!selected) return
    if (!selected.name.trim() || !selected.subject.trim() || !selected.body_html.trim()) {
      setError('Name, subject, and HTML body are required.'); return
    }
    setSaving(true); setSaved(false); setError('')
    const payload = {
      name: selected.name, subject: selected.subject, body_html: selected.body_html,
      body_text: selected.body_text || null, is_active: selected.is_active,
    }
    try {
      if (isNew) {
        const r = await api.post('/admin/email-templates', payload)
        setTemplates(prev => [...prev, r.data.data].sort((a, b) => a.name.localeCompare(b.name)))
        setSelected(r.data.data); setIsNew(false)
      } else {
        const r = await api.patch(`/admin/email-templates/${selected.id}`, payload)
        setTemplates(prev => prev.map(t => t.id === selected.id ? r.data.data : t))
        setSelected(r.data.data)
      }
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  const remove = async (t: AdminEmailTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/email-templates/${t.id}`)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
      if (selected?.id === t.id) { setSelected(null); setIsNew(false) }
    } catch { setError('Delete failed.') }
  }

  return (
    <div className="flex gap-0 -mx-6 -mb-6 min-h-[480px]">
      {/* Left list */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 pt-1">
        <div className="px-3 py-2 border-b border-gray-100">
          <button onClick={pickNew}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
        {error && !selected && <p className="text-xs text-red-600 px-3 py-2">{error}</p>}
        {templates.length === 0 && <p className="text-xs text-gray-400 italic px-4 py-3">No templates yet.</p>}
        {templates.map(t => (
          <div key={t.id}
            className={`group w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${selected?.id === t.id && !isNew ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
            <button onClick={() => pick(t)} className="flex items-center gap-2 flex-1 text-left min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-700 font-medium truncate">{t.name}</span>
            </button>
            <button onClick={() => remove(t)}
              className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Right editor */}
      <div className="flex-1 px-6 py-4">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm">
            <Send className="w-8 h-8 mb-2 text-gray-200" /> Select a template to edit, or create a new one.
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{isNew ? 'New email template' : selected.name}</h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.is_active} onChange={e => setF('is_active', e.target.checked)} className="w-4 h-4 rounded" />
                Released (visible in email stages)
              </label>
            </div>

            {/* Available variables */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Click to copy a variable:</p>
              <div className="flex flex-wrap gap-1">
                {variables.map(v => (
                  <code key={v} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 cursor-pointer hover:bg-gray-200"
                    onClick={() => navigator.clipboard.writeText(v)}>
                    {v}
                  </code>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

            <div className="space-y-4">
              <Field label="Template name" hint="Shown to the assigned person when choosing a template on an email stage.">
                <input className={INPUT} value={selected.name} onChange={e => setF('name', e.target.value)} />
              </Field>
              <Field label="Subject line">
                <input className={INPUT} value={selected.subject} onChange={e => setF('subject', e.target.value)} />
              </Field>
              <Field label="HTML Body" hint="Full HTML email body. Use variables above.">
                <textarea className={INPUT + ' h-40 font-mono text-xs'} value={selected.body_html} onChange={e => setF('body_html', e.target.value)} />
              </Field>
              <Field label="Plain Text Body" hint="Optional fallback for email clients that don't render HTML.">
                <textarea className={INPUT + ' h-20 font-mono text-xs'} value={selected.body_text ?? ''} onChange={e => setF('body_text', e.target.value)} />
              </Field>
            </div>

            <SaveBar saving={saving} saved={saved} onSave={save} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Feature Flags Tab ─────────────────────────────────────────────────────────

const FLAG_LABELS: Record<string, { label: string; hint: string }> = {
  sso_enabled:           { label: 'SSO Login Button',          hint: 'Show SSO sign-in button on the login screen.' },
  public_registration:   { label: 'Public Registration',       hint: 'Allow students to self-register.' },
  webhooks_enabled:      { label: 'Webhooks',                  hint: 'Send webhook events on submission state changes.' },
  allow_appeals:         { label: 'Appeal Requests',           hint: 'Allow authors to appeal rejected submissions.' },
  allow_meetings:        { label: 'Meeting Scheduling',        hint: 'Enable coordinator-scheduled review meetings.' },
  realtime_notifications:{ label: 'Real-Time Notifications',   hint: 'WebSocket push notifications (requires Reverb).' },
  reviewer_pool_enabled: { label: 'Reviewer Pool',             hint: 'Enable pool-based reviewer assignment.' },
  audit_log_enabled:     { label: 'Audit Logging',             hint: 'Log all system events to the audit trail.' },
  file_storage_s3:       { label: 'S3 File Storage',           hint: 'Store uploaded files in S3 instead of local disk.' },
}

function FlagsTab() {
  const [flags, setFlags] = useState<FeatureFlags>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved]   = useState<Record<string, boolean>>({})
  const [error, setError]   = useState('')

  useEffect(() => { api.get('/system/feature-flags').then(r => setFlags(r.data)).catch(() => setError('Failed to load')) }, [])

  const toggle = async (key: string) => {
    const newVal = !flags[key]
    setFlags(prev => ({ ...prev, [key]: newVal }))
    setSaving(prev => ({ ...prev, [key]: true }))
    try {
      await api.patch(`/system/feature-flags/${key}`, { value: newVal })
      setSaved(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000)
    } catch {
      setFlags(prev => ({ ...prev, [key]: !newVal })) // revert
      setError('Failed to update flag.')
    } finally { setSaving(prev => ({ ...prev, [key]: false })) }
  }

  return (
    <div>
      <SectionHeader title="Feature Flags" subtitle="Enable or disable portal features. Changes take effect immediately." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      <div className="space-y-1 max-w-2xl">
        {Object.entries(flags).map(([key, value]) => {
          const meta = FLAG_LABELS[key] ?? { label: key, hint: '' }
          return (
            <div key={key} className="flex items-center justify-between py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">{meta.label}</p>
                {meta.hint && <p className="text-xs text-gray-400 mt-0.5">{meta.hint}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {saved[key] && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                <button onClick={() => toggle(key)} disabled={saving[key]} className="disabled:opacity-50">
                  {value
                    ? <ToggleRight className="w-9 h-9 text-blue-600" />
                    : <ToggleLeft className="w-9 h-9 text-gray-300" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Settings Page ────────────────────────────────────────────────────────

// ── Review Settings Tab ───────────────────────────────────────────────────────

interface ReviewSettings {
  review_grace_period_days: number
  grace_period_consider_holidays: boolean
  grace_period_holidays_country: string
  max_extension_requests: number
  due_date_exclude_weekends: boolean
  due_date_consider_holidays: boolean
}

function ReviewTab() {
  const [data, setData] = useState<ReviewSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/system/organization').then(r => setData({
      review_grace_period_days:       r.data.review_grace_period_days ?? 0,
      grace_period_consider_holidays: r.data.grace_period_consider_holidays ?? false,
      grace_period_holidays_country:  r.data.grace_period_holidays_country ?? 'US',
      max_extension_requests:         r.data.max_extension_requests ?? 3,
      due_date_exclude_weekends:      r.data.due_date_exclude_weekends ?? false,
      due_date_consider_holidays:     r.data.due_date_consider_holidays ?? false,
    })).catch(() => setError('Failed to load review settings.'))
  }, [])

  const save = async () => {
    if (!data) return
    setSaving(true); setSaved(false); setError('')
    try {
      await api.patch('/system/organization', data)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  const set = (k: keyof ReviewSettings, v: unknown) => setData(prev => prev ? { ...prev, [k]: v } : prev)

  return (
    <div>
      <SectionHeader title="Review Deadline Settings" subtitle="Configure grace periods, public holiday handling, and extension limits." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex gap-2"><AlertCircle className="w-4 h-4 mt-0.5" />{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Grace Period (days)" hint="Days after deadline before escalation notifications are sent.">
          <input type="number" min={0} max={30} className={INPUT} value={data.review_grace_period_days}
            onChange={e => set('review_grace_period_days', parseInt(e.target.value) || 0)} />
        </Field>

        <Field label="Max Extension Requests" hint="Maximum number of extension requests a reviewer can submit.">
          <input type="number" min={0} max={20} className={INPUT} value={data.max_extension_requests}
            onChange={e => set('max_extension_requests', parseInt(e.target.value) || 0)} />
        </Field>

        <Field label="Country Code for Holidays" hint="2-5 letter country code used when skipping public holidays (e.g. US, GB, HK).">
          <input className={INPUT} value={data.grace_period_holidays_country} maxLength={5}
            onChange={e => set('grace_period_holidays_country', e.target.value.toUpperCase())} />
        </Field>

        <Field label="Consider Public Holidays in Grace Period">
          <button
            onClick={() => set('grace_period_consider_holidays', !data.grace_period_consider_holidays)}
            className="flex items-center gap-2 mt-1"
          >
            {data.grace_period_consider_holidays
              ? <ToggleRight className="w-8 h-8 text-blue-600" />
              : <ToggleLeft  className="w-8 h-8 text-gray-400" />}
            <span className="text-sm text-gray-700">
              {data.grace_period_consider_holidays ? 'Enabled — holidays are skipped' : 'Disabled — all days count'}
            </span>
          </button>
        </Field>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <SectionHeader
          title="Due Date Calculation"
          subtitle="Control whether weekends and public holidays are skipped when computing each stage's reviewer due date."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Exclude Weekends (Sat/Sun)" hint="When enabled, Saturdays and Sundays do not count toward a stage's due days.">
            <button
              onClick={() => set('due_date_exclude_weekends', !data.due_date_exclude_weekends)}
              className="flex items-center gap-2 mt-1"
            >
              {data.due_date_exclude_weekends
                ? <ToggleRight className="w-8 h-8 text-blue-600" />
                : <ToggleLeft  className="w-8 h-8 text-gray-400" />}
              <span className="text-sm text-gray-700">
                {data.due_date_exclude_weekends ? 'Enabled — weekends are skipped' : 'Disabled — all days count'}
              </span>
            </button>
          </Field>

          <Field label="Exclude Public Holidays" hint="When enabled, public holidays for the country code above are skipped when computing due dates.">
            <button
              onClick={() => set('due_date_consider_holidays', !data.due_date_consider_holidays)}
              className="flex items-center gap-2 mt-1"
            >
              {data.due_date_consider_holidays
                ? <ToggleRight className="w-8 h-8 text-blue-600" />
                : <ToggleLeft  className="w-8 h-8 text-gray-400" />}
              <span className="text-sm text-gray-700">
                {data.due_date_consider_holidays ? 'Enabled — holidays are skipped' : 'Disabled — all days count'}
              </span>
            </button>
          </Field>
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} onSave={save} />
    </div>
  )
}

// ── Integrations Tab ──────────────────────────────────────────────────────────

interface IntegrationCfg {
  key: string
  settings: Record<string, string>
  is_enabled: boolean
  updated_at: string | null
}

const INTEGRATION_KEYS = [
  { key: 'turnitin',    label: 'Turnitin',       desc: 'Plagiarism & similarity checking', fields: ['api_key', 'api_url', 'webhook_secret'] },
  { key: 's3_storage',  label: 'S3 Storage',     desc: 'Store submission files on S3/MinIO', fields: ['access_key', 'secret_key', 'region', 'bucket', 'endpoint'] },
  { key: 'azure_blob',  label: 'Azure Blob',     desc: 'Store submission files on Azure Blob Storage', fields: ['account_name', 'account_key', 'container', 'connection_string'] },
  { key: 's3_backup',   label: 'S3 Backup',      desc: 'Store database backups on S3/MinIO', fields: ['access_key', 'secret_key', 'region', 'bucket', 'endpoint'] },
  { key: 'azure_backup',label: 'Azure Backup',   desc: 'Store database backups on Azure', fields: ['account_name', 'account_key', 'container'] },
] as const

const SECRET_FIELDS = new Set(['api_key', 'secret_key', 'account_key', 'webhook_secret', 'connection_string'])

function IntegrationCard({ def, cfg, onSaved }: { def: typeof INTEGRATION_KEYS[number]; cfg: IntegrationCfg | null; onSaved: () => void }) {
  const [expanded, setExpanded]   = useState(false)
  const [enabled, setEnabled]     = useState(cfg?.is_enabled ?? false)
  const [fields, setFields]       = useState<Record<string, string>>(cfg?.settings ?? {})
  const [show, setShow]           = useState<Record<string, boolean>>({})
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    setEnabled(cfg?.is_enabled ?? false)
    setFields(cfg?.settings ?? {})
  }, [cfg])

  const save = async () => {
    setSaving(true); setSaved(false); setError('')
    try {
      await api.patch(`/system/integrations/${def.key}`, { is_enabled: enabled, settings: fields })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
      onSaved()
    } catch { setError('Save failed.') }
    finally { setSaving(false) }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(x => !x)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="font-medium text-sm text-gray-900">{def.label}</span>
          <span className="text-xs text-gray-400">{def.desc}</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}

          <div className="flex items-center gap-2">
            <button onClick={() => setEnabled(x => !x)} className="flex items-center gap-2">
              {enabled ? <ToggleRight className="w-7 h-7 text-blue-600" /> : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>
            <span className="text-sm text-gray-700">{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {def.fields.map(f => (
              <div key={f}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f.replace(/_/g, ' ')}</label>
                <div className="relative">
                  <input
                    type={SECRET_FIELDS.has(f) && !show[f] ? 'password' : 'text'}
                    className={INPUT + ' pr-9'}
                    value={fields[f] ?? ''}
                    placeholder={SECRET_FIELDS.has(f) && fields[f] ? '••••••••' : ''}
                    onChange={e => setFields(prev => ({ ...prev, [f]: e.target.value }))}
                  />
                  {SECRET_FIELDS.has(f) && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShow(prev => ({ ...prev, [f]: !prev[f] }))}
                    >
                      {show[f] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {saved && <span className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function IntegrationsTab() {
  const [cfgs, setCfgs] = useState<Record<string, IntegrationCfg>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/system/integrations')
      .then(r => {
        const map: Record<string, IntegrationCfg> = {}
        ;(r.data.data ?? r.data).forEach((c: IntegrationCfg) => { map[c.key] = c })
        setCfgs(map)
      })
      .catch(() => setError('Failed to load integrations.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div>
      <SectionHeader title="External Integrations" subtitle="Connect Turnitin, cloud storage, and backup providers." />
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>}
      {loading
        ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        : <div className="space-y-3">
            {INTEGRATION_KEYS.map(def => (
              <IntegrationCard key={def.key} def={def} cfg={cfgs[def.key] ?? null} onSaved={load} />
            ))}
          </div>
      }
    </div>
  )
}

// ── Archive Tab ───────────────────────────────────────────────────────────────

interface ArchiveEntry {
  id: string
  submission_id: string
  submission?: { id: string; title: string; reference_number: string; status: string }
  storage_type: string
  size_bytes: number
  archive_reason: string
  archived_by?: { id: string; name: string }
  restored_at: string | null
  created_at: string
}

function ArchiveTab() {
  const [entries, setEntries]     = useState<ArchiveEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [running, setRunning]     = useState(false)
  const [settings, setSettings]   = useState<{ archive_after_days: number; s3_enabled: boolean; azure_enabled: boolean } | null>(null)
  const [storageType, setStorage] = useState<'local' | 's3' | 'azure'>('local')
  const [error, setError]         = useState('')
  const [successMsg, setSuccess]  = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/system/archives'),
      api.get('/system/archives/settings'),
    ]).then(([ar, sr]) => {
      setEntries(ar.data.data ?? [])
      setSettings(sr.data)
    }).catch(() => setError('Failed to load archive data.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const runArchive = async () => {
    setRunning(true); setError(''); setSuccess('')
    try {
      const r = await api.post('/system/archives/run', { storage_type: storageType })
      setSuccess(r.data.message ?? `Archived ${r.data.archived_count} submission(s).`)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Archive run failed.')
    } finally { setRunning(false) }
  }

  const restore = async (id: string) => {
    try {
      await api.post(`/system/archives/${id}/restore`)
      setSuccess('Submission restored from archive.')
      load()
    } catch { setError('Restore failed.') }
  }

  function fmtBytes(bytes: number) {
    if (bytes < 1024)       return `${bytes} B`
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 ** 3)  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`
    return `${(bytes / (1024 ** 3)).toFixed(2)} GB`
  }

  return (
    <div>
      <SectionHeader title="Archive" subtitle="Archive old submissions to save space. Archived submissions can be restored." />
      {error      && <div className="mb-4 p-3 bg-red-50   border border-red-200   text-red-700   text-sm rounded-lg">{error}</div>}
      {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{successMsg}</div>}

      {settings && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          Submissions older than <strong>{settings.archive_after_days} days</strong> that are Accepted, Rejected, or Withdrawn are eligible for archiving.
          Configure this value in <strong>Organization Settings → Archive After Days</strong>.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-gray-600 font-medium">Storage:</label>
        {(['local', 's3', 'azure'] as const).map(s => (
          <label key={s} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" value={s} checked={storageType === s} onChange={() => setStorage(s)} className="accent-blue-600" />
            <span className="text-sm capitalize">{s === 's3' ? 'S3/MinIO' : s === 'azure' ? 'Azure Blob' : 'Local'}</span>
          </label>
        ))}
        <button
          onClick={runArchive}
          disabled={running}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-60"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          {running ? 'Archiving…' : 'Run Archive Now'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No archived submissions.</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Submission</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Storage</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Size</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Archived</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Restored</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{e.submission?.title ?? e.submission_id}</span>
                      {e.submission?.reference_number && (
                        <span className="text-xs text-gray-400 ml-2">{e.submission.reference_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize">{e.storage_type}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmtBytes(e.size_bytes)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{e.restored_at ? new Date(e.restored_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!e.restored_at && (
                        <button onClick={() => restore(e.id)}
                          className="flex items-center gap-1.5 ml-auto px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md">
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Updated Backup Tab ────────────────────────────────────────────────────────

interface BackupCatalogEntry {
  id: string
  filename: string
  storage_type: string
  size_bytes: number
  status: string
  checksum_sha256: string | null
  created_by?: { id: string; name: string }
  restored_at: string | null
  created_at: string
}

function BackupTabNew() {
  const [backups, setBackups]   = useState<BackupCatalogEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [running, setRunning]   = useState(false)
  const [storageType, setStorage] = useState<'local' | 's3' | 'azure'>('local')
  const [error, setError]       = useState('')
  const [successMsg, setSuccess] = useState('')

  // Encryption key state
  const [enc, setEnc] = useState<{ configured: boolean; key_hint: string | null; algorithm: string } | null>(null)
  const [encBusy, setEncBusy] = useState(false)
  const [newKey, setNewKey]   = useState<string | null>(null)   // shown once after generate/rotate
  const [keyCopied, setKeyCopied] = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/system/backups')
      .then(r => setBackups(r.data.data ?? []))
      .catch(() => setError('Failed to load backups.'))
      .finally(() => setLoading(false))
  }

  const loadEnc = () => {
    api.get('/system/backups/encryption')
      .then(r => setEnc(r.data))
      .catch(() => setEnc(null))
  }

  useEffect(() => { load(); loadEnc() }, [])

  const configureKey = async (rotate: boolean) => {
    if (rotate && !window.confirm(
      'Rotate the encryption key?\n\nExisting backups can ONLY be restored with the previous key. Make sure you have it saved before continuing.'
    )) return
    setEncBusy(true); setError(''); setSuccess(''); setNewKey(null); setKeyCopied(false)
    try {
      const r = await api.post('/system/backups/encryption', {})
      setNewKey(r.data.key)
      loadEnc()
    } catch { setError('Could not configure the encryption key.') }
    finally { setEncBusy(false) }
  }

  const copyKey = async () => {
    if (!newKey) return
    try { await navigator.clipboard.writeText(newKey); setKeyCopied(true) } catch { /* ignore */ }
  }

  const runBackup = async () => {
    setRunning(true); setError(''); setSuccess('')
    try {
      await api.post('/system/backups', { storage_type: storageType })
      setSuccess('Backup completed successfully.')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Backup failed. Check server logs.')
    }
    finally { setRunning(false) }
  }

  const restore = async (id: string) => {
    if (!window.confirm('Restore this backup? This will overwrite the current database and uploaded documents. The configured encryption key is required to decrypt it.')) return
    setError(''); setSuccess('')
    try {
      await api.post(`/system/backups/${id}/restore`)
      setSuccess('Restored successfully from backup.')
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Restore failed.') }
  }

  const download = async (b: BackupCatalogEntry) => {
    setError('')
    try {
      const res = await api.get(`/system/backups/${b.id}/download`, { responseType: 'blob' })
      const ct = (res.headers['content-type'] as string) || ''
      // Remote storage (S3/Azure) returns a JSON body with a presigned URL.
      if (ct.includes('application/json')) {
        const text = await (res.data as Blob).text()
        const url = JSON.parse(text)?.download_url
        if (url) window.open(url, '_blank')
        else setError('Could not generate a download link.')
        return
      }
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = b.filename; a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed.')
    }
  }

  const deleteBackup = async (id: string) => {
    if (!window.confirm('Delete this backup permanently?')) return
    try {
      await api.delete(`/system/backups/${id}`)
      load()
    } catch { setError('Delete failed.') }
  }

  function fmtBytes(bytes: number) {
    if (bytes < 1024)       return `${bytes} B`
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 ** 3)  return `${(bytes / (1024 ** 2)).toFixed(1)} MB`
    return `${(bytes / (1024 ** 3)).toFixed(2)} GB`
  }

  const encReady = enc?.configured ?? false

  return (
    <div>
      <SectionHeader
        title="Database Backups"
        subtitle="Encrypted backups include the database, uploaded documents, and application configuration. The encryption key is required to restore a backup on this or any other instance."
      />
      {error      && <div className="mb-4 p-3 bg-red-50   border border-red-200   text-red-700   text-sm rounded-lg">{error}</div>}
      {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{successMsg}</div>}

      {/* ── Encryption key card ── */}
      <div className="mb-6 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${encReady ? 'bg-green-50' : 'bg-amber-50'}`}>
            {encReady ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <Key className="w-5 h-5 text-amber-600" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Backup Encryption</p>
            {encReady ? (
              <p className="text-sm text-gray-500 mt-0.5">
                Enabled · AES-256 · key <span className="font-mono">{enc?.key_hint}</span>
              </p>
            ) : (
              <p className="text-sm text-amber-700 mt-0.5">
                No encryption key configured. A key must be set before backups can run.
              </p>
            )}
          </div>
          <button
            onClick={() => configureKey(encReady)}
            disabled={encBusy}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {encBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {encReady ? 'Rotate key' : 'Generate key'}
          </button>
        </div>

        {/* Newly generated key — shown once */}
        {newKey && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800">Save this key now — it will not be shown again</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Store it somewhere safe and separate from the backups. You need it to restore backups on this or another instance. Losing it makes existing encrypted backups unrecoverable.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 px-2 py-1.5 bg-white border border-blue-200 rounded text-xs font-mono break-all">{newKey}</code>
                  <button
                    onClick={copyKey}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-300 rounded hover:bg-blue-100 shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" /> {keyCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm text-gray-600 font-medium">Storage:</label>
        {(['local', 's3', 'azure'] as const).map(s => (
          <label key={s} className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" value={s} checked={storageType === s} onChange={() => setStorage(s)} className="accent-blue-600" />
            <span className="text-sm capitalize">{s === 's3' ? 'S3/MinIO' : s === 'azure' ? 'Azure Backup' : 'Local'}</span>
          </label>
        ))}
        <span className="text-xs text-gray-400 ml-2">{backups.length} backup{backups.length !== 1 ? 's' : ''}</span>
        <button
          onClick={runBackup}
          disabled={running || !encReady}
          title={!encReady ? 'Configure an encryption key first' : undefined}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
          {running ? 'Running…' : 'Run Backup Now'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No backups found.</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Filename</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Storage</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Size</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Created</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {backups.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{b.filename}</td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize">{b.storage_type}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{fmtBytes(b.size_bytes)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        b.status === 'completed' ? 'bg-green-100 text-green-700' :
                        b.status === 'failed'    ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => download(b)} title="Download"
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => restore(b.id)} title="Restore"
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteBackup(b.id)} title="Delete"
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Research Templates Tab (admin-only) ───────────────────────────────────────

interface ResearchTemplateItem {
  id: string
  name: string
  description: string | null
  filename: string
  size_bytes: number
  submission_types?: { id: string; label: string; slug: string }[]
}

function rtFmtBytes(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`
}

export function ResearchTemplatesTab() {
  const [templates, setTemplates] = useState<ResearchTemplateItem[]>([])
  const [types, setTypes] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Attach modal
  const [attachTarget, setAttachTarget] = useState<ResearchTemplateItem | null>(null)
  const [attachIds, setAttachIds] = useState<string[]>([])
  const [savingAttach, setSavingAttach] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [tplRes, typeRes] = await Promise.all([
        api.get('/admin/research-templates'),
        api.get('/admin/submission-types', { params: { all: true } }),
      ])
      setTemplates(tplRes.data.data ?? [])
      setTypes((typeRes.data.data ?? []).map((t: { id: string; label: string }) => ({ id: t.id, label: t.label })))
    } catch {
      setError('Failed to load templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const upload = async () => {
    setError('')
    if (!name.trim()) { setError('Template name is required.'); return }
    if (!file) { setError('Please choose a file to upload.'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      if (description.trim()) fd.append('description', description.trim())
      fd.append('file', file)
      await api.post('/admin/research-templates', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setName(''); setDescription(''); setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = async (t: ResearchTemplateItem) => {
    try {
      const res = await api.get(`/research-templates/${t.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = t.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed.')
    }
  }

  const removeTemplate = async (t: ResearchTemplateItem) => {
    if (!window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/research-templates/${t.id}`)
      await load()
    } catch {
      setError('Delete failed.')
    }
  }

  const openAttach = (t: ResearchTemplateItem) => {
    setAttachTarget(t)
    setAttachIds((t.submission_types ?? []).map((s) => s.id))
  }

  const toggleAttach = (id: string) => {
    setAttachIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const saveAttach = async () => {
    if (!attachTarget) return
    setSavingAttach(true)
    try {
      await api.put(`/admin/research-templates/${attachTarget.id}/submission-types`, {
        submission_type_ids: attachIds,
      })
      setAttachTarget(null)
      await load()
    } catch {
      setError('Failed to update assignments.')
    } finally {
      setSavingAttach(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Upload form */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload a template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Template name">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Conference Paper Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </Field>
          <Field label="File" hint="PDF, Word, Excel, PowerPoint, TXT, RTF, ODT or ZIP (max 50 MB)">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt,.zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </Field>
        </div>
        <Field label="Description" hint="Optional — shown to researchers alongside the template.">
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder="Brief note about what this template is for…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <div className="flex justify-end mt-2">
          <button
            onClick={upload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Template
          </button>
        </div>
      </div>

      {/* Templates list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-10 border border-dashed border-gray-200 rounded-xl">
          No templates uploaded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 truncate">{t.filename} · {rtFmtBytes(t.size_bytes)}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {(t.submission_types ?? []).length === 0 ? (
                      <span className="text-xs text-amber-600">Not assigned to any category</span>
                    ) : (
                      (t.submission_types ?? []).map((s) => (
                        <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                          {s.label}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openAttach(t)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    title="Assign to categories"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Assign
                  </button>
                  <button
                    onClick={() => downloadTemplate(t)}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeTemplate(t)}
                    className="p-1.5 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign modal */}
      {attachTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Assign “{attachTarget.name}” to categories</h3>
              <button onClick={() => setAttachTarget(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              {types.length === 0 ? (
                <p className="text-sm text-gray-500">No submission categories exist yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {types.map((ty) => (
                    <label key={ty.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachIds.includes(ty.id)}
                        onChange={() => toggleAttach(ty.id)}
                      />
                      <span className="text-sm text-gray-800">{ty.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
              <button onClick={() => setAttachTarget(null)} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={saveAttach}
                disabled={savingAttach}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {savingAttach ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('org')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">Organization settings, email, SSO, and feature management.</p>
      </div>

      <div className="flex gap-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-56 flex-shrink-0 border-r border-gray-200 py-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {tab === id && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </nav>

        {/* Content panel */}
        <div className={`flex-1 overflow-auto ${tab === 'notifications' || tab === 'email_templates' ? '' : 'p-6'}`}>
          {tab === 'org'           && <OrgTab />}
          {tab === 'email'         && <EmailTab />}
          {tab === 'sso'           && <SsoTab />}
          {tab === 'security'      && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'email_templates' && <EmailTemplatesTab />}
          {tab === 'flags'         && <FlagsTab />}
          {tab === 'review'        && <ReviewTab />}
          {tab === 'integrations'  && <IntegrationsTab />}
          {tab === 'backup'        && <BackupTabNew />}
          {tab === 'archive'       && <ArchiveTab />}
        </div>
      </div>
    </div>
  )
}

