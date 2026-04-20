# v2 — System Configuration Specification

This document covers all application-level configuration: organization branding, authentication (SSO), email delivery, security policies, backup/archive, and feature flags.

---

## 1. Configuration Architecture

### 1.1 Two-Tier Config Model

Configuration is split into two tiers:

| Tier | Location | Who manages it | Examples |
|---|---|---|---|
| **Infrastructure credentials** | Environment variables | Ops/DevOps at deploy time | `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD` |
| **Application settings** | Database tables | Admin at runtime via UI | SMTP config, branding, SSO providers, password policy |

The `.env` file exists **only in local development**. In all production targets, credentials are injected as environment variables by the host platform (see [01-architecture.md §5](01-architecture.md#5-deployment-topology)).

---

### 1.2 Environment Variables (Credentials)

These are the only values that live outside the database. They must be set before the application starts and are never stored in the DB.

| Variable | Required | Notes |
|---|---|---|
| `APP_KEY` | Yes | 32-byte base64 random key; `php artisan key:generate`; used for `Crypt::encryptString()` |
| `APP_ENV` | Yes | `production` \| `local` |
| `APP_URL` | Yes | Base URL, e.g. `https://portal.university.edu` |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | No | Default: `5432` |
| `DB_DATABASE` | Yes | Database name |
| `DB_USERNAME` | Yes | Must be `rrp_app` (limited-privilege role; see data model security section) |
| `DB_PASSWORD` | Yes | Never committed to any file |
| `DB_SSLMODE` | No | `require` in production (enforces TLS to PostgreSQL) |
| `REDIS_HOST` | Yes | Redis host |
| `REDIS_PASSWORD` | No | Required if Redis has auth enabled |
| `REDIS_PORT` | No | Default: `6379` |
| `QUEUE_CONNECTION` | No | `redis` (default) \| `database` \| `sqs` |
| `FILESYSTEM_DISK` | No | `local` (default) \| `azure` \| `s3` |
| `LOG_CHANNEL` | No | `stack` (default) \| `stderr` (Docker/cloud) |
| `APP_DEBUG` | No | Must be `false` in production |

**Platform-specific credential injection:**

| Deployment target | Mechanism | Details in |
|---|---|---|
| Linux VM | systemd `EnvironmentFile=/etc/rrp/secrets.env` (chmod 600) | [architecture §5.2](01-architecture.md) |
| Docker | Docker Secrets + entrypoint.sh OR `env_file:` | [architecture §5.3](01-architecture.md) |
| Azure App Service | Configuration → Application Settings | [architecture §5.4](01-architecture.md) |
| AWS Beanstalk / Heroku / Render | Platform env var management | [architecture §5.4](01-architecture.md) |

---

### 1.3 Application Settings (Database)

Everything else is configured by the admin at runtime. No server restart required.

| Table | Purpose |
|---|---|
| `organization_settings` | Branding, locale, retention policy |
| `sso_providers` | SAML2 / OIDC provider configs |
| `email_settings` | SMTP / SES / Mailgun / Postmark driver |
| `notification_templates` | Email subject + body per event type |
| `password_policy` | Complexity, expiry, lockout, 2FA |
| `feature_flags` | Runtime on/off toggles |
| `config_overrides` | Scope-specific overrides (per submission type or stage) |

Sensitive values in these tables (SMTP passwords, SSO secrets, webhook signing keys) are stored encrypted with `Crypt::encryptString()` using `APP_KEY`. They are decrypted in memory at runtime and never returned raw in API responses.

---

### 1.4 Config Scope Hierarchy

Some settings can be overridden at finer granularity using `config_overrides`. Resolution order (most specific first):

```
Stage-level override      (config_overrides WHERE scope='stage')
  └▶ SubmissionType-level  (config_overrides WHERE scope='submission_type')
       └▶ Global            (organization_settings)
            └▶ App default  (seeded constant in code)
```

Currently scope-overridable keys:

| Key | Type | Notes |
|---|---|---|
| `max_file_size_mb` | int | Override per submission type or stage |
| `due_days` | int | Stage deadline override per stage or type |
| `allowed_extensions` | string[] | e.g. `["pdf","docx","xlsx"]` |

New scope-overridable keys can be added by inserting a row into `config_overrides` — no schema change required.

---

## 2. Organization Settings

### 2.1 Branding Fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `org_name` | string | "Research Review Portal" | Shown in page title, emails, header |
| `org_short_name` | string | null | Used in breadcrumbs, compact displays |
| `logo_path` | string | null | Relative path; served at `/storage/logo` |
| `favicon_path` | string | null | Relative path; served at `/storage/favicon` |
| `primary_color` | hex string | `#1E40AF` | Applied as CSS custom property `--color-brand` |
| `footer_text` | text | null | Shown in email footers and app footer |
| `support_email` | email | null | Shown in "contact support" links |

**Logo upload rules:**
- Accepted: PNG, SVG, WEBP, JPG
- Max size: 2 MB
- Stored in `storage/app/public/org/`
- Old logo file deleted on replacement
- Logo served publicly (no auth required)

### 2.2 Regional Settings

| Field | Type | Default | Notes |
|---|---|---|---|
| `timezone` | tz string | `UTC` | All timestamps displayed in this TZ to users |
| `locale` | locale string | `en` | UI language (i18n via Laravel + React i18next) |
| `date_format` | format string | `YYYY-MM-DD` | Applied to all date displays |

Supported locales (Phase 1): `en`, `zh-HK`, `zh-CN`

### 2.3 Data Retention

| Field | Default | Notes |
|---|---|---|
| `archive_after_days` | 365 | Submissions with ACCEPTED/REJECTED status become read-only after N days |
| `max_file_size_mb_global` | 10 | System-wide ceiling; submission type `max_file_size_mb` cannot exceed this |

---

## 3. Single Sign-On (SSO)

### 3.1 Supported Protocols

| Protocol | Use case |
|---|---|
| **SAML 2.0** | University IdP (Microsoft ADFS, Shibboleth, Azure AD, etc.) |
| **OIDC** | Modern IdP (Microsoft Entra ID, Google Workspace, Auth0, Keycloak) |
| **OAuth 2.0** | Legacy OAuth without OIDC discovery |

### 3.2 SAML 2.0 Configuration

```
SP Entity ID:     https://{app_url}/sso/saml/metadata
ACS URL:          https://{app_url}/sso/saml/{provider_id}/callback
SLO URL:          https://{app_url}/sso/saml/{provider_id}/logout
SP Metadata URL:  https://{app_url}/sso/saml/{provider_id}/metadata
```

Required IdP config fields:
- `entity_id` — SP entity ID to register with IdP
- `sso_url` — IdP SSO endpoint (HTTP POST binding)
- `slo_url` — IdP SLO endpoint (optional; enables single logout)
- `idp_certificate` — IdP signing certificate (PEM format)
- `want_assertions_signed` — boolean (recommended: true)

Attribute mapping (maps IdP SAML attributes to user fields):
```json
{
  "email": "urn:oid:1.2.840.113549.1.9.1",
  "name": "urn:oid:2.5.4.3",
  "first_name": "urn:oid:2.5.4.42",
  "last_name": "urn:oid:2.5.4.4",
  "roles": "memberOf"
}
```

Role mapping from IdP groups (optional):
```json
{
  "role_mapping": {
    "CN=Researchers,OU=Groups,DC=university,DC=edu": "reviewer",
    "CN=Students,OU=Groups,DC=university,DC=edu": "student",
    "CN=AdminStaff,OU=Groups,DC=university,DC=edu": "coordinator"
  }
}
```
If not configured, all SSO users are assigned `default_role`.

### 3.3 OIDC Configuration

Required fields:
- `issuer` — OIDC issuer URL (metadata auto-discovered at `{issuer}/.well-known/openid-configuration`)
- `client_id`
- `client_secret_enc` — stored encrypted with `Crypt::encryptString()`
- `scopes` — e.g., `["openid", "email", "profile"]`

Claim mapping:
```json
{
  "email": "email",
  "name": "name",
  "roles": "groups"
}
```

### 3.4 Auto-Provisioning

When `auto_provision_users = true`:
1. On first SSO login, if no user exists with the matched email → create user
2. Assign `default_role`
3. If `role_mapping` is configured and IdP provides group claims → apply mapped roles
4. On subsequent logins → update `name` from IdP claim (email never changes after creation)

When `auto_provision_users = false`:
- User must already exist in the database with the same email
- SSO login fails with "Account not found" if email is unknown

### 3.5 Coexistence with Local Auth

Both SSO and local password login can be active simultaneously. The login page shows:
- If SSO provider has `is_default = true` → redirect immediately to IdP
- Otherwise → show login page with SSO button(s) + email/password form
- Feature flag `disable_local_auth` can force SSO-only (local login hidden)

---

## 4. Email Configuration

### 4.1 Supported Drivers

| Driver | Config required | Notes |
|---|---|---|
| `smtp` | host, port, encryption, username, password | Most universal |
| `ses` | AWS access key, secret, region | Recommended for high volume |
| `mailgun` | domain, secret | |
| `postmark` | token | |
| `log` | none | Dev only — writes to Laravel log, never sends |

### 4.2 SMTP Security

- Port 587 + TLS (STARTTLS) — recommended
- Port 465 + SSL — supported
- Port 25 — supported but not recommended (often blocked)

### 4.3 Email Testing

`POST /system/email/test` sends a test email to the requesting admin's address. Response:
```json
{ "success": true, "message": "Test email sent to admin@university.edu" }
```
On success, sets `email_settings.is_verified = true`. Any subsequent change to SMTP settings resets `is_verified = false`.

### 4.4 Notification Templates

All email content is stored in `notification_templates`. Templates use Blade-syntax-compatible variables:

| Variable | Value |
|---|---|
| `{{org_name}}` | `organization_settings.org_name` |
| `{{portal_url}}` | App base URL |
| `{{submitter_name}}` | Submission owner's name |
| `{{submission_title}}` | Submission title |
| `{{submission_type}}` | Submission type label |
| `{{stage_name}}` | Stage `stage_role_label` |
| `{{decision}}` | The decision label (human-readable) |
| `{{feedback}}` | Decision comments / release feedback |
| `{{due_date}}` | Stage due date, formatted per org locale |
| `{{reviewer_name}}` | Assigned reviewer name |

All templates have both `body_html` (rich) and `body_text` (plain) versions. The `from_name` header is always `organization_settings.org_name` unless overridden.

---

## 5. Security Configuration

### 5.1 Encryption Algorithms

| Use | Algorithm | Notes |
|---|---|---|
| Passwords | bcrypt (cost 12) | Laravel `Hash::make()` — per-password salt |
| Sanctum tokens | SHA-256 | Hashed before DB storage; plaintext shown once |
| Sensitive config values | AES-256-CBC | Laravel `Crypt::encryptString()` using `APP_KEY` |
| `APP_KEY` | Random 256-bit base64 | `php artisan key:generate`; rotatable |
| Database transport | TLS 1.2+ | `sslmode=require` in production |
| API transport | TLS 1.2+ | Enforced at Nginx level |
| Uploaded files | chmod 640, outside webroot | Azure Blob: private ACL |

### 5.2 Password Policy

Configured in `password_policy` table. Enforced on:
- New user creation
- Password change (`PATCH /auth/password`)
- Admin reset (`PATCH /users/{id}`)
- SSO auto-provisioned users do not need a local password

| Field | Default | Enforced behavior |
|---|---|---|
| `min_length` | 12 | Validation error if shorter |
| `require_uppercase` | true | Must contain at least one uppercase letter |
| `require_number` | true | Must contain at least one digit |
| `require_special` | true | Must contain `!@#$%^&*()_+-=` etc. |
| `expiry_days` | null | If set, forced password change at next login after N days |
| `history_count` | 5 | Cannot reuse last 5 passwords (hashes stored in `password_history` table) |

### 5.3 Account Lockout

| Field | Default | Notes |
|---|---|---|
| `max_login_attempts` | 5 | Tracked per `{email}+{IP}` key in Redis |
| `lockout_duration_minutes` | 15 | Account unlocks automatically after duration |

Admin can manually unlock a user via `POST /users/{id}/unlock`.

### 5.4 Session Management

| Field | Default | Notes |
|---|---|---|
| `session_timeout_minutes` | 480 (8h) | Sanctum token expires if no activity |
| Cookie flags | `httpOnly=true`, `SameSite=Strict`, `Secure=true` | Applied to Sanctum session cookie |

### 5.5 Two-Factor Authentication (TOTP)

When `require_2fa = true`:
1. After password auth, user is redirected to 2FA challenge screen
2. User enters 6-digit TOTP code from authenticator app (Google Authenticator, 1Password, etc.)
3. On first 2FA setup: show QR code + 8 recovery codes
4. Recovery codes are one-time-use; stored as bcrypt hashes

Implementation: `pragmarx/google2fa-laravel` package.

### 5.6 APP_KEY Rotation

Command: `php artisan settings:rekey --new-key={base64_key}`

Steps performed:
1. Load current `APP_KEY` from `.env`
2. Decrypt all `*_enc` fields in `email_settings` and `sso_providers`
3. Write new key to `.env` and reload
4. Re-encrypt all fields with new key
5. Invalidate all existing Sanctum tokens (force re-login)

---

## 6. Backup & Archive

### 6.1 Database Backup

Scheduled via `php artisan backup:run` (spatie/laravel-backup) or cron.

| Schedule | Action |
|---|---|
| Daily 02:00 UTC | Database dump (pg_dump) → gzip → store in `storage/backups/` |
| Weekly Sunday 03:00 UTC | Full archive: database + uploaded files → zip |

Retention: configurable via `organization_settings.backup_retention_days` (default: 90).

Backup destinations supported:
- **Local filesystem** — `storage/backups/` (Linux VM and Docker with bind-mounted volume)
- **Azure Blob Storage** — set `FILESYSTEM_DISK=azure` + Azure Blob env vars in platform config
- **Amazon S3** — set `FILESYSTEM_DISK=s3` + `AWS_*` env vars in platform config

The `FILESYSTEM_DISK` env var selects the destination driver. On cloud platforms where local storage is ephemeral (e.g. Azure App Service), always configure an external destination.

### 6.2 On-Demand Backup

`POST /system/backup` triggers an immediate backup job. Returns `job_id` for polling.
`GET /system/backup/status/{job_id}` returns `{ "status": "running|completed|failed", "path": "..." }`.

### 6.3 Archive Policy

When `organization_settings.archive_after_days` days have passed since a submission reached `ACCEPTED`, `CONDITIONALLY_ACCEPTED`, or `REJECTED` status:

1. `ArchivedSubmissionJob` (scheduled daily) finds eligible submissions
2. Sets `submissions.is_locked = true`
3. All write endpoints return `422` for locked submissions
4. Files remain accessible for download
5. Audit log entry created: `'submission_archived'`

Archived submissions are visible in All Submissions with a `[ARCHIVED]` badge. They cannot be appealed, reopened, or modified.

### 6.4 Data Export

`GET /admin/submissions?format=csv` streams a CSV of all visible submissions (filtered by query params). Includes: title, type, submitter, program, status, version, submission date, completion date.

---

## 7. Public Registration & Co-Authors

### 7.1 Public Registration

When `enable_public_registration` is `true`, the `/auth/register` endpoint becomes publicly accessible (no existing session required). This allows anyone with the portal URL to create an account and submit.

**Required pre-configuration before enabling:**

| Setting | Location | Notes |
|---|---|---|
| `public_submission_default_group_id` | `organization_settings` | Group that public registrants join automatically |
| `public_submission_default_role` | `organization_settings` | Role assigned (default: `student`) |

**Registration flow:**
1. User visits `/register` on the portal frontend
2. Submits name, email, password (must pass password policy)
3. Account is created with `roles = [public_submission_default_role]`
4. User is auto-added to `user_groups` for `public_submission_default_group_id` with `role = 'member'`
5. Welcome email sent (`public_registration` notification template)
6. User is immediately authenticated and can create submissions

**Security notes:**
- Rate-limited: max 5 registration attempts per IP per 15 minutes
- Email address must be unique
- If `disable_local_auth` is `true`, public registration is also disabled (SSO handles identity)

### 7.2 Co-Authors

When `enable_co_authors` is `true`, submitters can attach additional authors to their submission via the `submission_authors` table (see [02-data-model.md §submission_authors](02-data-model.md)).

**Adding a registered co-author:**
- Submitter searches by name or email within the portal
- User must already exist with an active account
- `submission_authors` row created immediately with `user_id` set
- Co-author receives `co_author_added` notification with link to submission
- Co-author can view the submission (read-only) and receives all reviewer feedback notifications

**Inviting an unregistered co-author:**
- Submitter enters the co-author's email address
- System checks — if email not found in `users` → invitation path
- `submission_authors` row created with `invited_email` and `invite_token` (72h expiry)
- Invitation email sent (`co_author_invited` template) with a link to `/register?invite=<token>`
- When the invitee registers using the token:
  - Their new account is linked to the `submission_authors` row (`user_id` populated, token cleared)
  - Submitter receives `co_author_registered` notification
  - New user is added to the `public_submission_default_group_id` group (same as public registration)

**Reviewer feedback visibility:**
- When a `review_decisions.comments` is recorded for a stage visible to the submitter, notifications are sent to **all** `submission_authors` where `user_id IS NOT NULL` (not just the submitter)
- When a `gated_releases` record is issued, feedback is likewise sent to all registered authors
- Reviewer identities remain hidden per the stage's `is_anonymous` and `visibility_config` settings — co-authors see only the feedback text, not who wrote it

**Submitter identity and blind review:**
- The submitter's name is not exposed to reviewers (`is_blind_review` remains unchanged)
- Co-author names are also not exposed to reviewers by default
- `stage_definitions.visibility_config.feedback_visible_to` determines feedback delivery; authors follow the same visibility rules as the submitter

---

## 8. Feature Flags

All flags are in the `feature_flags` table, togglable at runtime from the admin panel.

| Key | Default | Description |
|---|---|---|
| `enable_appeals` | true | Students can appeal REJECTED submissions |
| `enable_meetings` | true | Meeting scheduling per submission |
| `enable_sso` | false | Show SSO login buttons; requires at least one enabled SSO provider |
| `disable_local_auth` | false | Hide email/password login (SSO-only mode) |
| `enable_2fa` | false | Require TOTP 2FA for all users |
| `enable_2fa_admin_only` | false | Require 2FA only for admin and coordinator roles |
| `enable_dark_mode` | true | Users can toggle dark mode |
| `enable_csv_export` | true | Admin CSV export button visible |
| `enable_reviewer_self_assign` | false | Reviewers can self-assign to unassigned stages |
| `enable_public_registration` | false | Allow users to register without admin invite. When enabled, `organization_settings.public_submission_default_group_id` and `public_submission_default_role` must be configured. Self-registered users are auto-assigned to that group and role. |
| `enable_co_authors` | true | Submitters may add co-authors to their submissions; reviewer feedback notifications are sent to all authors |
| `enable_analytics` | true | Analytics dashboard visible |
| `maintenance_mode` | false | Show maintenance page to non-admin users |

---

## 8. Initial Setup Checklist

After first deployment, an admin must complete the following steps:

**Pre-deployment (ops):**
1. **Credentials** — Inject `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD` via platform mechanism (systemd EnvironmentFile / Docker secrets / platform env vars). Never in code.
2. **Database** — Create `rrp_app` and `rrp_readonly` PostgreSQL roles with appropriate permissions (see data model security section)
3. **Run migrations** — `php artisan migrate --seed` (creates tables, seeds defaults)

**Post-deployment (admin in UI):**

4. **Organization** — Set org name, logo, primary color, timezone
5. **Email** — Configure SMTP or cloud driver; send test email to verify
6. **SSO** (optional) — Configure IdP; test connection; set `enable_sso` feature flag
7. **Password Policy** — Review and adjust for institutional requirements
8. **Notification Templates** — Review default templates; edit `{{org_name}}` references; review `co_author_invited` and `co_author_added` templates
9. **Submission Types** — Create types matching the institution's research programs
10. **Workflow Definitions** — Build stage workflows using templates or from scratch; validate DAG
11. **Reviewer Pools** — Add reviewers to pools per submission type
12. **Groups** (optional) — Create department/faculty groups; assign users to groups
13. **Programs** — Add programs/departments; assign program directors; link to groups
14. **Users** — Invite initial admin, coordinator, and reviewer users
15. **Webhooks** (optional) — Register external endpoints for event notifications
16. **Public Registration** (optional) — If open/public submissions are required: create a target group (e.g. "Public Submitters"), set `organization_settings.public_submission_default_group_id` to that group and `public_submission_default_role` to `student`, then enable the `enable_public_registration` feature flag. The `/auth/register` endpoint will become publicly accessible.
