# Operations Manual — CityU Research Review Portal

> **Version:** 2.0
> **Last updated:** March 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Environment Reference](#2-environment-reference)
3. [Routine Maintenance](#3-routine-maintenance)
4. [Backup & Recovery](#4-backup--recovery)
5. [User & Role Management](#5-user--role-management)
6. [REST API Reference](#6-rest-api-reference)
7. [Configuration Reference](#7-configuration-reference)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Troubleshooting](#9-troubleshooting)
10. [Security Hardening](#10-security-hardening)

---

## 1. System Overview

### Architecture

```
Browser  ──HTTPS──►  Apache 2.4
                         │
                     WordPress 6.7 (PHP 8.1)
                         │
                     Plugin: research-review-portal/
                         ├── research-review-portal.php   ← plugin bootstrap, CSP, SPA mount
                         ├── assets/portal.js             ← SPA (IIFE, vanilla JS)
                         ├── assets/portal.css
                         ├── includes/
                         │   ├── class-portal-rest.php    ← all REST endpoints (~2,900 lines)
                         │   ├── class-portal-data.php    ← JSON read/write with file locking
                         │   ├── class-user-management.php
                         │   ├── class-auth-provider.php  ← Entra ID OAuth2
                         │   └── class-process-documentation.php
                         └── data/
                             ├── config.json
                             ├── submissions.json
                             ├── reviewers.json
                             └── uploads/<submission-id>/
```

### Data storage

| Data | Storage | Location |
|------|---------|----------|
| Submissions, stages, decisions, audit logs | JSON file | `data/submissions.json` |
| Reviewer pool, expertise, assignment counts | JSON file | `data/reviewers.json` |
| Workflow config, upload settings, SMTP, SSO | JSON file | `data/config.json` |
| Uploaded documents | File system | `data/uploads/<id>/` |
| User accounts, roles, meta | MySQL | `wp_users`, `wp_usermeta` |
| WordPress settings | MySQL | `wp_options` |

### Technology stack

| Component | Version |
|-----------|---------|
| WordPress | 6.7 |
| PHP | 8.1 |
| Apache | 2.4 |
| MySQL | 8.0 |
| ClamAV | 1.4.3 |
| mammoth.js | 1.7.0 (DOCX viewer) |

---

## 2. Environment Reference

### Production (Azure VM)

| Item | Value |
|------|-------|
| Host | `portal.your-institution.edu` |
| OS | Ubuntu 22.04 LTS |
| SSH user | `<vm-user>` |
| Plugin path | `/var/www/html/wp-content/plugins/research-review-portal` |
| Apache config | `/etc/apache2/sites-available/000-default.conf` |
| PHP config drop-in | `/etc/php/8.1/apache2/conf.d/99-rrp.ini` |
| Log | `/var/log/apache2/error.log` |
| SSL cert | Let's Encrypt (auto-renewing) |

### Development (Docker)

| Item | Value |
|------|-------|
| Portal URL | `http://localhost:8080` |
| WP Admin | `admin` / `Admin1234!` |
| MySQL | `mysql:8.0` container |
| PHP | `wordpress:6.7-php8.1-apache` |

### PHP settings required

| Setting | Value | Reason |
|---------|-------|--------|
| `upload_max_filesize` | `64M` | Large document uploads |
| `post_max_size` | `64M` | Must be ≥ upload limit |
| `memory_limit` | `256M` | DOCX-to-HTML parsing (mammoth.js) |
| `max_execution_time` | `60` | Analytics and export calls |

---

## 3. Routine Maintenance

### Weekly

- [ ] Check Apache error log for PHP warnings: `sudo tail -100 /var/log/apache2/error.log`
- [ ] Review **Overdue** tab in coordinator dashboard; follow up with coordinators
- [ ] Verify health endpoint: `curl -sf https://portal.your-institution.edu/wp-json/research-portal/v1/health`

### Monthly

- [ ] Export MySQL database: `make db-export` (Docker) or `wp --path=/var/www/html --allow-root db export /tmp/rrp-$(date +%Y%m%d).sql`
- [ ] Commit JSON data files to git: `git add data/ && git commit -m "Monthly backup $(date +%Y-%m-%d)"`
- [ ] Review disk usage in `data/uploads/`: `du -sh data/uploads/`
- [ ] Archive old terminal submissions via **Administration → Data Archive** (submissions > 90 days old)
- [ ] Update ClamAV virus definitions: `sudo freshclam`

### As needed

- [ ] After any plugin file change, flush rewrite rules: `wp --path=/var/www/html --allow-root rewrite flush`
- [ ] After WordPress core updates, verify health endpoint still returns `{"ok":true}`
- [ ] Rotate SMTP credentials in **Portal Settings → Email / SMTP** if email provider credentials change
- [ ] Renew Let's Encrypt certificate (runs automatically; test with `sudo certbot renew --dry-run`)

---

## 4. Backup & Recovery

### What to back up

| Component | Method | Frequency |
|-----------|--------|-----------|
| `data/submissions.json` | git commit or file copy | Daily |
| `data/reviewers.json` | git commit | On change |
| `data/config.json` | git commit | On change |
| `data/uploads/` | rsync / zip | Weekly |
| MySQL database | `make db-export` / `wp db export` | Daily |

### Using the built-in Backup & Restore UI

The easiest way to back up is the portal's own backup feature:

1. Log in as Admin → **Administration → Backup & Restore**.
2. Click **Download Backup**. A ZIP is downloaded containing all JSON data files and all uploaded documents.
3. Store the ZIP in a safe location (external storage, cloud backup).

To restore:
1. Log in as Admin → **Administration → Backup & Restore**.
2. Click **Choose File**, select the ZIP backup, and click **Restore**. The portal unpacks the ZIP and replaces the data files. ZipSlip protection is enforced.

> The restore operation does not restore WordPress user accounts. User accounts are stored in MySQL and must be backed up separately using `make db-export`.

### Manual backup (command line)

```bash
# Export MySQL
wp --path=/var/www/html --allow-root db export /tmp/rrp-db-$(date +%Y%m%d).sql

# Archive uploads
tar -czf /tmp/rrp-uploads-$(date +%Y%m%d).tar.gz \
  /var/www/html/wp-content/plugins/research-review-portal/data/uploads/

# Copy DB dump to local machine (run from dev machine)
scp <vm-user>@portal.your-institution.edu:/tmp/rrp-db-*.sql ./data/
```

### Recovery (bare-metal)

```bash
# 1. Run install script on fresh server
./scripts/install-wsl.sh

# 2. Restore MySQL
wp --path=/var/www/html --allow-root db import /path/to/rrp-db-backup.sql

# 3. Restore uploads
tar -xzf /path/to/rrp-uploads-backup.tar.gz -C /

# 4. Fix permissions
sudo chown -R www-data:www-data \
  /var/www/html/wp-content/plugins/research-review-portal/data

# 5. Update URL if server hostname changed
./scripts/set-public-url.sh https://new-hostname.example.com
```

### Recovery (Docker)

```bash
git clone <repo> && cd CityU-Research-Tracker
cp .env.example .env    # set WP_URL
make up
make init
make db-import           # restores data/rrp-db-export.sql
# JSON data is already present from the cloned repo
```

---

## 5. User & Role Management

### Plugin roles

The plugin registers five roles on activation:

| Slug | Capability | Scope |
|------|-----------|-------|
| `rrp_student` | `rrp_submit` | Own submissions only |
| `rrp_reviewer` | `rrp_review` | Assigned submissions |
| `rrp_coordinator` | `rrp_coordinate` | All submissions, workflow management |
| `rrp_admin` | `rrp_administrate` | Full system access |
| `rrp_faculty` | `rrp_faculty_submit` | Extended student access |

Custom roles can be added via **Administration → Roles** in the portal UI, or via the `POST /admin/roles` REST endpoint.

### Re-registering roles

If roles disappear after a database import:

```bash
wp plugin deactivate research-review-portal --allow-root
wp plugin activate  research-review-portal --allow-root
```

### Change a user's role

```bash
wp user set-role <user-id-or-email> rrp_coordinator --allow-root
```

Or via **WP Admin → Users → Edit User → Role**.

### Reset a user's password

```bash
wp user update <user-id> --user_pass='NewPass123!' --allow-root
```

Or via the portal Users panel (Admin role) — click the password icon on any user row.

---

## 6. REST API Reference

**Base URL:** `{site_url}/wp-json/research-portal/v1`

All authenticated endpoints require `X-WP-Nonce: <nonce>` (provided automatically by the SPA via `window.RRP.nonce`). The nonce is created with `wp_create_nonce('wp_rest')` and refreshed on each page load.

### Core endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | `{"ok":true,"bootId":<int>}` |
| GET | `/config` | Admin | Full system configuration |
| PUT | `/config` | Admin | Update system configuration |
| GET | `/public-config` | None | Public-facing config (portal name, SSO enabled, public submissions toggle) |

### Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/submit` | Logged-in | Create a new submission |
| GET | `/submissions` | Logged-in | List submissions visible to current user |
| GET | `/submissions/{id}` | Logged-in | Get single submission |
| PUT | `/submissions/{id}` | Coordinator+ | Update metadata or status |
| GET | `/submissions/{id}/preview` | Logged-in | Stream uploaded file for in-browser preview |
| POST | `/submissions/{id}/feedback` | Reviewer | Submit reviewer decision |
| GET | `/submissions/{id}/comments` | Logged-in | Get comments |
| POST | `/submissions/{id}/comments` | Logged-in | Post a comment |
| POST | `/submissions/{id}/attachments` | Reviewer | Upload reviewer attachment |
| DELETE | `/submissions/{id}/attachments/{file}` | Admin | Delete an attachment |
| GET | `/submissions/{id}/timeline` | Logged-in | Full stage timeline |
| GET | `/submissions/{id}/audit-log` | Coordinator+ | Detailed audit log |
| POST | `/submissions/{id}/skip-stage` | Coordinator | Skip active review stage |
| GET/PUT | `/submissions/{id}/deadlines` | Coordinator | Get or set per-stage deadlines |
| PATCH | `/submissions/{id}` | Submitter/Coordinator | Withdraw or cancel |
| POST | `/submissions/{id}/appeal` | Submitter | Submit a rejection appeal |
| PATCH | `/submissions/{id}/appeal` | Coordinator | Process an appeal (start_review/uphold/overturn) |
| GET/PUT | `/submissions/{id}/collab` | Reviewer | Read or update collaborative stage notes |
| GET | `/submissions/inactive` | Coordinator | List inactive submissions (query: `?days=30`) |
| POST | `/submissions/bulk-cancel` | Coordinator | Bulk cancel up to 100 submissions |

### Reviews & Assignments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/reviews` | Reviewer+ | Reviews assigned to current user |
| GET | `/reviewers` | Coordinator+ | All reviewers in pool |
| GET | `/assignment-summary` | Coordinator+ | Per-submission stage + reviewer summary |
| POST | `/reviews/rate` | Coordinator+ | Submit reviewer quality rating |
| GET | `/conflicts` | Coordinator+ | All declared COIs |
| POST | `/conflicts` | Reviewer | Declare a COI |

### Analytics & Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/workflow` | Coordinator+ | Stage completion rates and durations |
| GET | `/analytics/performance` | Coordinator+ | Submission volume by type and date |
| GET | `/analytics/reviewer` | Coordinator+ | Per-reviewer metrics |
| GET | `/analytics/workload` | Coordinator+ | Active workload distribution |
| GET | `/analytics/daily` | Coordinator+ | Daily submission and decision counts |
| GET | `/analytics/overdue` | Coordinator+ | All overdue submissions |
| GET | `/reports/export` | Admin | Export as CSV |
| GET | `/calendar-events` | Logged-in | Active-stage deadlines for calendar view |

### Notifications & Preferences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Logged-in | Unread notifications |
| GET/PUT | `/notif-prefs` | Logged-in | Read or update notification preferences |

### Portal Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/PUT | `/portal-users/me` | Logged-in | Current user profile |
| GET | `/portal-users` | Admin | List all users |
| POST | `/portal-users` | Admin | Create a user |
| GET/PUT/DELETE | `/portal-users/{id}` | Admin | Get, update, or delete a user |
| POST | `/portal-users/{id}/reset-password` | Admin | Reset user password |

### Submission Types & Workflow

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/submission-types` | Logged-in | List submission types |
| POST | `/submission-types` | Admin | Create a submission type |
| GET/PUT | `/submission-types/{id}` | Admin | Get or update a submission type |
| GET/PUT | `/workflow-stages/{id}` | Admin | Get or update a workflow stage |
| DELETE | `/workflow-stages/{id}` | Admin | Delete a workflow stage |

### Extension Requests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/submissions/{id}/extension-request` | Reviewer | Request a deadline extension |
| GET | `/extension-requests` | Coordinator+ | All pending extension requests |
| PATCH | `/extension-requests/{id}` | Coordinator | Approve or deny an extension |

### Administration

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/backup` | Admin | Download ZIP backup of all data |
| POST | `/admin/restore` | Admin | Restore from ZIP backup |
| POST | `/admin/archive-submissions` | Admin | Archive terminal submissions older than N days |
| GET | `/admin/archives` | Admin | List data archives |
| GET | `/admin/archives/{name}/download` | Admin | Download an archive |
| DELETE | `/admin/archives/{name}` | Admin | Delete an archive |
| GET/POST | `/admin/roles` | Admin | List or create custom roles |
| DELETE | `/admin/roles/{slug}` | Admin | Delete a custom role |
| GET | `/admin/webhooks` | Admin | List registered webhooks |
| POST | `/admin/webhooks` | Admin | Register a webhook |
| DELETE | `/admin/webhooks/{id}` | Admin | Delete a webhook |
| POST | `/communications/broadcast` | Coordinator | Send bulk email |
| POST | `/plagiarism/check/{id}` | Coordinator | Trigger similarity check |
| POST | `/settings/test-email` | Admin | Test SMTP configuration |
| GET | `/config/suggest-reviewers` | Coordinator+ | Expertise-based reviewer suggestions |
| POST | `/config/apply-pool-to-submissions` | Admin | Bulk-apply reviewer pool |
| GET/POST | `/config/review-templates` | Admin | Manage review question templates |

---

## 7. Configuration Reference

`data/config.json` is the primary configuration file. It is read at PHP runtime and can be updated via the portal's **Administration → Portal Settings** panel or directly on disk (restart Apache after direct edits).

### Key top-level keys

```jsonc
{
  // Days per stage before a submission is marked overdue
  "stageDueDays": { "ARS": 7, "PUB": 10, "GRN": 14, "PROJ": 7 },

  // Reviewer pool per submission type
  "reviewerPools": {
    "ARS": { "reviewerIds": [3, 5, 8], "assignmentMode": "round_robin" }
  },

  // Required approvals per stage
  "stageRequirements": {
    "ARS": { "Committee Review": { "requiredCount": 3 }, "default": { "requiredCount": 1 } }
  },

  // Notification reply-to address
  "notificationEmail": "research-portal@cityu.edu",

  // File upload constraints (set via Portal Settings)
  "uploadSettings": {
    "maxFileSizeMb": 2,
    "maxFiles": 5,
    "allowedExtensions": ["pdf", "docx"]
  },

  // SMTP settings (password is AES-256-GCM encrypted)
  "smtpSettings": { "host": "...", "port": 587, "encryption": "tls", ... },

  // Entra SSO settings
  "ssoSettings": { "enabled": false, "tenantId": "...", "clientId": "...", ... },

  // Deadline management
  "gracePeriodDays": 2,
  "skipWeekends": true,
  "publicHolidays": ["2026-01-01", "2026-12-25"],

  // Public submission portal
  "publicPortal": { "enabled": false, "allowedTypes": ["PROJ"] },

  // Plagiarism provider
  "plagiarismProvider": { "provider": "disabled", "apiKey": "" }
}
```

### `data/reviewers.json` structure

```jsonc
[
  {
    "id": "RVW-001",
    "userId": 5,
    "email": "reviewer@test.com",
    "name": "Dr. Jane Smith",
    "department": "Computer Science",
    "expertise": ["machine learning", "computer vision"],
    "submissionTypes": ["ARS", "PUB"],
    "activeAssignments": 2,
    "completedReviews": 14
  }
]
```

### `data/submissions.json` structure (abridged)

```jsonc
[
  {
    "id": "ARS-2026-001",
    "type": "ARS",
    "title": "...",
    "abstract": "...",
    "keywords": ["..."],
    "submitterId": 12,
    "submitterEmail": "student@test.com",
    "status": "Under Review",
    "revisionCount": 0,
    "revisionHistory": [],
    "createdAt": "2026-01-15T09:00:00Z",
    "updatedAt": "2026-02-03T14:22:00Z",
    "stages": [
      {
        "stageName": "Chair Review",
        "assignedReviewers": [{ "email": "reviewer@test.com", "deadline": "2026-01-22T09:00:00Z" }],
        "decisions": { "reviewer@test.com": "Approved" },
        "skipped": false,
        "completedAt": "2026-01-20T11:00:00Z"
      }
    ],
    "collabData": { "stageNotes": {}, "presence": {} },
    "auditLog": [
      {
        "timestamp": "2026-01-15T09:00:00Z",
        "actor": "student@test.com",
        "action": "Submitted",
        "detail": "Initial submission"
      }
    ],
    "documents": [
      { "filename": "dissertation-draft.pdf", "uploadedAt": "2026-01-15T09:00:00Z" }
    ]
  }
]
```

---

## 8. Monitoring & Alerting

### Health check endpoint

Use `/wp-json/research-portal/v1/health` for automated monitoring:

```bash
curl -sf https://portal.your-institution.edu/wp-json/research-portal/v1/health
# Returns HTTP 200 + {"ok":true,"bootId":<int>} when healthy
```

Add this to Azure Monitor, UptimeRobot, or any uptime monitoring tool with a 5-minute interval. Alert on non-200 responses or JSON missing `"ok":true`.

### Log locations

| Environment | Log |
|-------------|-----|
| Docker | `make logs` (streams container stdout/stderr) |
| Bare-metal Apache | `/var/log/apache2/error.log` |
| Bare-metal PHP | `/var/log/apache2/php_errors.log` (if configured) |
| WordPress debug | `wp-content/debug.log` (only when `WP_DEBUG_LOG = true`) |

### Enabling WordPress debug logging (development only)

Add to `wp-config.php`:

```php
define( 'WP_DEBUG',         true  );
define( 'WP_DEBUG_LOG',     true  );
define( 'WP_DEBUG_DISPLAY', false );   // never enable on production
```

### Scheduled tasks (WP-Cron)

The plugin registers two daily WP-Cron jobs:

| Hook | Schedule | Action |
|------|----------|--------|
| `rrp_deadline_reminders` | Daily | Emails reviewers 3 days before their stage deadline |
| `rrp_escalation_check` | Daily | Emails coordinators with all overdue submissions |

Verify cron is running:
```bash
wp --path=/var/www/html --allow-root cron event list | grep rrp_
```

Manually trigger escalation check:
```bash
wp --path=/var/www/html --allow-root cron event run rrp_escalation_check
```

---

## 9. Troubleshooting

### Portal shows blank page or "Portal API not configured"

1. Verify the plugin is active:
   ```bash
   wp plugin list --allow-root | grep research
   ```
2. Check that WordPress permalinks are set to **Post name**:
   ```bash
   wp rewrite structure '/%postname%/' --allow-root
   wp rewrite flush --allow-root
   ```
3. Verify Apache `mod_rewrite` is enabled:
   ```bash
   sudo a2enmod rewrite && sudo service apache2 restart
   ```

### REST API returns 401 Unauthorized

1. Hard-refresh the browser (`Ctrl+Shift+R`).
2. Log out and log back in to get a fresh nonce.
3. Check `WP_SITEURL` / `WP_HOME` in `wp-config.php` match the URL being used:
   ```bash
   grep -i 'WP_HOME\|WP_SITEURL' /var/www/html/wp-config.php
   ```

### File uploads fail silently

1. Check `data/uploads/` is writable by `www-data`:
   ```bash
   ls -la /var/www/html/wp-content/plugins/research-review-portal/data/
   sudo chown -R www-data:www-data .../data && sudo chmod -R 775 .../data
   ```
2. Verify PHP upload limits:
   ```bash
   php -r "echo ini_get('upload_max_filesize');"   # should be 64M
   ```
3. Check ClamAV is running:
   ```bash
   clamscan --version
   ```

### Submissions not persisting (JSON write errors)

```bash
# Check write permission
ls -la /var/www/html/wp-content/plugins/research-review-portal/data/

# Fix
sudo chown -R www-data:www-data \
  /var/www/html/wp-content/plugins/research-review-portal/data
```

### Email notifications not delivering

1. Check SMTP settings in **Portal Settings → Email / SMTP**.
2. Click **Test Email** — if it fails, check the SMTP credentials and port.
3. Verify no firewall blocks outbound port 465/587:
   ```bash
   nc -zv smtp.your-provider.com 587
   ```

### User roles missing from WP Admin "Add User" dropdown

Role registration runs on `register_activation_hook`. If roles are absent:

```bash
wp plugin deactivate research-review-portal --allow-root
wp plugin activate  research-review-portal --allow-root
```

### ClamAV daemon not running

```bash
sudo service clamav-freshclam start
sudo service clamav-daemon start
clamscan --version   # verify
```

### Docker: database connection refused on startup

MySQL takes a few seconds to initialise. If containers start in the wrong order:

```bash
make down && make up
# Wait 30 seconds
make init
```

### HTTPS certificate expired

```bash
sudo certbot renew
sudo service apache2 reload
```

---

## 10. Security Hardening

### Content Security Policy

The plugin sets a strict CSP header on all pages:

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
  style-src   'self' 'unsafe-inline';
  font-src    'self' https://cdnjs.cloudflare.com;
  img-src     'self' data:;
  frame-src   'self' blob:;
  connect-src 'self';
```

Do **not** add `cdn.jsdelivr.net` or other CDNs unless you also update the plugin's CSP header in `research-review-portal.php`.

### WordPress hardening checklist

- [ ] Change `admin` / `Admin1234!` default credentials immediately after installation
- [ ] Set `WP_DEBUG_DISPLAY = false` in `wp-config.php` on production
- [ ] Use a strong, unique `AUTH_KEY`, `SECURE_AUTH_KEY`, and related salts in `wp-config.php` (generate at [api.wordpress.org/secret-key/1.1/salt/](https://api.wordpress.org/secret-key/1.1/salt/))
- [ ] Restrict `data/` directory so it is not web-accessible (the plugin's `.htaccess` drop-in does this; verify with `curl https://host/.../data/config.json` — should return 403)
- [ ] Enable HTTPS and ensure HTTP redirects to HTTPS
- [ ] Keep WordPress core and plugins updated
- [ ] Limit login attempts (install a bruteforce-protection plugin such as **Limit Login Attempts Reloaded**)

### Data directory `.htaccess` protection

The plugin writes a `.htaccess` file in `data/` on activation:

```apache
Options -Indexes
Deny from all
```

This prevents direct web access to JSON files and uploaded documents. Verify it is present:

```bash
cat /var/www/html/wp-content/plugins/research-review-portal/data/.htaccess
```

### SMTP password encryption

SMTP credentials in `config.json` are stored AES-256-GCM encrypted. The encryption key is derived from `AUTH_KEY` in `wp-config.php`. Keep `wp-config.php` outside the web root or restrict its permissions:

```bash
chmod 600 /var/www/html/wp-config.php
```

### Upload security

Every uploaded file goes through:
1. **Extension whitelist** — only configured extensions are accepted
2. **MIME-type verification** — `finfo_file()` checks the actual file content
3. **ClamAV scan** — full virus scan before the file is stored
4. **Filename sanitisation** — special characters stripped from stored filename

Files are stored outside the web root and served via a PHP proxy endpoint — direct file URLs are never exposed to users.
