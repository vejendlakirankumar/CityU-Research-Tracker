# CityU Research Review Portal v2 — Operations Manual

> **Audience:** System administrators and DevOps staff responsible for running the portal.

---

## Table of Contents

1. [Daily Health Checks](#1-daily-health-checks)
2. [Monitoring & Logs](#2-monitoring--logs)
3. [Backups](#3-backups)
4. [User Administration](#4-user-administration)
5. [System Configuration](#5-system-configuration)
6. [Queue Workers](#6-queue-workers)
7. [Email Configuration](#7-email-configuration)
8. [SSO Provider Management](#8-sso-provider-management)
9. [Feature Flags](#9-feature-flags)
10. [Upgrading the Application](#10-upgrading-the-application)
11. [Troubleshooting](#11-troubleshooting)
12. [Security Checklist](#12-security-checklist)

---

## 1. Daily Health Checks

### API health

```bash
# From the VM (API is bound to localhost inside Docker)
docker exec rrp_app curl -sf http://localhost/api/system/public | python3 -m json.tool
```

Expected response includes `org_name`, `portal_name`, `sso_enabled`.

### Container status

```bash
docker compose ps          # should show rrp_app, rrp_worker, postgres, redis as "Up"
docker stats --no-stream   # memory and CPU usage snapshot
```

### Queue depth

```bash
docker exec rrp_app php artisan queue:monitor redis:default,redis:notifications
```

### Disk usage

```bash
df -h
du -sh /opt/rrp-v2/
docker exec rrp_app du -sh /var/www/html/storage/app/uploads
```

---

## 2. Monitoring & Logs

### Application logs

```bash
# Laravel application log (inside container)
docker exec rrp_app tail -n 200 /var/www/html/storage/logs/laravel.log

# Follow in real time
docker exec rrp_app tail -f /var/www/html/storage/logs/laravel.log

# All container stdout
docker compose logs -f app
docker compose logs -f worker
```

### Nginx access and error logs

```bash
# Inside the container
docker exec rrp_app tail -n 100 /var/log/nginx/access.log
docker exec rrp_app tail -n 100 /var/log/nginx/error.log

# Host nginx (SSL termination layer)
sudo tail -n 100 /var/log/nginx/rrp-v2-access.log
sudo tail -n 100 /var/log/nginx/rrp-v2-error.log
```

### PostgreSQL logs

```bash
docker compose logs postgres
```

### Audit log (in-app)

All administrative and workflow actions are logged to the `audit_logs` table. View them via the portal:  
**Admin → Audit Log** (requires admin role)

Or query directly:

```bash
docker exec rrp_app php artisan tinker --execute="
App\Models\AuditLog::latest()->take(20)->get(['user_id','action','description','created_at'])
    ->each(fn(\$l) => print \$l->created_at.' '.\$l->action.' '.\$l->description.\"\n\");
"
```

---

## 3. Backups

### Automated backup (built-in)

Trigger a backup from the portal: **Admin → Settings → Backup & Archive → Run Backup Now**

Or from the command line:

```bash
docker exec rrp_app php artisan backup:run
```

This uses `spatie/laravel-backup` to create a zip containing:
- PostgreSQL dump (`pg_dump`)
- All files in `storage/app/`

Backups are stored in `storage/app/backups/` inside the container and on the mounted volume.

### Manual database dump

```bash
# Dump to a file on the host
docker exec rrp_postgres pg_dump -U rrp_app rrp_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from dump
docker exec -i rrp_postgres psql -U rrp_app rrp_production < backup_YYYYMMDD_HHMMSS.sql
```

### Standalone backup script

```bash
sudo bash /opt/rrp-v2/deploy/backup.sh
# Creates timestamped backup in /opt/rrp-backups/
```

### Backup rotation

The `backup.sh` script retains the last 14 daily backups. To change this, edit `KEEP_DAYS=14` in the script.

### Offsite backup

For Azure Blob Storage offsite backup, add to `.env`:

```
BACKUP_DISK=azure
AZURE_STORAGE_NAME=your-account
AZURE_STORAGE_KEY=your-key
AZURE_STORAGE_CONTAINER=rrp-backups
```

---

## 4. User Administration

### Create a user (portal UI)

**Admin → Users → + New User**

Fill in name, email, password, and assign roles. Password is emailed to the user if SMTP is configured.

### Create a user (CLI)

```bash
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::create([
    'name'       => 'New User',
    'first_name' => 'New',
    'last_name'  => 'User',
    'email'      => 'newuser@cityu.edu',
    'password'   => bcrypt('temporary123!'),
    'roles'      => ['student'],
    'status'     => 'active',
]);
print 'Done';
"
```

### Reset a user's password

```bash
# Via portal: Admin → Users → [user] → Reset Password
# Via CLI:
docker exec rrp_app php artisan tinker --execute="
\$user = \App\Models\User::where('email','user@cityu.edu')->firstOrFail();
\$user->update(['password' => bcrypt('NewPass123!')]);
print 'Done';
"
```

### Unlock a locked account

```bash
# Portal: Admin → Users → [user] → Unlock
# CLI:
docker exec rrp_app php artisan tinker --execute="
\App\Models\User::where('email','user@cityu.edu')->update([
    'login_attempts'  => 0,
    'locked_until'    => null,
]);
print 'Done';
"
```

### Promote a user to admin

```bash
docker exec rrp_app php artisan tinker --execute="
\$u = \App\Models\User::where('email','user@cityu.edu')->firstOrFail();
\$u->roles = array_unique(array_merge(\$u->roles ?? [], ['admin']));
\$u->save();
print 'Done';
"
```

### Emergency admin fallback

If all admin accounts are disabled/locked, the emergency admin activates automatically:  
Email: `emergency.admin@system.local`  Password: `admin12345`

Change the emergency password via the portal immediately after recovery.

---

## 5. System Configuration

All settings are managed via **Admin → Settings** (requires admin role).

| Tab | Key settings |
|---|---|
| **Organization** | Portal name, logo URL, primary colour, timezone, locale, date format |
| **Email** | SMTP driver, host, port, credentials, from address; send test email |
| **SSO Providers** | OIDC/OAuth2/SAML2 providers; enable/disable; auto-provision toggle |
| **Password & Security** | Password complexity, expiry, lockout policy, 2FA requirement |
| **Notifications** | Email notification templates per event type |
| **Feature Flags** | Enable/disable portal features without code changes |
| **Backup & Archive** | On-demand backup; list existing backups |

### Apply organisation branding

1. Go to **Settings → Organization**
2. Set **Primary Colour** (hex, e.g. `#1a3a6b`)
3. Set **Logo URL** (must be a publicly accessible image URL or upload via portal)
4. Save — changes apply immediately to the TopBar and Sidebar

---

## 6. Queue Workers

The `worker` container runs `php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600`.

### Restart the worker after a code change

```bash
docker compose restart worker
# or, gracefully:
docker exec rrp_app php artisan queue:restart
```

### Monitor failed jobs

```bash
docker exec rrp_app php artisan queue:failed
docker exec rrp_app php artisan queue:retry all    # retry all failed jobs
docker exec rrp_app php artisan queue:flush        # discard all failed jobs
```

### Scheduled tasks

Laravel's scheduler runs `php artisan schedule:run` every minute via a cron inside the container:

```bash
# View scheduled tasks
docker exec rrp_app php artisan schedule:list
```

---

## 7. Email Configuration

### Test SMTP settings

**Admin → Settings → Email → Send Test Email**

Or via CLI:

```bash
docker exec rrp_app php artisan tinker --execute="
Mail::raw('Test email from RRP v2', fn(\$m) => \$m->to('admin@cityu.edu')->subject('RRP Test'));
print 'Sent';
"
```

### Common SMTP providers

| Provider | Host | Port | Encryption |
|---|---|---|---|
| SendGrid | `smtp.sendgrid.net` | 587 | STARTTLS |
| Mailgun | `smtp.mailgun.org` | 587 | STARTTLS |
| Gmail | `smtp.gmail.com` | 587 | STARTTLS |
| Amazon SES | `email-smtp.us-east-1.amazonaws.com` | 587 | STARTTLS |
| Office 365 | `smtp.office365.com` | 587 | STARTTLS |

For SES, set `MAIL_MAILER=ses` and add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`.

---

## 8. SSO Provider Management

### Add an OIDC provider (e.g. Azure AD)

**Admin → Settings → SSO Providers → + Add Provider**

| Field | Azure AD Example |
|---|---|
| Protocol | OIDC |
| Name | `Azure Active Directory` |
| Client ID | Application (client) ID from Azure portal |
| Client Secret | From Azure portal → Certificates & secrets |
| Discovery URL | `https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration` |
| Scopes | `openid profile email` |
| Auto-provision users | ✅ (creates accounts for first-time SSO logins) |
| Default role | `student` |

### SAML2 provider

Requires `simplesamlphp/simplesamlphp` or `aacotroneo/laravel-saml2`. Contact the system administrator for SAML metadata setup.

### Callback URL

The SSO callback URL to register in your IdP is:

```
https://portal.cityu.edu/api/sso/{provider-uuid}/callback
```

---

## 9. Feature Flags

**Admin → Settings → Feature Flags**

| Flag | Default | Description |
|---|---|---|
| `submissions_enabled` | ✅ | Allow new submissions to be created |
| `reviews_enabled` | ✅ | Allow reviewers to submit decisions |
| `email_notifications` | ✅ | Send outbound email notifications |
| `audit_log_enabled` | ✅ | Write to the audit log table |
| `file_storage_s3` | ☐ | Use S3/Azure Blob instead of local disk |

---

## 10. Upgrading the Application

### Standard upgrade (Docker)

```bash
# Pull latest code
git -C /opt/rrp-v2 pull

# Rebuild containers and restart
cd /opt/rrp-v2
docker compose build --no-cache
docker compose up -d

# Run migrations
docker exec rrp_app php artisan migrate --force

# Clear caches
docker exec rrp_app php artisan config:cache
docker exec rrp_app php artisan route:cache
docker exec rrp_app php artisan view:cache
```

### Zero-downtime upgrade (blue-green)

For zero-downtime on a high-traffic instance, use the `deploy/update.sh` script with `--zero-downtime`:

```bash
bash /opt/rrp-v2/deploy/update.sh --zero-downtime
```

This starts a second container set on a different port, health-checks it, switches the Nginx upstream, then shuts down the old container set.

---

## 11. Troubleshooting

### Portal returns 500 / blank page

```bash
# Check Laravel logs
docker exec rrp_app tail -n 50 /var/www/html/storage/logs/laravel.log

# Check if APP_KEY is set
docker exec rrp_app php artisan key:show

# Check database connectivity
docker exec rrp_app php artisan db:show
```

### "419 CSRF token mismatch" on login

```bash
# Ensure SANCTUM_STATEFUL_DOMAINS matches the actual frontend domain
docker exec rrp_app php artisan config:show sanctum | grep stateful
```

### Queue jobs not processing

```bash
# Check worker is running
docker compose ps worker

# Check Redis connection
docker exec rrp_app php artisan tinker --execute="Cache::put('test','ok',10); print Cache::get('test');"

# Restart worker
docker compose restart worker
```

### File uploads failing

```bash
# Check storage is writable
docker exec rrp_app ls -la /var/www/html/storage/app/uploads

# Check storage link
docker exec rrp_app php artisan storage:link

# Check disk free space on host
df -h /opt/rrp-v2
```

### Container won't start

```bash
docker compose logs app
# Common causes:
#   - APP_KEY not set
#   - DB_PASSWORD wrong / postgres not ready yet
#   - Port 80 already in use on host
```

### Migrations fail

```bash
# Check current migration status
docker exec rrp_app php artisan migrate:status

# If there is a partial migration, reset that file manually and re-run
docker exec rrp_app php artisan migrate --force
```

---

## 12. Security Checklist

Run through this list after every fresh deployment:

- [ ] Change all default seed passwords (`admin@cityu.edu`, etc.)
- [ ] Set `APP_DEBUG=false` in `.env`
- [ ] Set `APP_ENV=production`
- [ ] Confirm `LOG_LEVEL=error` (not `debug`)
- [ ] Configure HTTPS and verify redirect from HTTP
- [ ] Set `SANCTUM_STATEFUL_DOMAINS` to the exact production domain
- [ ] Restrict database port (5432) to localhost only in firewall
- [ ] Restrict Redis port (6379) to localhost only in firewall
- [ ] Confirm SSH password auth is disabled (key-only)
- [ ] Verify `storage/` is not web-accessible directly
- [ ] Enable audit logging flag in Settings
- [ ] Review password policy (minimum length, complexity, expiry)
- [ ] Rotate `APP_KEY` if the `.env.example` key was ever committed
- [ ] Set up offsite backup destination (Azure Blob / S3)
- [ ] Test backup restore procedure in staging before going live
