# CityU Research Review Portal — Bare-Metal VM Deployment Guide (Production)

> **Audience:** Sysadmins deploying the portal natively (no Docker) on an Ubuntu VM in **production**.
> **Scope:** Bare-metal / VM deployment only. For a Docker Compose deployment see [DEPLOYMENT-DOCKER.md](DEPLOYMENT-DOCKER.md).
> **Last updated:** August 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Production Deployment](#3-production-deployment)
4. [Directory Layout](#4-directory-layout)
5. [Environment Variables](#5-environment-variables)
6. [SSL / HTTPS](#6-ssl--https)
7. [Behind Azure Application Gateway](#7-behind-azure-application-gateway)
8. [First-Time Configuration](#8-first-time-configuration)
9. [Updating the Application](#9-updating-the-application)
10. [Rollback](#10-rollback)
11. [Backups](#11-backups)
12. [Test / UAT Deployment (seeds all users and programs)](#12-test--uat-deployment-seeds-all-users-and-programs)
13. [Post-Deployment Validation](#13-post-deployment-validation)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Architecture Overview

The app runs as native system services — no containers.

```
Browser (HTTPS :443)
    |
    v
[Host Nginx]  ← serves the SPA and reverse-proxies /api to PHP-FPM
    |           (TLS terminates here unless an upstream gateway does — see §7)
    |
    +-- /*      -> React SPA static files (/var/www/rrp/frontend-dist/)
    +-- /api/*  -> Laravel 11 via PHP-FPM (unix socket)
                       |
                       +-- PostgreSQL 16   (system service)
                       +-- Redis 7         (system service)
                       +-- Supervisor      -> php artisan queue:work
                       +-- Cron            -> php artisan schedule:run
```

| Component | Detail |
|---|---|
| App user | `rrp` |
| Source checkout | `/opt/rrp/source` (git working tree) |
| Served backend | `/var/www/rrp/backend` (contains `.env`, `vendor/`, `storage/`) |
| Served frontend | `/var/www/rrp/frontend-dist` (built SPA) |
| PHP-FPM | `php8.4-fpm` |
| Web server | host nginx |

---

## 2. Prerequisites

- Ubuntu 22.04 LTS, 24.04 LTS, or newer (e.g. 26.04)
- Minimum 2 vCPU, 2 GB RAM, 20 GB disk
- Root / sudo access
- Ports 80 and 443 open inbound (or restricted to the load-balancer subnet — see §7)
- A real domain with an A-record pointing at the VM *before* enabling HTTPS

---

## 3. Production Deployment

`deploy/install.sh` installs PHP, PostgreSQL, Redis, Nginx, Supervisor, and Certbot as native services, then deploys the app.

### Step 1 — Clone the repository

```bash
sudo git clone https://github.com/vejendlakirankumar/CityU-Research-Tracker.git /opt/rrp/source
cd /opt/rrp/source
```

### Step 2 — Run the installer

**With automatic Let's Encrypt SSL:**

```bash
sudo bash deploy/install.sh \
  --domain portal.myorg.com \
  --email  your-email@example.com
```

**Plain HTTP (e.g. TLS terminates upstream — see §7):**

```bash
sudo bash deploy/install.sh --domain portal.myorg.com --skip-ssl
```

### install.sh options

| Option | Description |
|---|---|
| `--domain DOMAIN` | Public domain name — used in `APP_URL` and the Nginx vhost |
| `--email EMAIL` | Admin email for Let's Encrypt and the seed admin account |
| `--skip-ssl` | Skip TLS provisioning (configure SSL later or terminate upstream) |
| `--dev` | Convenience HTTP-only mode (domain can be omitted) |

### What the installer does

1. Installs PHP 8.4-FPM, Composer, Nginx, PostgreSQL, Redis, Node 20, Certbot
2. Creates system user `rrp` and `/var/www/rrp/`
3. Copies application files; installs Composer and npm dependencies
4. Creates the PostgreSQL database and user with a random password
5. Generates `APP_KEY`; writes `/var/www/rrp/backend/.env`
6. Runs database migrations (and seeds — see the production note below)
7. Configures the PHP-FPM pool, Nginx vhost, and Supervisor queue worker
8. Obtains a Let's Encrypt certificate (if `--domain` set and DNS is live)
9. Installs a daily cron for `php artisan schedule:run`

> **Production seeding note:** `install.sh` seeds demo accounts by default. For a clean production database, after install run a fresh migrate without seeds, or purge the seeded demo users and keep only your real admin. Seeding is intended for the [Test / UAT deployment](#12-test--uat-deployment-seeds-all-users-and-programs).

**Compatibility notes:**
- On Ubuntu 22.04/24.04, PHP 8.4 installs via `ppa:ondrej/php`. On newer codenames where the PPA (or PGDG/Redis upstream) is not yet published, the script falls back to distro packages.
- Re-running the installer rotates the DB app-user password and updates `.env` to match.

After installation the portal runs as a system service and restarts on reboot. The SPA is served at the site root.

---

## 4. Directory Layout

This guide assumes the two-tree layout used in production: a **git source checkout** that you pull into, and a **served copy** that nginx/PHP-FPM read from.

| Path | Owner | Purpose |
|---|---|---|
| `/opt/rrp/source` | `rrp` | Git working tree — `git pull` here |
| `/var/www/rrp/backend` | `rrp` | Served Laravel app — holds `.env`, `vendor/`, `storage/` |
| `/var/www/rrp/frontend-dist` | `rrp` | Served built SPA |

> **Ownership matters.** If you cloned `/opt/rrp/source` as `root`, hand it to `rrp` so pulls and builds work without `sudo`:
> ```bash
> sudo chown -R rrp:rrp /opt/rrp/source
> ```

---

## 5. Environment Variables

The served `.env` is at **`/var/www/rrp/backend/.env`**. After editing, reload:

```bash
cd /var/www/rrp/backend
sudo -u rrp env HOME=/tmp php artisan config:cache
sudo systemctl reload php8.4-fpm
```

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_KEY` | Yes | — | 32-byte base64 key. Auto-generated by the installer |
| `APP_ENV` | Yes | `production` | Must be `production` in prod |
| `APP_DEBUG` | Yes | `false` | Must be `false` in prod |
| `APP_URL` | Yes | — | Full public URL (no trailing slash) |
| `LOG_CHANNEL` | — | `stack` | Logs at `/var/www/rrp/backend/storage/logs/laravel.log` |
| `LOG_LEVEL` | — | `error` | Use `debug` only when troubleshooting |

### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | Yes | `127.0.0.1` | Local PostgreSQL |
| `DB_DATABASE` | Yes | `rrp_production` | Database name |
| `DB_USERNAME` | Yes | `rrp_app` | Database user |
| `DB_PASSWORD` | Yes | — | Set by the installer |

### Cache / Queue / Auth / Email / Storage

Same keys as the Docker guide, except `REDIS_HOST=127.0.0.1`. See [DEPLOYMENT-DOCKER.md §4](DEPLOYMENT-DOCKER.md#4-environment-variables) for the full table (Redis, Sanctum, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE`, `SANCTUM_TOKEN_TTL_MINUTES`, `EMERGENCY_ADMIN_PASSWORD`, `ENABLE_EMERGENCY_ADMIN`, `MAIL_*`, `FILESYSTEM_DISK`, Azure/S3).

---

## 6. SSL / HTTPS

> Skip this section if TLS terminates at an upstream load balancer — see [Section 7](#7-behind-azure-application-gateway).

`install.sh --domain … --email …` provisions Let's Encrypt automatically. To add or re-issue a certificate manually:

```bash
sudo certbot --nginx -d portal.myorg.com -m your-email@example.com --agree-tos --no-eff-email
```

**Standalone fallback** (if the nginx challenge path is blocked upstream):

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone --preferred-challenges http \
  -d portal.myorg.com -m your-email@example.com --agree-tos --no-eff-email --non-interactive
sudo systemctl start nginx
```

### Existing / corporate certificate

```bash
sudo mkdir -p /etc/letsencrypt/live/portal.myorg.com
sudo cp fullchain.pem /etc/letsencrypt/live/portal.myorg.com/fullchain.pem
sudo cp privkey.pem   /etc/letsencrypt/live/portal.myorg.com/privkey.pem
sudo bash deploy/apply-ssl-vhost.sh portal.myorg.com
```

### Renewal

```bash
sudo certbot renew --quiet
sudo systemctl reload nginx
```

### Upload size limit

In the nginx vhost set `client_max_body_size 100M;`, then `sudo systemctl reload nginx`.

---

## 7. Behind Azure Application Gateway

Use this when TLS terminates at an **Azure Application Gateway** (or any external L7 LB / WAF) and public DNS points at the gateway — e.g. `https://rrp.cityu.edu` resolves to the gateway, which forwards to the VM over the private network.

> **Key difference:** the VM does **not** terminate TLS. Do **not** run certbot. The certificate lives on the gateway.

```
Browser ── HTTPS ──▶ Azure Application Gateway ── HTTP ──▶ VM host nginx:80
   https://rrp.cityu.edu   (TLS terminates here)     private IP, plain HTTP
```

### Step 1 — Install on plain HTTP

```bash
sudo bash deploy/install.sh --domain rrp.cityu.edu --skip-ssl
```

### Step 2 — Point the app at the public HTTPS URL

`--skip-ssl` writes `APP_URL` as `http://…`; flip it to HTTPS. (`SESSION_DOMAIN` and `SANCTUM_STATEFUL_DOMAINS` are already correct.)

```bash
cd /var/www/rrp/backend
sudo -u rrp sed -i 's|^APP_URL=.*|APP_URL=https://rrp.cityu.edu|' .env
grep -q '^SESSION_SECURE_COOKIE=' .env \
  && sudo -u rrp sed -i 's/^SESSION_SECURE_COOKIE=.*/SESSION_SECURE_COOKIE=true/' .env \
  || echo 'SESSION_SECURE_COOKIE=true' | sudo -u rrp tee -a .env
sudo -u rrp env HOME=/tmp php artisan config:cache
sudo systemctl reload php8.4-fpm
```

The backend trusts `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-For` (configured in `backend/bootstrap/app.php`), so it generates `https://` links and records real client IPs.

### Step 3 — Configure the Application Gateway

| Component | Setting |
|---|---|
| **Listener** | HTTPS on 443 with the cert for `rrp.cityu.edu` (PFX upload or Key Vault) |
| **Backend pool** | The VM's **private** IP |
| **Backend HTTP setting** | Protocol **HTTP**, port **80**. Request timeout **≥ 120s**. Cookie affinity **not required** |
| **Health probe** | Protocol **HTTP**, path **`/api/system/public`**, status **200–399**, host `rrp.cityu.edu` |
| **Redirect** | HTTP (80) listener + rule to force HTTP → HTTPS at the gateway |
| **Max request body size** (WAF SKU) | Raise to **≥ 50 MB** for document uploads |

### Step 4 — Lock down the VM network

- In the VM's **NSG**, allow inbound HTTP (80) **only from the Application Gateway subnet**; deny from the public Internet.
- Keep SSH (22) restricted to admin IPs.
- Do **not** open 443 on the VM.

Because the backend trusts `X-Forwarded-*` from any proxy, this NSG restriction is what prevents header spoofing.

### Step 5 — Validate

```bash
curl -I https://rrp.cityu.edu/api/system/public               # HTTP 200 + JSON (from the internet)
curl -i http://localhost/api/system/public                    # HTTP 200 + JSON (on the VM)
```

Confirm login works from `https://rrp.cityu.edu` and links stay HTTPS (no mixed-content).

---

## 8. First-Time Configuration

### Create the first admin account

```bash
cd /var/www/rrp/backend
sudo -u rrp env HOME=/tmp php artisan tinker <<'PHP'
\App\Models\User::create([
    'email' => 'your-admin@example.com',
    'name' => 'Admin User',
    'password_hash' => \Illuminate\Support\Facades\Hash::make('your-secure-password-here'),
    'is_active' => 1,
    'email_verified_at' => now(),
    'roles' => ['admin'],
]);
echo 'Admin created', PHP_EOL;
PHP
```

> `HOME=/tmp` is required for tinker/PsySH on the VM. The password policy requires **≥ 12 chars incl. uppercase, number, and special character** once configured — choose a compliant password.

### Emergency admin break-glass mode

`emergency.admin@system.local` is active only when there are no other active admins. To force-enable during an outage:

```bash
cd /var/www/rrp/backend
grep -q '^ENABLE_EMERGENCY_ADMIN=' .env \
  && sudo -u rrp sed -i 's/^ENABLE_EMERGENCY_ADMIN=.*/ENABLE_EMERGENCY_ADMIN=true/' .env \
  || echo 'ENABLE_EMERGENCY_ADMIN=true' | sudo -u rrp tee -a .env
sudo -u rrp env HOME=/tmp php artisan config:clear
```

Set back to `false` after recovery.

### Post-login checklist

**Required:** change the admin password · create user accounts · set organisation name · configure email (SMTP + test) · set timezone.
**Recommended:** configure password policy · add a Submission Category · set up SSO · enable daily backups · run `deploy/smoke-test-checklist.md`.

---

## 9. Updating the Application

Production uses a two-tree flow: **pull** into `/opt/rrp/source`, then **sync** into the served path. This preserves `.env`, `vendor/`, and `storage/`.

### Backend update

```bash
# 1) Pull latest source
cd /opt/rrp/source
sudo -u rrp git pull --ff-only origin main

# 2) Install any new PHP dependencies (skip if composer.lock unchanged)
sudo -u rrp composer install --no-dev --optimize-autoloader --working-dir=/opt/rrp/source/backend

# 3) Sync app code into the served backend (preserves .env, vendor, storage)
sudo rsync -a /opt/rrp/source/backend/app/ /var/www/rrp/backend/app/
sudo chown -R rrp:rrp /var/www/rrp/backend/app

# 4) Run migrations, clear + rebuild caches, reload PHP
cd /var/www/rrp/backend
sudo -u rrp env HOME=/tmp php artisan migrate --force
sudo -u rrp env HOME=/tmp php artisan optimize:clear
sudo -u rrp env HOME=/tmp php artisan config:cache
sudo systemctl reload php8.4-fpm
```

> For a broader update that touched files outside `backend/app/` (config, routes, migrations), rsync the whole backend but keep the served state:
> ```bash
> sudo rsync -a --exclude='.env' --exclude='storage/' --exclude='vendor/' \
>   /opt/rrp/source/backend/ /var/www/rrp/backend/
> sudo chown -R rrp:rrp /var/www/rrp/backend
> ```

### Frontend update

```bash
cd /opt/rrp/source/frontend
sudo -u rrp npm ci          # use 'npm install' if package-lock is out of sync
sudo -u rrp npm run build
sudo rsync -a --delete dist/ /var/www/rrp/frontend-dist/
sudo chown -R rrp:rrp /var/www/rrp/frontend-dist
```

> `npm ci` requires `package-lock.json` to match `package.json` exactly; if it errors with *"Missing … from lock file"*, use `npm install` (it reconciles the lock and installs devDependencies such as `tsc`, which the build needs).

### Restart the queue worker after any backend change

```bash
sudo supervisorctl restart all
```

---

## 10. Rollback

```bash
sudo bash /opt/rrp/source/deploy/rollback.sh                 # interactive
sudo bash /opt/rrp/source/deploy/rollback.sh --db-only
sudo bash /opt/rrp/source/deploy/rollback.sh --app-only
```

**Code rollback** (revert the source tree and re-sync):

```bash
cd /opt/rrp/source
sudo -u rrp git checkout <previous-good-commit>
sudo rsync -a --exclude='.env' --exclude='storage/' --exclude='vendor/' \
  /opt/rrp/source/backend/ /var/www/rrp/backend/
cd /var/www/rrp/backend
sudo -u rrp env HOME=/tmp php artisan optimize:clear
sudo systemctl reload php8.4-fpm
```

**Migration-only rollback:**

```bash
cd /var/www/rrp/backend
sudo -u rrp env HOME=/tmp php artisan migrate:rollback --step=1 --force
```

> Always take a fresh backup before rolling back.

---

## 11. Backups

```bash
sudo bash /opt/rrp/source/deploy/backup.sh                   # timestamped .tar.gz in /opt/rrp-backups/
sudo bash /opt/rrp/source/deploy/backup.sh --keep-days 30
sudo bash /opt/rrp/source/deploy/backup.sh --db-only
```

Daily automated backup (`/etc/crontab`, runs 02:00 as root):

```
0 2 * * * root bash /opt/rrp/source/deploy/backup.sh --keep-days 14 >> /var/log/rrp-backup.log 2>&1
```

---

## 12. Test / UAT Deployment (seeds all users and programs)

Use this for a **test / UAT VM** where you want the database pre-populated with demo users, programs, workflows, and submission categories. **Do not seed a production database.**

### Option 1 — Seed at install time

`install.sh` seeds by default, so a standard install on a throwaway VM produces a fully seeded environment:

```bash
sudo git clone https://github.com/vejendlakirankumar/CityU-Research-Tracker.git /opt/rrp/source
cd /opt/rrp/source
sudo bash deploy/install.sh --domain uat.myorg.com --email your-email@example.com
```

### Option 2 — Seed an existing deployment

```bash
cd /var/www/rrp/backend

# PRODUCTION: seed application configuration ONLY (feature flags, notification
# templates, stage templates, workflows, submission types, programs, org/email/
# password settings). Idempotent and safe to re-run — never creates demo users
# and never overwrites values you've edited in the admin UI.
sudo -u rrp env HOME=/tmp php artisan db:seed --class=AppConfigSeeder --force

# UAT/DEMO ONLY: seed EVERYTHING incl. demo users (admin@cityu.edu, etc.)
sudo -u rrp env HOME=/tmp php artisan db:seed --force

# …or seed individual datasets
sudo -u rrp env HOME=/tmp php artisan db:seed --class=UsersSeeder --force      # demo users (UAT only)
sudo -u rrp env HOME=/tmp php artisan db:seed --class=ProgramsSeeder --force   # all programs
sudo -u rrp env HOME=/tmp php artisan db:seed --class=SubmissionTypeSeeder --force
```

### Verify seeded data

```bash
sudo -u rrp env HOME=/tmp php artisan db:show --counts
```

Expect non-zero rows in `users`, `programs`, `submission_types`, `workflow_definitions`, `stage_templates`.

### Seeded accounts

All seeded users share the password **`admin12345`** (override with the `SEED_PASSWORD` env var) — change or disable them before any real use.

| Role | Emails |
|---|---|
| Administrator | `admin@cityu.edu` |
| Coordinator | `coordinator@cityu.edu`, `coordinator1..3@cityu.edu` |
| Reviewer | `reviewer@cityu.edu`, `reviewer1..3@cityu.edu` |
| Committee Reviewer | `committee1..3@cityu.edu` |
| Director (Reviewer role) | `director1..3@cityu.edu` |
| Student | `student@cityu.edu`, `student1..3@cityu.edu` |

> **⚠️ Never run the seeders against production.** If a test build is promoted to production, wipe the database and re-migrate clean, then create the admin account manually per [Section 8](#8-first-time-configuration).

---

## 13. Post-Deployment Validation

### Core services

```bash
sudo systemctl status nginx --no-pager
sudo systemctl status php8.4-fpm --no-pager
sudo systemctl status postgresql --no-pager
sudo systemctl status redis-server --no-pager
sudo supervisorctl status                                    # worker = RUNNING
```

### Application

```bash
curl -fsS http://localhost/api/system/public                 # HTTP 200 + JSON
sudo -u rrp env HOME=/tmp php /var/www/rrp/backend/artisan about --only=environment  # production
```

Then confirm from a browser:
1. Login works with an admin account.
2. `GET /api/system/public` returns HTTP 200 + JSON.
3. A small file upload succeeds.
4. A queued notification is processed.
5. No repeating errors in `storage/logs/laravel.log` for 5–10 minutes after first login.

### HTTPS checks (VM-terminated TLS only)

```bash
sudo ls -la /etc/letsencrypt/live/portal.myorg.com
sudo nginx -t
curl -I https://portal.myorg.com/
sudo certbot renew --dry-run
```

### Security cleanup before go-live

1. Change all default/seeded passwords.
2. Set real SMTP credentials and send a test email.
3. Confirm `APP_DEBUG=false`.
4. Restrict SSH and database exposure by IP/network policy.
5. Ensure backups are scheduled and tested once.

---

## 14. Troubleshooting

On a bare-metal VM the app is served by **host nginx** proxying to **PHP-FPM**, with the SPA from `/var/www/rrp/frontend-dist`. Work through this table if a fresh VM shows the wrong response.

| Symptom | Cause | Fix |
|---|---|---|
| `GET /` returns the **nginx welcome page**; `GET /api/...` returns nginx 404 | App vhost not enabled — only stock `default` site active | Enable the app vhost (Fix A) |
| `GET /api/system/public` returns a **Laravel 500** | DB not migrated (`migrate:status` says *"table not found"*) | Run migrations (Fix B) |
| Browser shows the **nginx welcome page** instead of the UI | Frontend never built — `/var/www/rrp/frontend-dist` missing/empty | Build the SPA (Fix C) |
| API works but `Access-Control-Allow-Origin` is `http://…` | `APP_URL` still `http://` | Flip `APP_URL` to HTTPS (§7 Step 2) |
| Save actions fail with a generic error; log shows a rewritten-query / RI error | Stale served code or cached config | Re-sync `backend/app/`, then `optimize:clear` + `config:cache` + reload php8.4-fpm |

**Verify what's wrong first:**

```bash
ls -l /etc/nginx/sites-enabled/                                # expect 'rrp', NOT 'default'
curl -i http://localhost/api/system/public                     # 404=vhost, 500=DB, 200=OK
cd /var/www/rrp/backend && sudo -u rrp env HOME=/tmp php artisan migrate:status
ls -la /var/www/rrp/frontend-dist/                             # must contain index.html + assets/
```

**Fix A — Create and enable the nginx vhost + PHP-FPM pool**

```bash
if [ ! -S /run/php/php8.4-fpm-rrp.sock ]; then
  tee /etc/php/8.4/fpm/pool.d/rrp.conf >/dev/null <<'EOF'
[rrp]
user = rrp
group = rrp
listen = /run/php/php8.4-fpm-rrp.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
pm.max_requests = 500
EOF
  systemctl restart php8.4-fpm
fi
SOCK=/run/php/php8.4-fpm-rrp.sock

tee /etc/nginx/sites-available/rrp >/dev/null <<EOF
server {
    listen 80 default_server;
    server_name rrp.cityu.edu;

    root /var/www/rrp/backend/public;
    index index.php;
    client_max_body_size 50M;

    location / {
        root /var/www/rrp/frontend-dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires 0;
    }
    location /assets/ {
        alias /var/www/rrp/frontend-dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location = /favicon.ico { alias /var/www/rrp/frontend-dist/favicon.ico; }

    location /api/     { try_files \$uri \$uri/ /index.php?\$query_string; }
    location /sanctum/ { try_files \$uri \$uri/ /index.php?\$query_string; }
    location /sso/     { try_files \$uri \$uri/ /index.php?\$query_string; }

    location /storage/ {
        alias /var/www/rrp/backend/storage/app/public/;
        expires 30d;
    }

    location ~ \.php\$ {
        fastcgi_pass unix:$SOCK;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;
    }
    location ~ /\.ht { deny all; }
}
EOF

ln -sf /etc/nginx/sites-available/rrp /etc/nginx/sites-enabled/rrp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

> `listen 80 default_server` makes the vhost answer regardless of the `Host` header the gateway sends (its health probe may not send `rrp.cityu.edu`).

**Fix B — Run database migrations**

```bash
cd /var/www/rrp/backend
chown -R rrp:rrp storage bootstrap/cache
sudo -u rrp env HOME=/tmp php artisan migrate --force
sudo -u rrp env HOME=/tmp php artisan config:cache
curl -i http://localhost/api/system/public                     # expect HTTP 200 + JSON
```

**Fix C — Build the frontend on the VM**

```bash
cd /opt/rrp/source/frontend
sudo -u rrp npm install            # use 'npm install' if package-lock is out of sync
sudo -u rrp npm run build
sudo mkdir -p /var/www/rrp/frontend-dist
sudo rsync -a --delete dist/ /var/www/rrp/frontend-dist/
sudo chown -R rrp:rrp /var/www/rrp/frontend-dist
```

After Fixes A–C and the §7 `APP_URL` flip, `curl -i http://localhost/api/system/public` should return `200` with `Access-Control-Allow-Origin: https://rrp.cityu.edu`, and `https://rrp.cityu.edu` should serve the login UI.
