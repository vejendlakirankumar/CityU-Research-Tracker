# Deployment Guide — CityU Research Review Portal

> **Current production:** Azure VM `portal.your-institution.edu` — Ubuntu 22.04, Apache 2.4, PHP 8.1, MySQL 8.0, WordPress 6.7

---

## Table of Contents

1. [Option A — Docker (Recommended for Dev/Staging)](#1-option-a--docker-recommended-for-devstaging)
2. [Option B — Bare-metal / Azure VM (Production)](#2-option-b--bare-metal--azure-vm-production)
3. [Database Schema & Initialization](#3-database-schema--initialization)
4. [WordPress Roles & Capabilities](#4-wordpress-roles--capabilities)
5. [Updating an Existing Install](#5-updating-an-existing-install)
6. [Enabling HTTPS (Let's Encrypt)](#6-enabling-https-lets-encrypt)
7. [Microsoft Entra ID SSO Setup](#7-microsoft-entra-id-sso-setup)
8. [Portal Settings Reference](#8-portal-settings-reference)
9. [Security-Hardened Defaults](#9-security-hardened-defaults)
10. [Post-Deploy Verification Checklist](#10-post-deploy-verification-checklist)
11. [Default Credentials](#11-default-credentials)
12. [Environment Variables Reference](#12-environment-variables-reference)

---

## 1. Option A — Docker (Recommended for Dev/Staging)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Repository cloned to your local machine

### 1.1 First-time setup

```bash
# 1. Create your .env file
cp .env.example .env
# Edit .env — set WP_URL to your server's URL (leave as http://localhost:8080 for local dev)

# 2. Build and start containers
make up

# 3. Install WordPress + activate plugin (first time only)
make init
```

### 1.2 Access the portal

| URL | Purpose |
|-----|---------|
| `http://localhost:8080` | Portal front page |
| `http://localhost:8080/wp-admin` | WordPress admin |

Default credentials after `make init`: `admin` / `Admin1234!`

### 1.3 Create test users

Run `make shell` to open a bash session inside the WordPress container, then:

```bash
wp user create student student@test.com --role=rrp_student --user_pass=test123 --allow-root
wp user create reviewer reviewer@test.com --role=rrp_reviewer --user_pass=test123 --allow-root
wp user create coordinator coord@test.com --role=rrp_coordinator --user_pass=test123 --allow-root
wp user create rrpadmin admin@test.com --role=rrp_admin --user_pass=test123 --allow-root
```

### 1.4 Day-to-day commands

| Command | Description |
|---------|-------------|
| `make up` | Start containers |
| `make down` | Stop containers (data preserved) |
| `make logs` | Tail Apache / PHP error log |
| `make shell` | Bash inside WordPress container |
| `make build` | Rebuild image after Dockerfile changes |
| `make db-export` | Export MySQL → `data/rrp-db-export.sql` |
| `make db-import` | Import `data/rrp-db-export.sql` |
| `make reset` | ⚠ Destroy all volumes and start fresh |

### 1.5 Deploying to a remote server via Docker

1. Clone the repo on the remote server.
2. Create `.env` with `WP_URL=http://your-server.example.com` and `WP_PORT=80`.
3. Run `make up && make init`.
4. (Optional) restore previous data: `make db-import` after copying `data/rrp-db-export.sql`.

> The `data/` folder (submissions, reviewers, config, uploads) is bind-mounted from the repo — no additional import step is needed for JSON data.

---

## 2. Option B — Bare-metal / Azure VM (Production)

Use this when Docker is not available.

### 2.1 Prerequisites
- Ubuntu 22.04 LTS
- Sudo access
- Repository cloned at any local path

### 2.2 Installation

```bash
# Optional: set the public URL (defaults to http://localhost)
export WP_URL="https://portal.your-institution.edu"

# Run the install script
chmod +x scripts/install-wsl.sh
./scripts/install-wsl.sh
```

The script installs Apache, PHP 8.1, MySQL, WordPress, activates the plugin, sets up pretty permalinks, and fixes data directory permissions.

### 2.3 Start services on boot

```bash
sudo service apache2 start
sudo service mysql start
```

Or enable systemd:
```bash
sudo systemctl enable apache2 mysql
```

### 2.4 Change the public URL on an existing install

```bash
export NEW_URL="https://new-hostname.example.com"
./scripts/set-public-url.sh "$NEW_URL"
```

This updates both the WordPress database `siteurl`/`home` options and the `wp-config.php` constants.

### 2.5 Deploy updated plugin files

After making code changes, copy modified files to the plugin directory:

```bash
PLUGIN=/var/www/html/wp-content/plugins/research-review-portal

# Copy one file
sudo cp assets/portal.js $PLUGIN/assets/portal.js

# Or sync the whole plugin (excludes data/ to protect live data)
sudo rsync -av --exclude='data/' ./ $PLUGIN/
```

To deploy from a Windows development machine via paramiko (Python SFTP):

```python
import paramiko, os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('portal.your-institution.edu',
               username='<vm-user>', password='<password>', timeout=30)
sftp = client.open_sftp()
sftp.put('assets/portal.js',
         '/var/www/html/wp-content/plugins/research-review-portal/assets/portal.js')
sftp.close()
client.close()
```

### 2.6 File permissions

The web server user must have read/write access to the `data/` directory:

```bash
sudo chown -R www-data:www-data \
  /var/www/html/wp-content/plugins/research-review-portal/data
sudo chmod -R 775 \
  /var/www/html/wp-content/plugins/research-review-portal/data
```

### 2.7 PHP configuration

The plugin requires these PHP settings (set in a custom `.ini` drop-in or `php.ini`):

```ini
upload_max_filesize = 64M
post_max_size       = 64M
memory_limit        = 256M
max_execution_time  = 60
```

On Ubuntu with PHP 8.1:
```bash
echo -e "upload_max_filesize=64M\npost_max_size=64M\nmemory_limit=256M\nmax_execution_time=60" \
  | sudo tee /etc/php/8.1/apache2/conf.d/99-rrp.ini
sudo service apache2 restart
```

### 2.8 Verify installation

```bash
curl -sf https://localhost/wp-json/research-portal/v1/health
# Expected: {"ok":true}
```

> Note: The health endpoint returns only `{"ok":true}` — it does not expose server timestamps or other internal values.

---

## 3. Database Schema & Initialization

The plugin manages its own database table and several `wp_options` entries. **No manual SQL is required** — the plugin initializes everything automatically on first load.

### 3.1 Automatic initialization flow

When the plugin is loaded for the first time (`plugins_loaded` action), the following sequence runs:

1. `Portal_Data::maybe_migrate()` is called.
2. It checks the `rrp_db_version` option in `wp_options`.
3. If the version is not `1.0`, it creates the `wp_rrp_submissions` table via `dbDelta()` and migrates any legacy JSON data.
4. Sets `rrp_db_version = 1.0` to prevent re-running.

This migration is **idempotent** — safe to call on every page load; it is a fast no-op once complete.

### 3.2 Custom database table

The plugin creates one dedicated table:

```sql
CREATE TABLE wp_rrp_submissions (
  submission_id  VARCHAR(50)  NOT NULL,           -- e.g. PROJ-2026-003
  status         VARCHAR(100) NOT NULL DEFAULT '', -- denormalized for fast queries
  submitter_email VARCHAR(191) NOT NULL DEFAULT '',
  submission_type VARCHAR(100) NOT NULL DEFAULT '',
  created_at     DATETIME     NOT NULL DEFAULT '0000-00-00 00:00:00',
  data           LONGTEXT     NOT NULL,            -- full submission JSON
  PRIMARY KEY  (submission_id),
  KEY idx_status          (status),
  KEY idx_submitter_email (submitter_email),
  KEY idx_submission_type (submission_type),
  KEY idx_created_at      (created_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> `dbDelta()` makes ALTER TABLE changes non-destructively on schema upgrades.

### 3.3 WordPress options used by the plugin

All stored in the `wp_options` table under these `option_name` keys:

| Option key | Content | Auto-created |
|---|---|---|
| `rrp_db_version` | Schema version string (current: `1.0`) | On first `plugins_loaded` |
| `rrp_submissions` | Legacy fallback (JSON) — migrated to table | On first load if file exists |
| `rrp_next_ids` | JSON map of per-type ID counters | On migration |
| `rrp_config` | Portal configuration JSON (reviewers, deadlines) | On migration |
| `rrp_webhooks` | Registered webhook endpoints JSON | On migration |
| `rrp_portal_settings` | Encrypted JSON blob — all portal settings | On first `RRP_Portal_Settings::get()` call |

### 3.4 Encryption key derivation

Settings containing secrets (`entra_client_secret`, `smtp_password`, `azure_blob_sas_url`, `acs_connection_string`, `turnitin_api_key`, `ithenticate_api_key`) are encrypted at rest using **AES-256-GCM**.

The encryption key is derived from WordPress's built-in secret salts:

```
KEY = SHA-256( AUTH_KEY . SECURE_AUTH_KEY . LOGGED_IN_KEY . NONCE_KEY )
```

These salts live in `wp-config.php`. **If you restore the database to a different WordPress install that has different salts, you must re-enter all encrypted settings** — they will be unreadable.

> Generate strong salts when installing: https://api.wordpress.org/secret-key/1.1/salt/

### 3.5 Manual DB inspection (WP-CLI)

```bash
WP=/var/www/html
wp --path=$WP --allow-root db query "SELECT submission_id, status, created_at FROM wp_rrp_submissions ORDER BY created_at DESC LIMIT 20;"

# Check db version
wp --path=$WP --allow-root option get rrp_db_version

# Check next ID counters
wp --path=$WP --allow-root option get rrp_next_ids
```

### 3.6 Database backup and restore

#### Docker
```bash
make db-export    # saves to data/rrp-db-export.sql
make db-import    # restores from data/rrp-db-export.sql
```

#### Bare-metal
```bash
WPDB=$(wp --path=/var/www/html --allow-root db info --format=json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['DB_NAME'])")
mysqldump -u root $WPDB > /tmp/rrp-backup-$(date +%Y%m%d).sql
# Restore:
mysql -u root $WPDB < /tmp/rrp-backup-YYYYMMDD.sql
```

---

## 4. WordPress Roles & Capabilities

### 4.1 Automatic role registration

Roles are created automatically by `Portal_User_Management::create_roles()`, which runs on every WordPress `init` action. It is idempotent — existing roles are never modified or overwritten, only missing roles are added.

**No manual role creation is required.** If roles are missing (e.g., after a WordPress roles table corruption), simply deactivate and reactivate the plugin:

```bash
wp --path=/var/www/html --allow-root plugin deactivate research-review-portal
wp --path=/var/www/html --allow-root plugin activate research-review-portal
```

### 4.2 Portal roles

| Role slug | Display name | Core capabilities |
|---|---|---|
| `rrp_student` | Research Student | `rrp_submit_research`, `rrp_view_own_submissions`, `rrp_edit_own_submissions` |
| `rrp_reviewer` | Research Reviewer | `rrp_review_submissions`, `rrp_view_assigned_submissions`, `rrp_provide_feedback`, `rrp_view_review_dashboard` |
| `rrp_coordinator` | Research Coordinator | `rrp_assign_reviewers`, `rrp_manage_workflow`, `rrp_view_all_submissions`, `rrp_edit_any_submission`, `rrp_skip_review_stages`, `rrp_manage_deadlines` |
| `rrp_admin` | Research Administrator | `rrp_full_admin_access`, `rrp_manage_users`, `rrp_manage_system_config`, `rrp_view_analytics`, `rrp_manage_reviewers`, `rrp_export_data`, `rrp_bulk_operations` |
| `rrp_faculty` | Research Faculty | `rrp_review_submissions`, `rrp_view_assigned_submissions`, `rrp_provide_feedback`, `rrp_view_all_submissions` |
| `rrp_public` | Public Submitter | `rrp_submit_research`, `rrp_view_own_submissions`, `rrp_edit_own_submissions` |

> WordPress `administrator` role inherits all RRP capabilities automatically.

### 4.3 Creating test users (WP-CLI)

```bash
WP="--path=/var/www/html --allow-root"

wp user create student  student@test.com  --role=rrp_student     --user_pass=test123 $WP
wp user create reviewer reviewer@test.com --role=rrp_reviewer    --user_pass=test123 $WP
wp user create coord    coord@test.com    --role=rrp_coordinator --user_pass=test123 $WP
wp user create rrpadmin rrpadmin@test.com --role=rrp_admin       --user_pass=test123 $WP
wp user create faculty  faculty@test.com  --role=rrp_faculty     --user_pass=test123 $WP
```

> Change all passwords before exposing the site to external users.

### 4.4 Assigning the reviewer ID

Each `rrp_reviewer` user needs a short reviewer ID (e.g. `r1`, `r2`) stored in user meta. Set it from the WordPress admin → **Users → Edit User → Reviewer ID**, or via WP-CLI:

```bash
wp --path=/var/www/html --allow-root user meta update <user_id> rrp_reviewer_id r1
```

---

## 5. Updating an Existing Install

### 5.1 Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
make build
make down
make up
```

The database schema migration runs automatically on first `plugins_loaded` after update — no manual step needed.

### 5.2 Bare-metal (production Azure VM)

Deploy changed files directly to the plugin directory:

```bash
ssh <vm-user>@portal.your-institution.edu
cd /var/www/html/wp-content/plugins/research-review-portal

# Pull if deployed from git
git pull

# Or copy specific files from dev machine (using paramiko/SFTP as shown in 2.5)
```

After updating `class-portal-rest.php` or `research-review-portal.php`, flush rewrite rules:
```bash
wp --path=/var/www/html --allow-root rewrite flush
```

Reload Apache without dropping connections:
```bash
sudo apache2ctl graceful
```

---

## 6. Enabling HTTPS (Let's Encrypt)

Microsoft Entra SSO requires HTTPS. The production VM already has HTTPS active. Use this section when setting up a new server.

### 6.1 Open port 443 in Azure NSG

In the Azure Portal → VM → **Networking** → **Network Security Group** → **Add inbound rule**:
- Destination port: `443`, Protocol: TCP, Action: Allow, Priority: `340`, Name: `HTTPS`

### 6.2 Run the HTTPS setup script

```bash
ssh <vm-user>@portal.your-institution.edu
cd /var/www/html/wp-content/plugins/research-review-portal
sudo bash scripts/enable-https.sh
```

The script:
- Installs Certbot + Apache plugin
- Obtains a Let's Encrypt certificate for your domain
- Configures HTTP → HTTPS redirect
- Updates WordPress `siteurl` / `home` to `https://`
- Installs auto-renewal cron (certificates renew every 60 days; valid for 90)

The script is idempotent — safe to re-run.

### 6.3 Verify HTTPS

```bash
curl -I http://your-domain.example.com   # should return 301 redirect
curl -I https://your-domain.example.com  # should return 200
```

### 6.4 Test certificate renewal

```bash
sudo certbot renew --dry-run
```

---

## 7. Microsoft Entra ID SSO Setup

### 7.1 Create the App Registration

1. In the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `CityU Research Review Portal`
3. Redirect URI (Web): `https://your-domain/wp-json/research-portal/v1/auth/callback`
4. Click **Register**.

### 7.2 Configure the App Registration

1. **Certificates & secrets** → **New client secret** → copy the value immediately.
2. **Overview** — note the **Application (client) ID** and **Directory (tenant) ID**.
3. **Authentication** — enable **ID tokens** under Implicit grant.

### 7.3 Configure the Portal

In the portal, log in as an Admin and go to **Administration → Portal Settings → SSO**.

| Field | Value |
|-------|-------|
| Tenant ID | Directory (tenant) ID from App Registration |
| Client ID | Application (client) ID from App Registration |
| Client Secret | Secret value you copied |
| Redirect URI | `https://your-domain/wp-json/research-portal/v1/auth/callback` |
| Enable SSO | Toggle On |

Click **Save**. The "Sign in with Microsoft" button will appear on the login page.

### 7.4 Security note on redirect_to

The `redirect_to` parameter passed to the SSO flow is validated server-side. Only same-origin URLs (matching `home_url()`) are honoured; external URLs are silently discarded. This prevents open-redirect phishing attacks via the Entra callback.

### 7.5 User provisioning

On first SSO login, the portal automatically creates a WordPress user account for the user. New SSO users are assigned the `rrp_student` role by default. An admin can then change the role from the Users panel.

---

## 8. Portal Settings Reference

Settings are stored in `wp_options` under `rrp_portal_settings` as an AES-256-GCM encrypted JSON blob. Manage them via **Administration → Portal Settings** in the portal UI or via the REST API (requires `rrp_full_admin_access`).

### 8.1 Encrypted fields

The following fields are encrypted at rest and are unreadable if the WordPress salts change:

| Field | Purpose |
|---|---|
| `entra_client_secret` | Entra ID OAuth 2.0 client secret |
| `smtp_password` | SMTP authentication password |
| `azure_blob_sas_url` | Azure Blob Storage container SAS URL |
| `acs_connection_string` | Azure Communication Services connection string |
| `turnitin_api_key` | Turnitin v3 plagiarism API key |
| `ithenticate_api_key` | iThenticate v2 API key |

### 8.2 Key settings reference

| Key | Default | Description |
|---|---|---|
| `university_name` | `City University of Seattle` | Displayed in UI and emails |
| `portal_name` | `Research Review Portal` | Portal branding |
| `sso_enabled` | `false` | Toggle Microsoft Entra SSO |
| `sso_provider` | `wordpress` | `wordpress` \| `entra` |
| `entra_tenant_id` | `` | Azure AD tenant GUID |
| `entra_client_id` | `` | App Registration client ID |
| `entra_redirect_uri` | `` | Must match App Registration redirect URI exactly |
| `entra_auto_provision` | `true` | Auto-create WP user on first SSO login |
| `smtp_enabled` | `false` | Enable SMTP for outgoing email |
| `smtp_host` | `` | SMTP server hostname |
| `smtp_port` | `587` | Typically 587 (STARTTLS) or 465 (SSL) |
| `smtp_encryption` | `tls` | `tls` \| `ssl` \| `` |
| `smtp_tls_skip_verify` | `false` | ⚠ See security note below |
| `acs_email_enabled` | `false` | Use Azure Communication Services for email |
| `azure_blob_sas_url` | `` | Container SAS URL for auto-backup |
| `auto_backup_enabled` | `false` | Enable scheduled DB backups to Azure Blob |
| `auto_backup_schedule` | `daily` | `daily` \| `weekly` |
| `plagiarism_provider` | `simulate` | `simulate` \| `core` \| `turnitin` \| `ithenticate` \| `none` |

### 8.3 smtp_tls_skip_verify

> **⚠ Security Warning:** `smtp_tls_skip_verify` disables TLS certificate verification for SMTP connections. When `true`, email transmission is vulnerable to man-in-the-middle attacks. This setting defaults to `false` and **must never be set to `true` in production.** It exists only for isolated development environments where a self-signed certificate is used.

---

## 9. Security-Hardened Defaults

The following security controls were hardened as part of the pre-penetration-test remediation (June 2025). All are active in the current production build.

| Control | Behaviour |
|---|---|
| Health endpoint | Returns only `{"ok":true}` — no server timestamps or internal IDs exposed |
| File upload validation | ZIP archives rejected (prevents zip bomb / web-shell upload) |
| User registration | Existing-email returns HTTP 200 (neutral) — prevents user enumeration |
| Config access | Students (`rrp_submit_research`) cannot read portal configuration |
| Workflow self-approval | Submitters cannot self-approve their own submissions via PATCH |
| SMTP TLS | Certificate verification ON by default; skip only via explicit `smtp_tls_skip_verify` setting |
| Reviewer defaults | Hardcoded institutional emails replaced with `reviewer1-7@example.com` placeholders |
| SSO redirect | Same-origin validation on `redirect_to` before storage — prevents open redirect |
| Input sanitization | All REST inputs pass through `sanitize_text_field()` / `sanitize_textarea_field()` |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy` sent on every response |

---

## 10. Post-Deploy Verification Checklist

Run these checks after every deployment to confirm the new code is live and the system is healthy.

### 10.1 Health endpoint

```bash
curl -sf https://your-domain/wp-json/research-portal/v1/health
# PASS: {"ok":true}
# FAIL: anything containing "bootId" (old code) or HTTP 4xx/5xx
```

### 10.2 WordPress REST API reachable

```bash
curl -sf https://your-domain/wp-json/ | python3 -m json.tool | grep '"name"'
# Should return the site name
```

### 10.3 Roles exist

```bash
wp --path=/var/www/html --allow-root role list | grep rrp
# Expected: rrp_student, rrp_reviewer, rrp_coordinator, rrp_admin, rrp_faculty, rrp_public
```

### 10.4 DB schema initialized

```bash
wp --path=/var/www/html --allow-root option get rrp_db_version
# Expected: 1.0

wp --path=/var/www/html --allow-root db query "SHOW TABLES LIKE 'wp_rrp_submissions';"
# Expected: wp_rrp_submissions
```

### 10.5 Security headers present

```bash
curl -sI https://your-domain/ | grep -E 'X-Content-Type-Options|X-Frame-Options|Strict-Transport-Security'
# Expected: all three headers present
```

### 10.6 ZIP upload rejected

```bash
# Should return 400 (invalid file type)
curl -sf -X POST https://your-domain/wp-json/research-portal/v1/submissions/TEST-000/attachments \
  -H "Cookie: <auth-cookie>" \
  -F "file=@test.zip"
# Expected: HTTP 400 — zip uploads are blocked
```

### 10.7 Login with each role

1. Log in as `rrp_student` — verify submission form is accessible.
2. Log in as `rrp_reviewer` — verify assignment dashboard is accessible.
3. Log in as `rrp_coordinator` — verify workflow management is accessible.
4. Log in as `rrp_admin` — verify Administration panel is accessible.

### 10.8 Smoke test SMTP (if enabled)

In WordPress admin → **Administration → Portal Settings → Email**, click **Send Test Email** and confirm delivery.

---

## 11. Default Credentials

| Where | Username | Password |
|-------|----------|----------|
| WordPress Admin (Docker) | `admin` | `Admin1234!` |
| Test student | `student@test.com` | `test123` |
| Test reviewer | `reviewer@test.com` | `test123` |
| Test coordinator | `coordinator@test.com` | `test123` |
| Test portal admin | `rrpadmin@test.com` | `test123` |
| Production VM (SSH) | `<vm-user>` | *(set at VM provisioning)* |

> **Change all default passwords before exposing the site to the internet.**

---

## 12. Environment Variables Reference

All variables come from `.env` (copy from `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `WP_URL` | `http://localhost:8080` | Public URL of the portal |
| `WP_PORT` | `8080` | Host port mapped to container port 80 |
| `WP_ADMIN_USER` | `admin` | WordPress admin username |
| `WP_ADMIN_PASS` | `Admin1234!` | WordPress admin password |
| `WP_ADMIN_EMAIL` | `admin@example.com` | WordPress admin email |
| `MYSQL_ROOT_PASSWORD` | `rootpass` | MySQL root password (Docker only) |
| `MYSQL_DATABASE` | `wordpress` | MySQL database name |
| `MYSQL_USER` | `wp` | MySQL application user |
| `MYSQL_PASSWORD` | `wp_test_pass` | MySQL application password |

These variables are used by `docker-compose.yml` and `scripts/docker-init.sh`. They are not read at runtime by the PHP plugin (which uses WordPress's own database connection).
