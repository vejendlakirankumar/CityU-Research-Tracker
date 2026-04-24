# CityU Research Review Portal — Operations Manual

> **Audience:** System administrators and DevOps staff responsible for deploying and operating the portal.  
> **Last updated:** April 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Fresh Installation](#2-fresh-installation)
3. [Environment Variables Reference](#3-environment-variables-reference)
4. [Daily Health Checks](#4-daily-health-checks)
5. [Monitoring & Logs](#5-monitoring--logs)
6. [Backups](#6-backups)
7. [Rollback](#7-rollback)
8. [Updating the Application](#8-updating-the-application)
9. [SSL / TLS Configuration](#9-ssl--tls-configuration)
10. [Queue Workers & Scheduler](#10-queue-workers--scheduler)
11. [User Administration (CLI)](#11-user-administration-cli)
12. [System Configuration](#12-system-configuration)
13. [Email Configuration](#13-email-configuration)
14. [SSO Provider Management](#14-sso-provider-management)
15. [File Storage](#15-file-storage)
16. [Turnitin Integration](#16-turnitin-integration)
17. [Webhooks](#17-webhooks)
18. [Supervisor & Watchdog](#18-supervisor--watchdog)
19. [Troubleshooting](#19-troubleshooting)
20. [Security Checklist](#20-security-checklist)
21. [Smoke Test Checklist](#21-smoke-test-checklist)

---

## 1. Architecture Overview

```
Internet
    │ HTTPS (443)
    ▼
[Host Nginx]  ← SSL termination, reverse proxy, HSTS headers
    │ HTTP (localhost:80)
    ▼
[Docker: rrp_app]   PHP 8.4-FPM + Nginx 1.25 (Ubuntu 24.04)
    │               ├── /api/*        → Laravel 10 (PHP-FPM)
    │               └── /*            → React SPA (static files in /var/www/frontend)
    │
    ├── [Docker: rrp_worker]   php artisan queue:work (same image, no HTTP)
    ├── [Docker: rrp_postgres] PostgreSQL 16-alpine  (volume: pgdata)
    └── [Docker: rrp_redis]    Redis 7-alpine         (volume: redis_data)
```

**Key paths:**

| Path | Description |
|---|---|
| `/opt/rrp-v2/` | Application root on the VM |
| `/opt/rrp-backups/` | Backup archives |
| `/var/www/html/` | Laravel app inside `rrp_app` container |
| `/var/www/frontend/` | React SPA build inside `rrp_app` container |
| `/var/www/html/storage/app/uploads/` | Uploaded submission files (mounted volume) |
| `/var/log/nginx/rrp-v2-*.log` | Host Nginx logs |
| `/var/log/supervisor/` | Supervisor process logs |

**Docker volumes:**

| Volume | Contents |
|---|---|
| `pgdata` | PostgreSQL data directory |
| `redis_data` | Redis persistence |
| `app_storage` | Laravel `storage/` (uploads, backups, logs) |
| `app_cache` | Laravel `bootstrap/cache/` |

**Docker image — multi-stage build:**

The `Dockerfile` uses three stages:
1. **`frontend-builder`** — Node 22 Alpine: `npm install` + `npm run build`
2. **`composer-builder`** — Composer 2: `composer install --no-dev`
3. **Runtime** — Ubuntu 24.04: PHP 8.4-FPM + Nginx, copies built artefacts from both previous stages

---

## 2. Fresh Installation

### Prerequisites

- Ubuntu 22.04 or 24.04 LTS VM
- Minimum 2 vCPU, 4 GB RAM, 40 GB disk
- Ports 80 and 443 open inbound
- DNS A record pointing to the VM public IP before running SSL setup

### Option A — Automated installer (recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/rrp.git /opt/rrp-v2
cd /opt/rrp-v2

# Run the installer (must be root)
sudo bash deploy/install.sh \
  --domain portal.cityu.edu \
  --email  admin@cityu.edu
```

The installer:
1. Installs Docker, Docker Compose, Nginx, Certbot, Supervisor
2. Generates a random `DB_PASSWORD` and `APP_KEY`
3. Writes `/opt/rrp-v2/.env`
4. Builds and starts the Docker Compose stack
5. Runs database migrations and seeds
6. Provisions a Let's Encrypt TLS certificate
7. Configures Supervisor to keep the stack running on reboot

**Dev / local install (no SSL, SQLite-compatible mode):**

```bash
sudo bash deploy/install.sh --dev
```

### Option B — Manual Docker Compose

```bash
# 1. Copy and edit the environment file
cp backend/.env.example .env
# Edit .env: set APP_KEY, DB_PASSWORD, APP_URL, SANCTUM_STATEFUL_DOMAINS

# Generate APP_KEY
docker run --rm php:8.4-cli php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"

# 2. Build and start
docker compose up -d --build

# 3. Run migrations
docker exec rrp_app php artisan migrate --force

# 4. (Optional) Seed initial data
docker exec rrp_app php artisan db:seed --force
```

---

## 3. Environment Variables Reference

All required variables must be set before starting the containers. In production they are passed as Docker environment variables; the container entrypoint writes a `.env` file on first start.

### Core application

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_KEY` | ✅ | — | 32-byte base64 key. Generate with `php artisan key:generate --show` |
| `APP_ENV` | ✅ | `production` | Must be `production` in prod |
| `APP_DEBUG` | ✅ | `false` | Must be `false` in prod |
| `APP_URL` | ✅ | `http://localhost:8080` | Full public URL including scheme |
| `APP_NAME` | — | `Research Review Portal` | Displayed in emails and portal header |
| `LOG_CHANNEL` | — | `stderr` | Use `stderr` in Docker (no file logging) |
| `LOG_LEVEL` | — | `error` | Use `error` in prod; `debug` for troubleshooting only |

### Database (PostgreSQL)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | ✅ | `postgres` | Docker service name or host |
| `DB_PORT` | — | `5432` | PostgreSQL port |
| `DB_DATABASE` | ✅ | `rrp_production` | Database name |
| `DB_USERNAME` | ✅ | `rrp_app` | Database user |
| `DB_PASSWORD` | ✅ | — | Database password (use a strong random value) |
| `DB_SSLMODE` | — | `prefer` | Set to `require` if DB is on a separate host |

### Cache / Queue / Session

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | ✅ | `redis` | Docker service name or host |
| `REDIS_PASSWORD` | — | *(empty)* | Redis auth password (recommended in prod) |
| `REDIS_PORT` | — | `6379` | Redis port |
| `QUEUE_CONNECTION` | — | `redis` | Use `redis` in prod |
| `CACHE_STORE` | — | `redis` | Use `redis` in prod |
| `SESSION_DRIVER` | — | `cookie` | `cookie` or `redis` |
| `SESSION_LIFETIME` | — | `480` | Session lifetime in minutes |

### Auth / CORS

| Variable | Required | Description |
|---|---|---|
| `SANCTUM_STATEFUL_DOMAINS` | ✅ | Comma-separated frontend domains (e.g. `portal.cityu.edu`) |
| `SESSION_DOMAIN` | ✅ | Cookie domain (e.g. `portal.cityu.edu`) |

### File storage

| Variable | Required | Default | Description |
|---|---|---|---|
| `FILESYSTEM_DISK` | — | `local` | `local`, `azure`, or `s3` |
| `AZURE_STORAGE_NAME` | If azure | — | Azure Storage account name |
| `AZURE_STORAGE_KEY` | If azure | — | Azure Storage account key |
| `AZURE_STORAGE_CONTAINER` | If azure | `rrp-uploads` | Blob container name |
| `AWS_ACCESS_KEY_ID` | If s3 | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If s3 | — | AWS secret key |
| `AWS_DEFAULT_REGION` | If s3 | `us-east-1` | S3 region |
| `AWS_BUCKET` | If s3 | `rrp-uploads` | S3 bucket name |

### WebSocket (Reverb)

| Variable | Default | Description |
|---|---|---|
| `REVERB_APP_ID` | `rrp-app` | Reverb application ID |
| `REVERB_APP_KEY` | `rrp-key` | Reverb application key |
| `REVERB_APP_SECRET` | `rrp-secret` | Reverb secret — **change in production** |
| `REVERB_HOST` | `0.0.0.0` | Reverb bind address |
| `REVERB_PORT` | `8001` | Reverb WebSocket port |

### Integrations

| Variable | Description |
|---|---|
| `TURNITIN_API_KEY` | Turnitin API key |
| `TURNITIN_API_URL` | Turnitin API endpoint URL |
| `TURNITIN_WEBHOOK_SECRET` | HMAC secret for verifying Turnitin webhook payloads — **must be set when Turnitin is enabled** |

### Startup control

| Variable | Default | Description |
|---|---|---|
| `RUN_MIGRATIONS` | `true` | Set to `false` on the worker container (already set in `docker-compose.yml`) |
| `SECRETS_FROM_FILES` | `false` | Set to `true` to read secrets from `/run/secrets/*` (Docker Swarm secrets) |

---

## 4. Daily Health Checks

### API health endpoint

```bash
# From the VM
curl -sf https://portal.cityu.edu/api/system/public | python3 -m json.tool
```

Expected JSON contains `org_name`, `portal_name`, `sso_enabled`. A non-200 response means the app is down.

### Container status

```bash
# All four services should show Up / healthy
docker compose -f /opt/rrp-v2/docker-compose.yml ps
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Queue depth

```bash
docker exec rrp_app php artisan queue:monitor redis:default
```

### Disk usage

```bash
df -h
docker exec rrp_app du -sh /var/www/html/storage/app/uploads
du -sh /opt/rrp-backups/
```

### Failed jobs

```bash
docker exec rrp_app php artisan queue:failed
```

---

## 5. Monitoring & Logs

### Application logs

The app container writes to `stderr` (`LOG_CHANNEL=stderr`). Read via Docker:

```bash
# Last 200 lines
docker logs rrp_app --tail 200

# Follow in real time
docker logs -f rrp_app

# Worker logs
docker logs -f rrp_worker
```

> There is **no** `laravel.log` file on disk when `LOG_CHANNEL=stderr`.

### Nginx access and error logs (host)

```bash
sudo tail -n 100 /var/log/nginx/rrp-v2-access.log
sudo tail -n 100 /var/log/nginx/rrp-v2-error.log
```

### Nginx logs inside the container

```bash
docker exec rrp_app tail -n 100 /var/log/nginx/access.log
docker exec rrp_app tail -n 100 /var/log/nginx/error.log
```

### PostgreSQL logs

```bash
docker logs rrp_postgres --tail 100
```

### Supervisor logs

```bash
sudo tail -n 100 /var/log/supervisor/rrp-v2-stack.log
sudo tail -n 100 /var/log/supervisor/rrp-v2-watchdog.log
```

### In-app Audit Log

All administrative and workflow actions are stored in the `audit_logs` table. View via the portal at **Admin → Audit Log**, or query directly:

```bash
docker exec rrp_app php artisan tinker --execute="
App\Models\AuditLog::latest()->take(20)->get(['user_id','action','description','created_at'])
    ->each(fn(\$l) => print \$l->created_at.' '.\$l->action.' '.\$l->description.\"\n\");
"
```

---

## 6. Backups

### Automated backup script

`deploy/backup.sh` creates a timestamped `.tar.gz` archive containing:
- A PostgreSQL custom-format dump (`pg_dump --format=custom --compress=6`)
- The `storage/app/` directory (uploads, backups)
- A copy of the backend `.env`

```bash
# Run manually
sudo bash /opt/rrp-v2/deploy/backup.sh

# With options
sudo bash /opt/rrp-v2/deploy/backup.sh --keep-days 30 --output-dir /mnt/backup

# Database only (no files)
sudo bash /opt/rrp-v2/deploy/backup.sh --db-only

# Upload to Azure Blob after backup
AZURE_STORAGE_ACCOUNT=myaccount \
AZURE_STORAGE_KEY=mykey \
sudo bash /opt/rrp-v2/deploy/backup.sh --upload
```

**Script flags:**

| Flag | Default | Description |
|---|---|---|
| `--keep-days N` | `14` | Retain the last N days of backups; older archives are deleted |
| `--output-dir DIR` | `/opt/rrp-backups` | Override backup destination directory |
| `--db-only` | off | Skip application files; dump database only |
| `--upload` | off | Upload archive to Azure Blob Storage after creation |

### Scheduled daily backup via cron

```bash
# Add to /etc/crontab — runs at 02:00 daily as root
0 2 * * * root bash /opt/rrp-v2/deploy/backup.sh --keep-days 14 >> /var/log/rrp-backup.log 2>&1
```

### Manual database dump

```bash
# Dump to host filesystem
docker exec rrp_postgres pg_dump \
  -U rrp_app \
  --format=custom \
  --compress=6 \
  rrp_production > backup_$(date +%Y%m%d_%H%M%S).pgdump

# Restore from dump
docker exec -i rrp_postgres pg_restore \
  -U rrp_app \
  -d rrp_production \
  --clean --no-owner \
  < backup_YYYYMMDD_HHMMSS.pgdump
```

### In-portal backup

**Admin → Settings → Backup & Archive → Run Backup Now**

Backups triggered from the portal are stored in `storage/app/backups/` (inside the mounted volume) and can be downloaded from the same page.

### Offsite Azure Blob backup

Set these environment variables in the shell before running `backup.sh --upload`:

```bash
export AZURE_STORAGE_ACCOUNT=your-account-name
export AZURE_STORAGE_KEY=your-account-key
export AZURE_STORAGE_CONTAINER=rrp-backups
```

---

## 7. Rollback

Use `rollback.sh` on the production VM to restore a previous backup.

```bash
# List available backups
sudo bash /opt/rrp-v2/deploy/rollback.sh --list

# Interactive rollback (prompts for selection)
sudo bash /opt/rrp-v2/deploy/rollback.sh

# Roll back to a specific archive (non-interactive)
sudo bash /opt/rrp-v2/deploy/rollback.sh \
  --to /opt/rrp-backups/rrp-backup-20260422_020001.tar.gz

# Database only
sudo bash /opt/rrp-v2/deploy/rollback.sh --db-only

# Application files only (skip database restore)
sudo bash /opt/rrp-v2/deploy/rollback.sh --app-only
```

**Flags:**

| Flag | Description |
|---|---|
| `--list` | Print available backups and exit |
| `--to FILE` | Target archive path (non-interactive) |
| `--db-only` | Restore database only |
| `--app-only` | Restore application files only; skip database |
| `--steps N` | Number of migration batches to roll back (default: 1) |

> **Warning:** Restoring the database overwrites all data since the backup was taken. Always take a fresh backup immediately before rolling back.

### Migration-only rollback

```bash
docker exec rrp_app php artisan migrate:rollback --step=1 --force
```

---

## 8. Updating the Application

### Standard update via `update.sh`

Run from your local machine (requires SSH access to the VM):

```bash
bash /opt/rrp-v2/deploy/update.sh

# Backend only (no frontend rebuild)
bash /opt/rrp-v2/deploy/update.sh --backend-only

# Frontend only (no migrations)
bash /opt/rrp-v2/deploy/update.sh --frontend-only

# Skip migrations (only safe when there are no schema changes)
bash /opt/rrp-v2/deploy/update.sh --no-migrate
```

Configure the script via environment variables:

```bash
VM_HOST=172.206.114.248   # VM IP or hostname
VM_USER=azureadmin        # SSH username
VM_PASS=secret            # SSH password (or use SSH_KEY)
SSH_KEY=~/.ssh/id_rsa     # Path to SSH private key
REMOTE_DIR=/opt/rrp-v2   # App root directory on the VM
```

### What the update script does

1. `rsync` backend PHP files to the VM (excludes `vendor/`, `.env`, `storage/`)
2. `composer install --no-dev --optimize-autoloader` inside the container
3. Builds the React frontend locally (`npm run build`)
4. `rsync` `dist/` to VM → `docker cp` into container at `/var/www/frontend/`
5. `php artisan migrate --force`
6. `php artisan config:cache && route:cache && view:cache`
7. `php artisan queue:restart` — graceful worker restart
8. `nginx -s reload` — reload Nginx inside the container

### Zero-downtime update

For high-availability instances:

```bash
bash /opt/rrp-v2/deploy/update.sh --zero-downtime
```

This builds a `:candidate` image, starts it on port 8081, health-checks it against `/api/system/public`, switches the Nginx upstream, then removes the old container — with no downtime.

### Manual cache clear

```bash
docker exec rrp_app php artisan config:cache
docker exec rrp_app php artisan route:cache
docker exec rrp_app php artisan view:cache
docker exec rrp_app php artisan queue:restart
```

---

## 9. SSL / TLS Configuration

### Provision a Let's Encrypt certificate

DNS must be pointing to the server before running this:

```bash
sudo bash /opt/rrp-v2/deploy/ssl-setup.sh portal.cityu.edu admin@cityu.edu
```

The script installs Certbot, deploys the Nginx vhost, obtains a certificate via the webroot challenge, and reloads Nginx with SSL enabled.

### Manual renewal

```bash
sudo certbot renew --quiet
sudo systemctl reload nginx
```

Certbot installs a renewal cron automatically. Certificates are valid 90 days; auto-renewal runs twice daily when expiry is within 30 days.

### Nginx vhost hardening (`deploy/nginx-vhost.conf`)

| Feature | Configuration |
|---|---|
| TLS versions | TLSv1.2 and TLSv1.3 only |
| HSTS | `max-age=15768000` (6 months) |
| HTTP/2 | Enabled |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation blocked |

After editing the vhost config:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

To increase the upload size limit (must match the `max_file_size_mb` in Settings):

```nginx
client_max_body_size 100M;  # edit in nginx-vhost.conf, then reload
```

---

## 10. Queue Workers & Scheduler

### Worker container

`rrp_worker` runs the same Docker image as `rrp_app` with a different command:

```
php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 --no-interaction
```

- `--tries=3` — a job that fails 3 times is moved to the failed jobs table
- `--max-time=3600` — worker restarts after 1 hour to release memory
- `RUN_MIGRATIONS=false` — the worker container does not run migrations on startup

### Restart the worker

```bash
# Graceful restart (waits for the current job to finish, then restarts)
docker exec rrp_app php artisan queue:restart

# Immediate restart
docker compose -f /opt/rrp-v2/docker-compose.yml restart worker
```

### Monitor failed jobs

```bash
# List all failed jobs
docker exec rrp_app php artisan queue:failed

# Retry all failed jobs
docker exec rrp_app php artisan queue:retry all

# Retry a specific job by ID
docker exec rrp_app php artisan queue:retry <id>

# Discard all failed jobs permanently
docker exec rrp_app php artisan queue:flush
```

### Scheduled tasks (Laravel Scheduler)

The scheduler runs every minute via cron inside the `rrp_app` container:

```bash
# List all scheduled tasks and their next run time
docker exec rrp_app php artisan schedule:list

# Run the scheduler manually (for testing)
docker exec rrp_app php artisan schedule:run
```

---

## 11. User Administration (CLI)

Prefer the portal UI (**Admin → User Management**) for routine changes. Use the CLI only when the portal is inaccessible or during bootstrapping.

### Create a user

```bash
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::create([
    'name'     => 'Jane Smith',
    'email'    => 'jsmith@cityu.edu',
    'password' => bcrypt('Temp1234!'),
    'roles'    => ['student'],
    'status'   => 'active',
]);
print 'Done';
"
```

### Assign / change roles

```bash
docker exec rrp_app php artisan tinker --execute="
\$u = \App\Models\User::where('email','jsmith@cityu.edu')->firstOrFail();
\$u->roles = ['coordinator'];
\$u->save();
print 'Done';
"
```

To add a role without removing existing ones:

```bash
\$u->roles = array_unique(array_merge(\$u->roles ?? [], ['admin']));
```

### Reset a password

```bash
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::where('email','jsmith@cityu.edu')
    ->update(['password' => bcrypt('NewPass123!')]);
print 'Done';
"
```

### Unlock a locked account

```bash
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::where('email','jsmith@cityu.edu')
    ->update(['login_attempts' => 0, 'locked_until' => null]);
print 'Done';
"
```

### Deactivate a user

```bash
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::where('email','jsmith@cityu.edu')
    ->update(['status' => 'inactive']);
print 'Done';
"
```

---

## 12. System Configuration

All portal configuration is managed via **Admin → Settings** (admin role required). Changes take effect immediately without a container restart.

| Tab | Key fields |
|---|---|
| **Organisation** | Portal name, logo URL, primary colour (hex), timezone, locale, date format |
| **Email** | SMTP driver, host, port, credentials, from address; Send Test Email button |
| **SSO Providers** | OIDC/OAuth2 provider list; client ID, secret, discovery URL; auto-provision toggle; default role |
| **Password & Security** | Minimum length, complexity rules, expiry days (0 = disabled), reuse limit, lockout threshold and duration |
| **Notifications** | Per-event email notification toggles |
| **Feature Flags** | Enable/disable portal features without code changes (meetings, blind review, gated review, appeals, References tool) |
| **Integrations** | Turnitin API key, endpoint URL, webhook secret; enable/disable toggle |
| **Backup & Archive** | Run backup now; list and download existing backups |

---

## 13. Email Configuration

### Configure SMTP in the portal

**Admin → Settings → Email**

| Field | Description |
|---|---|
| Driver | `smtp` (use `log` to suppress sending during testing) |
| Host | SMTP relay hostname |
| Port | `587` (STARTTLS) or `465` (SSL) |
| Username / Password | SMTP credentials |
| From Address | Sender email shown on all outgoing mail |
| From Name | Sender display name (defaults to portal name) |
| Encryption | `tls` (STARTTLS) or `ssl` |

Click **Send Test Email** after saving to verify delivery.

### Test via CLI

```bash
docker exec rrp_app php artisan tinker --execute="
Mail::raw('Test email from RRP', fn(\$m) => \$m->to('you@cityu.edu')->subject('RRP Test'));
print 'Sent';
"
```

### Common SMTP providers

| Provider | Host | Port | Notes |
|---|---|---|---|
| SendGrid | `smtp.sendgrid.net` | 587 | API key as SMTP password |
| Mailgun | `smtp.mailgun.org` | 587 | Sandbox domain for testing |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 | Also supports `MAIL_MAILER=ses` |
| Office 365 | `smtp.office365.com` | 587 | Requires modern auth |
| Gmail | `smtp.gmail.com` | 587 | Requires App Password with 2FA |

---

## 14. SSO Provider Management

### Add an OIDC provider (e.g. Microsoft Entra ID / Azure AD)

**Admin → Settings → SSO Providers → + Add Provider**

| Field | Azure AD example |
|---|---|
| Protocol | `OIDC` |
| Display name | `Sign in with Microsoft` |
| Client ID | Application (client) ID from Azure portal app registration |
| Client Secret | Secret value from Azure portal → Certificates & secrets |
| Discovery URL | `https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration` |
| Scopes | `openid profile email` |
| Auto-provision users | ✅ (creates accounts on first SSO login) |
| Default role | `student` |

### Callback URL to register in your IdP

```
https://portal.cityu.edu/api/sso/{provider-uuid}/callback
```

The provider UUID is displayed on the saved provider row.

### Disable a provider

Toggle the provider off in the SSO Providers list. Existing accounts retain their email/password credentials and can still log in locally.

---

## 15. File Storage

### Local storage (default)

Files are stored in `storage/app/uploads/` inside the container, mounted via the `app_storage` Docker volume. Data persists across container rebuilds.

### Azure Blob Storage

Set via Docker environment variables or in `.env`:

```bash
FILESYSTEM_DISK=azure
AZURE_STORAGE_NAME=mystorageaccount
AZURE_STORAGE_KEY=base64key==
AZURE_STORAGE_CONTAINER=rrp-uploads
```

### Amazon S3

```bash
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=ap-east-1
AWS_BUCKET=rrp-uploads
```

### Regenerate storage symlink

Run after a fresh install if file serving is broken:

```bash
docker exec rrp_app php artisan storage:link
```

---

## 16. Turnitin Integration

When Turnitin is enabled, a **Similarity Check** panel appears on each submission detail page for reviewers and coordinators. When disabled, the portal falls back to a built-in local similarity comparison against other submissions.

### Enable Turnitin

**Admin → Settings → Integrations**

| Field | Description |
|---|---|
| API Key | Turnitin API key |
| API URL | Turnitin API endpoint (provided by Turnitin) |
| Webhook Secret | HMAC-SHA256 secret for webhook verification |
| Enabled | Toggle on |

### Webhook endpoint

Register in your Turnitin dashboard:

```
POST https://portal.cityu.edu/api/webhooks/turnitin
```

> **Security requirement:** `TURNITIN_WEBHOOK_SECRET` **must** be set. The portal rejects **all** Turnitin webhook calls when no secret is configured — this prevents spoofed similarity results.

---

## 17. Webhooks

The portal pushes events to external systems via outbound HTTP webhooks.

**Admin → Webhooks → + New Webhook**

| Field | Description |
|---|---|
| Endpoint URL | HTTPS URL of the receiving server |
| Events | Events to subscribe to (e.g. `submission.created`, `review.submitted`, `decision.finalised`) |
| Secret | HMAC-SHA256 signing secret — verifiable via `X-RRP-Signature` header |

Deliveries are retried up to 3 times on failure with exponential backoff. Delivery history and error logs are on each webhook's detail page. Use the **Test** button to send a sample payload.

### Verifying webhook signatures (receiver side)

```php
$expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
if (!hash_equals($expected, $receivedHeader)) {
    return response('Unauthorized', 401);
}
```

---

## 18. Supervisor & Watchdog

Supervisor is installed on the VM host and manages the Docker Compose stack as a persistent process group.

### Supervisor commands

```bash
# Check status of all managed processes
sudo supervisorctl status

# Restart the entire Docker Compose stack
sudo supervisorctl restart rrp-v2-stack

# Follow live logs
sudo supervisorctl tail -f rrp-v2-stack
sudo supervisorctl tail -f rrp-v2-watchdog

# Reload config after editing .conf files
sudo supervisorctl reread && sudo supervisorctl update
```

### Configuration file

`deploy/supervisord.conf` defines two programs:

| Program | Description |
|---|---|
| `rrp-v2-stack` | Runs `docker compose up` in the foreground; auto-restarts on crash |
| `rrp-v2-watchdog` | Runs `watchdog.sh` every 60 s; triggers `supervisorctl restart rrp-v2-stack` if the health endpoint returns non-200 |

```bash
# Install or update supervisor config
sudo cp /opt/rrp-v2/deploy/supervisord.conf /etc/supervisor/conf.d/rrp-v2.conf
sudo supervisorctl reread
sudo supervisorctl update
```

### Watchdog

`deploy/watchdog.sh` calls `GET http://localhost/api/system/public`. If the HTTP status is not 200, it restarts the stack:

```bash
supervisorctl restart rrp-v2-stack
```

Logs: `/var/log/supervisor/rrp-v2-watchdog.log`

### Start on boot

```bash
sudo systemctl enable supervisor
sudo systemctl is-enabled supervisor   # should print "enabled"
```

---

## 19. Troubleshooting

### Portal returns HTTP 500 or blank page

```bash
# Check application logs
docker logs rrp_app --tail 100

# Verify APP_KEY is set
docker exec rrp_app php artisan key:show

# Verify database connectivity
docker exec rrp_app php artisan db:show

# Check migration status
docker exec rrp_app php artisan migrate:status
```

### "419 CSRF token mismatch" on login

```bash
# SANCTUM_STATEFUL_DOMAINS must exactly match the domain used in the browser URL bar
docker exec rrp_app php artisan config:show sanctum | grep stateful
# Fix: update SANCTUM_STATEFUL_DOMAINS and SESSION_DOMAIN in docker-compose.yml, then restart
docker compose -f /opt/rrp-v2/docker-compose.yml up -d app
```

### Queue jobs not processing

```bash
# Is the worker container running?
docker compose -f /opt/rrp-v2/docker-compose.yml ps worker

# Test Redis connectivity
docker exec rrp_app php artisan tinker --execute="
Cache::put('test','ok',10); print Cache::get('test');
"

# Restart worker
docker compose -f /opt/rrp-v2/docker-compose.yml restart worker

# Check for failed jobs
docker exec rrp_app php artisan queue:failed
```

### File uploads failing

```bash
# Check storage directory permissions
docker exec rrp_app ls -la /var/www/html/storage/app/

# Fix ownership if needed
docker exec rrp_app chown -R www-data:www-data /var/www/html/storage

# Check available disk space on host
df -h /opt/rrp-v2
```

### Container won't start

```bash
docker compose -f /opt/rrp-v2/docker-compose.yml logs app
# Common causes:
#   - APP_KEY not set or empty
#   - DB_PASSWORD wrong or postgres container not yet healthy
#   - Port 80 already in use on host  →  ss -tlnp | grep :80
#   - Migrations failing on startup (check logs for SQL errors)
```

### Nginx 502 Bad Gateway

```bash
docker logs rrp_app --tail 50
docker exec rrp_app nginx -t
docker compose -f /opt/rrp-v2/docker-compose.yml restart app
```

### Migrations fail

```bash
# Check current state
docker exec rrp_app php artisan migrate:status

# Force re-run
docker exec rrp_app php artisan migrate --force

# Roll back the last batch if a migration left DB in a broken state
docker exec rrp_app php artisan migrate:rollback --step=1 --force
```

### Emails not being delivered

```bash
# 1. Verify SMTP settings in portal: Admin → Settings → Email → Send Test Email
# 2. Check worker logs (emails are dispatched via the queue)
docker logs rrp_worker --tail 50
# 3. Check failed jobs
docker exec rrp_app php artisan queue:failed
```

### Turnitin similarity check not working

```bash
# Is Turnitin enabled?
# Admin → Settings → Integrations → Turnitin → Enabled toggle

# Is the webhook secret configured?
docker exec rrp_app php artisan tinker --execute="
print config('services.turnitin.webhook_secret') ? 'SET' : 'NOT SET — webhook will be rejected';
"
```

---

## 20. Security Checklist

Run after every fresh deployment and after significant configuration changes.

### Application

- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] `LOG_LEVEL=error`
- [ ] `APP_KEY` is a unique 32-byte random value (not from `.env.example`)
- [ ] `REVERB_APP_SECRET` has been changed from the default `rrp-secret`
- [ ] All seeded default account passwords have been changed

### Network

- [ ] HTTPS enforced; HTTP redirects to HTTPS
- [ ] TLS certificate is valid and auto-renewing (`certbot renew --dry-run`)
- [ ] `SANCTUM_STATEFUL_DOMAINS` matches the exact production domain only
- [ ] `SESSION_DOMAIN` matches the production domain
- [ ] PostgreSQL (5432) is **not** exposed to the public internet
- [ ] Redis (6379) is **not** exposed to the public internet
- [ ] VM firewall allows only ports 22, 80, 443 inbound
- [ ] SSH password auth is disabled (key-only)

### Application settings

- [ ] Password policy configured (length, complexity, expiry)
- [ ] Account lockout configured
- [ ] Audit logging enabled in Feature Flags
- [ ] SMTP configured and Send Test Email succeeds
- [ ] Turnitin webhook secret set (if Turnitin is enabled)
- [ ] All outbound webhooks use HTTPS and have signing secrets
- [ ] Daily backup cron is installed and running
- [ ] Backup restore tested in a staging environment
- [ ] Offsite backup destination configured (Azure Blob or S3)

### Storage

- [ ] `storage/` is not directly web-accessible (protected by Nginx)
- [ ] Allowed file extensions are restricted in Submission Categories
- [ ] Max file size configured in each submission type

---

## 21. Smoke Test Checklist

Run after every deployment before announcing the release.

### Infrastructure

```bash
# On the VM
curl -s https://portal.cityu.edu/api/system/public | python3 -m json.tool
docker ps --format "table {{.Names}}\t{{.Status}}"
```

| # | Check | Pass? |
|---|---|---|
| 1.1 | HTTPS loads without certificate warning | |
| 1.2 | `http://` redirects to `https://` | |
| 1.3 | `GET /api/system/public` returns `200` with JSON | |
| 1.4 | `GET /` returns the React SPA HTML | |
| 1.5 | All four containers are **Up** and healthy | |

### Authentication

| # | Check | Pass? |
|---|---|---|
| 2.1 | Admin login succeeds and shows the Admin dashboard | |
| 2.2 | Reviewer login succeeds and shows the Assignments page | |
| 2.3 | Student login succeeds and shows the Submissions page | |
| 2.4 | Invalid credentials show an error message | |
| 2.5 | Logout clears session and redirects to `/login` | |

### Submission lifecycle

| # | Check | Pass? |
|---|---|---|
| 3.1 | Student creates a new submission (draft) | |
| 3.2 | Student uploads a PDF and submits for review | |
| 3.3 | Coordinator sees the submission and assigns a reviewer | |
| 3.4 | Reviewer sees the assignment and submits a decision | |
| 3.5 | Student receives a notification and sees the updated status | |
| 3.6 | Student can withdraw an active submission | |
| 3.7 | Coordinator can cancel an active submission | |

### Admin functions

| # | Check | Pass? |
|---|---|---|
| 4.1 | Admin creates a new user via User Management | |
| 4.2 | Admin triggers a backup and downloads it | |
| 4.3 | Audit Log shows recent events | |
| 4.4 | Send Test Email succeeds | |
