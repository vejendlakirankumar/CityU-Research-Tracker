export interface PublicOrgInfo {
  org_name: string
  portal_name: string
  org_short_name: string | null
  logo_url: string | null
  primary_color: string
  sso_enabled: boolean
}

export interface OrganizationSetting {
  id: number
  org_name: string
  portal_name: string
  org_short_name: string | null
  logo_path: string | null
  favicon_path: string | null
  primary_color: string
  accent_color: string | null
  timezone: string
  locale: string
  date_format: string
  footer_text: string | null
  support_email: string | null
  allow_public_registration: boolean
  archive_after_days: number | null
  max_file_size_mb_global: number
}
