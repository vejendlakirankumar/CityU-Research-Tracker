# CityU Research Review Portal — Docker Deployment Guide (Production)

> **Audience:** Sysadmins deploying the portal to a **production** server with Docker Compose.
> **Scope:** Docker-based deployment only. For a native, non-Docker install see [DEPLOYMENT-VM.md](DEPLOYMENT-VM.md).
> **Last updated:** August 2026

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Production Deployment](#3-production-deployment)
4. [Environment Variables](#4-environment-variables)
5. [SSL / HTTPS](#5-ssl--https)
6. [Behind Azure Application Gateway](#6-behind-azure-application-gateway)
7. [First-Time Configuration](#7-first-time-configuration)
8. [Updating the Application](#8-updating-the-application)
9. [Rollback](#9-rollback)
10. [Backups](#10-backups)
11. [Test / UAT Deployment (seeds all users and programs)](#11-test--uat-deployment-seeds-all-users-and-programs)
12. [Post-Deployment Validation](#12-post-deployment-validation)

---

## 1. Architecture Overview

```
Browser (HTTPS :443)
    |
    v
[Host Nginx]  ← installed on the host OS by ssl-setup.sh (SSL mode only)
    |           SSL termination, HSTS, reverse proxy
    |           Ports 80 (redirect) + 443 (HTTPS)
    | HTTP proxies to → 127.0.0.1:8080 (when SSL enabled)
    |                → 127.0.0.1:80    (HTTP-only mode, no host nginx)
    v
[Docker: rrp_app]   Ubuntu 24.04 · PHP 8.4-FPM · Nginx (container)
  |               /*     -> React SPA  (/var/www/frontend/)
  |               /api/* -> Laravel 11 (PHP-FPM :9000)
    |
    +-- [Docker: rrp_worker]   php artisan queue:work
    +-- [Docker: rrp_postgres] PostgreSQL 16  (volume: pgdata)
    +-- [Docker: rrp_redis]    Redis 7        (volume: redis_data)
```

> **Two-layer nginx (SSL mode):** There are two separate nginx instances. The **host nginx** (Ubuntu package) owns ports 80/443, terminates TLS, and proxies plain HTTP to the container on port 8080. The **container nginx** (inside Docker) serves the React SPA and routes `/api/*` to PHP-FPM. In HTTP-only mode there is no host nginx — Docker binds port 80 directly.

**Docker image** is built from the repo's `Dockerfile` in three stages:

| Stage | Base | What it does |
|---|---|---|
| `frontend-builder` | Node 22 Alpine | `npm run build` — React SPA static files |
| `composer-builder` | Composer 2 | `composer install --no-dev` |
| Runtime | Ubuntu 24.04 | PHP 8.4-FPM + Nginx; copies artefacts from both stages |

---

## 2. Prerequisites

| Requirement | Minimum | Check |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose | v2 (plugin) | `docker compose version` |
| RAM | 2 GB free | `free -h` |
| Disk | 5 GB free | `df -h` |
| Ports | 80 and 443 open inbound | — |

Works on: Ubuntu, Debian, Fedora, RHEL, macOS (Docker Desktop), Windows WSL 2.
Install Docker: https://docs.docker.com/engine/install/

**Production requires a real domain** with an A-record pointing at the server *before* you enable HTTPS.

---

## 3. Production Deployment

`deploy/quick-start-docker.sh` handles everything: generates `.env`, builds images, starts containers, runs migrations, and optionally provisions SSL.

> **Production rule:** always deploy with `--no-seed`. You will create the first admin account manually (see [First-Time Configuration](#7-first-time-configuration)). Seeding is reserved for the [Test / UAT deployment](#11-test--uat-deployment-seeds-all-users-and-programs).

### Step 1 — Clone the repository

```bash
git clone https://github.com/vejendlakirankumar/CityU-Research-Tracker.git
cd CityU-Research-Tracker
```

### Step 2 — Deploy with a domain + automatic SSL

```bash
export ADMIN_EMAIL=your-email@example.com
sudo bash deploy/quick-start-docker.sh \
  --domain portal.myorg.com \
  --https \
  --no-seed
```

The `--https` flag binds Docker to port **8080**, sets `APP_URL=https://portal.myorg.com`, and runs `ssl-setup.sh` (host nginx + Let's Encrypt) after the containers are healthy.

**Deploy on plain HTTP** (e.g. when TLS terminates upstream — see [Section 6](#6-behind-azure-application-gateway)):

```bash
sudo bash deploy/quick-start-docker.sh --domain portal.myorg.com --no-seed
```

### Script options

| Option | Default | Description |
|---|---|---|
| `--domain DOMAIN` | `localhost` | Public hostname or IP used in `APP_URL` and cookie config |
| `--port PORT` | `80` | Host port Docker binds (auto-overridden to `8080` when `--https` is used) |
| `--https` | off | Provision Let's Encrypt cert after start. Requires `ADMIN_EMAIL`, real domain with live DNS, ports 80+443 open, root |
| `--no-seed` | off | **Use for production.** Skip demo account seeding |
| `--env-file FILE` | — | Use an existing `.env` instead of auto-generating one |

### What the script does

1. Checks Docker and Docker Compose are installed
2. Generates `.env` with random `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD` (skipped if `.env` exists)
3. Sets `APP_URL`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS` from `--domain`
4. Runs `docker compose up -d --build`
5. Waits until `rrp_app` is healthy
6. Runs `php artisan migrate --force`
7. Optionally seeds demo accounts (skipped with `--no-seed`)
8. Optionally runs `deploy/ssl-setup.sh` (host nginx + Let's Encrypt)
9. Prints the portal URL and useful commands

### Deploying to a remote VM from your workstation

`deploy/install-remote.sh` SSHes into a VM, copies your local checkout, and runs the Docker deployment there. This is the correct path for **private repositories** (no GitHub credentials needed on the server).

```bash
# Bash environment (WSL, Git Bash, macOS, Linux)
export VM_HOST=YOUR_VM_IP        # public IP or hostname
export VM_USER=azureadmin        # ubuntu, azureadmin, ec2-user, root, …
export SSH_KEY=~/.ssh/id_rsa     # or: export VM_PASS=YourPassword
bash deploy/install-remote.sh --domain portal.myorg.com --email your-email@example.com
```

| Option | Description |
|---|---|
| `--domain DOMAIN` | Required. Public domain name for the portal |
| `--email EMAIL` | Required. Admin email for Let's Encrypt |
| `--skip-ssl` | Skip SSL provisioning on the remote server |

The script installs Docker on the VM if missing, rsyncs the repo to `/opt/rrp-v2/`, generates `.env`, runs `docker compose up -d --build`, migrates, and (unless `--skip-ssl`) runs `ssl-setup.sh`.

> **Windows note:** `deploy/*.sh` are Bash scripts — run them from WSL or Git Bash. From native PowerShell, `ssh`/`scp` into the VM and run the deployment there instead.

### Manage the running stack

```bash
docker compose ps                       # container status + health
docker compose logs -f app              # app logs
docker compose logs -f worker           # queue worker logs
docker exec -it rrp_app bash            # shell into the app container
docker exec rrp_app php artisan <cmd>   # run any Artisan command
docker compose down                     # stop (data preserved in volumes)
docker compose down -v                  # stop and WIPE all data — DESTRUCTIVE
```

---

## 4. Environment Variables

The repo-root `.env` controls all runtime configuration. `quick-start-docker.sh` generates it. After editing, reload:

```bash
docker exec rrp_app php artisan config:cache
```

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `APP_KEY` | Yes | — | 32-byte base64 key. Auto-generated |
| `APP_ENV` | Yes | `production` | Must be `production` in prod |
| `APP_DEBUG` | Yes | `false` | Must be `false` in prod |
| `APP_URL` | Yes | `http://localhost` | Full public URL (no trailing slash) |
| `LOG_CHANNEL` | — | `stderr` | Use `stderr` in Docker; read via `docker logs rrp_app` |
| `LOG_LEVEL` | — | `error` | Use `debug` only when troubleshooting |

### Database

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | Yes | `postgres` | Docker service name |
| `DB_DATABASE` | Yes | `rrp_production` | Database name |
| `DB_USERNAME` | Yes | `rrp_app` | Database user |
| `DB_PASSWORD` | Yes | — | Strong random password |

### Cache / Queue

| Variable | Default | Description |
|---|---|---|
| `REDIS_HOST` | `redis` | Docker service name |
| `REDIS_PASSWORD` | — | Redis auth password (recommended) |
| `QUEUE_CONNECTION` | `redis` | Use `redis` in production |

### Auth / CORS

| Variable | Required | Description |
|---|---|---|
| `SANCTUM_STATEFUL_DOMAINS` | Yes | Frontend domain(s) — must match the browser URL bar exactly |
| `SESSION_DOMAIN` | Yes | Cookie domain |
| `SESSION_SECURE_COOKIE` | No | Set `true` when served over HTTPS |
| `SANCTUM_TOKEN_TTL_MINUTES` | No | Bearer-token lifetime. Defaults to the admin-configured session timeout, then 480 min. `0` = never expire (not recommended) |
| `EMERGENCY_ADMIN_PASSWORD` | No | Break-glass admin password. **Unset by default** — the emergency admin ships with a random unusable password until you set this. Set a strong value to enable break-glass login |
| `ENABLE_EMERGENCY_ADMIN` | No | Break-glass override. `true` forces `emergency.admin@system.local` active. Default unset/`false` |

### Email

| Variable | Default | Description |
|---|---|---|
| `MAIL_MAILER` | `log` | `log` (suppress), `smtp`, or `ses` |
| `MAIL_HOST` | — | SMTP hostname |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | — | SMTP username |
| `MAIL_PASSWORD` | — | SMTP password |
| `MAIL_FROM_ADDRESS` | — | Sender email address |

### File Storage

| Variable | Default | Description |
|---|---|---|
| `FILESYSTEM_DISK` | `local` | `local`, `azure`, or `s3` |
| `AZURE_STORAGE_NAME` | — | Azure Storage account name (if `azure`) |
| `AZURE_STORAGE_KEY` | — | Azure Storage account key |
| `AWS_ACCESS_KEY_ID` | — | AWS access key (if `s3`) |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `AWS_DEFAULT_REGION` | `us-east-1` | S3 region |
| `AWS_BUCKET` | — | S3 bucket name |

---

## 5. SSL / HTTPS

> Skip this section if TLS terminates at an upstream load balancer — see [Section 6](#6-behind-azure-application-gateway).

### Path A — Fresh install with HTTPS (recommended)

One command generates `.env`, builds containers, runs migrations, installs host nginx, and obtains the certificate:

```bash
export ADMIN_EMAIL=your-email@example.com
sudo bash deploy/quick-start-docker.sh --domain portal.myorg.com --https --no-seed
```

**Requirements:** domain A-record points to this server *before* running; ports 80 **and** 443 open; run as root; `ADMIN_EMAIL` set.

### Path B — Add HTTPS to an existing HTTP deployment

**Step 1 — Move Docker off port 80:**

```bash
cd ~/CityU-Research-Tracker
grep -q '^HOST_PORT=' .env && sed -i 's/^HOST_PORT=.*/HOST_PORT=8080/' .env || echo 'HOST_PORT=8080' >> .env
sed -i 's|^APP_URL=.*|APP_URL=https://portal.myorg.com|' .env
sed -i 's/^SESSION_DOMAIN=.*/SESSION_DOMAIN=portal.myorg.com/' .env
sed -i 's/^SANCTUM_STATEFUL_DOMAINS=.*/SANCTUM_STATEFUL_DOMAINS=portal.myorg.com/' .env
docker compose up -d
```

**Step 2 — Install host nginx, obtain certificate, configure SSL:**

```bash
sudo bash deploy/ssl-setup.sh portal.myorg.com your-email@example.com 8080
```

**Common failure — ACME connection timeout:** If certbot reports `Timeout during connect (likely firewall problem)`, either Docker is still on port 80 (redo Step 1) or port 80 is blocked in the cloud firewall/NSG (open it). If certbot reports `Connection reset by peer`, validate external reachability with `letsdebug.net`, then retry in standalone mode:

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone --preferred-challenges http \
  -d portal.myorg.com -m your-email@example.com --agree-tos --no-eff-email --non-interactive
sudo systemctl start nginx
```

### Renewal

`ssl-setup.sh` installs a daily cron at `/etc/cron.d/certbot-renew-rrp` (03:00). Manual:

```bash
sudo certbot renew --quiet
sudo systemctl reload nginx
```

### Upload size limit

Edit `deploy/nginx-vhost.conf`, set `client_max_body_size 100M;`, then `sudo systemctl reload nginx`.

---

## 6. Behind Azure Application Gateway

Use this when TLS terminates at an **Azure Application Gateway** (or any external L7 LB / WAF) and public DNS points at the gateway — e.g. `https://rrp.cityu.edu` resolves to the gateway, which forwards to the VM over the private network.

> **Key difference:** the VM does **not** terminate TLS. Do **not** pass `--https` and do **not** run `ssl-setup.sh`. The certificate lives on the gateway.

```
Browser ── HTTPS ──▶ Azure Application Gateway ── HTTP ──▶ VM Docker:80 (or :8080)
   https://rrp.cityu.edu   (TLS terminates here)     private IP, plain HTTP
```

### Step 1 — Deploy on plain HTTP

```bash
cd ~/CityU-Research-Tracker
# NO --https. Port must match the gateway backend HTTP setting port (Step 3).
bash deploy/quick-start-docker.sh --domain rrp.cityu.edu --no-seed
```

### Step 2 — Point the app at the public HTTPS URL

```bash
sed -i 's|^APP_URL=.*|APP_URL=https://rrp.cityu.edu|' .env
sed -i 's/^SESSION_DOMAIN=.*/SESSION_DOMAIN=rrp.cityu.edu/' .env
sed -i 's/^SANCTUM_STATEFUL_DOMAINS=.*/SANCTUM_STATEFUL_DOMAINS=rrp.cityu.edu/' .env
grep -q '^SESSION_SECURE_COOKIE=' .env \
  && sed -i 's/^SESSION_SECURE_COOKIE=.*/SESSION_SECURE_COOKIE=true/' .env \
  || echo 'SESSION_SECURE_COOKIE=true' >> .env
docker exec -w /var/www/html rrp_app php artisan config:cache
```

The backend trusts the proxy's `X-Forwarded-Proto` / `X-Forwarded-Host` / `X-Forwarded-For` headers (configured in `backend/bootstrap/app.php`), so it generates `https://` links, records real client IPs, and reports `$request->secure() === true`.

### Step 3 — Configure the Application Gateway

| Component | Setting |
|---|---|
| **Listener** | HTTPS on 443 with the cert for `rrp.cityu.edu` (PFX upload or Key Vault) |
| **Backend pool** | The VM's **private** IP |
| **Backend HTTP setting** | Protocol **HTTP**, port **80** (or **8080** if deployed with `--port 8080`). Request timeout **≥ 120s**. Cookie affinity **not required** |
| **Health probe** | Protocol **HTTP**, path **`/api/system/public`**, status **200–399**, host `rrp.cityu.edu` |
| **Redirect** | HTTP (80) listener + rule to force HTTP → HTTPS at the gateway |
| **Max request body size** (WAF SKU) | Raise to **≥ 50 MB** for document uploads |

### Step 4 — Lock down the VM network

- In the VM's **NSG**, allow inbound HTTP (80 / 8080) **only from the Application Gateway subnet**; deny from the public Internet.
- Keep SSH (22) restricted to admin IPs.
- Do **not** open 443 on the VM.

Because the backend trusts `X-Forwarded-*` from any proxy, this NSG restriction is what prevents header spoofing.

### Step 5 — Validate

```bash
curl -I https://rrp.cityu.edu/api/system/public   # HTTP 200 + JSON
docker exec -w /var/www/html rrp_app php artisan tinker --execute 'echo url("/"), PHP_EOL;'  # https://rrp.cityu.edu
```

Confirm login works from `https://rrp.cityu.edu`, links stay HTTPS (no mixed-content), and any SSO redirect URI is registered as `https://rrp.cityu.edu/...`.

---

## 7. First-Time Configuration

### Create the first admin account (after `--no-seed`)

```bash
cd /opt/rrp-v2
docker exec rrp_app php -r '
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make("Illuminate\Contracts\Console\Kernel")->bootstrap();
\App\Models\User::create([
    "email" => "your-admin@example.com",
    "name" => "Admin User",
    "password_hash" => bcrypt("your-secure-password-here"),
    "is_active" => 1,
    "email_verified_at" => now(),
    "roles" => ["admin"],
]);
echo "Admin created\n";
'
```

> The password policy requires **≥ 12 chars incl. uppercase, number, and special character** once configured. Choose a compliant password.

### Emergency admin break-glass mode

`emergency.admin@system.local` is active only when there are no other active admins. To force-enable during an outage:

```bash
cd /opt/rrp-v2
grep -q '^ENABLE_EMERGENCY_ADMIN=' .env \
  && sed -i 's/^ENABLE_EMERGENCY_ADMIN=.*/ENABLE_EMERGENCY_ADMIN=true/' .env \
  || echo 'ENABLE_EMERGENCY_ADMIN=true' >> .env
docker exec rrp_app php artisan config:clear
```

Set back to `false` after recovery.

### Post-login checklist

**Required:** change the admin password · create user accounts · set organisation name · configure email (SMTP + test) · set timezone.
**Recommended:** configure password policy · add a Submission Category · set up SSO · enable daily backups · run `deploy/smoke-test-checklist.md`.

---

## 8. Updating the Application

Use `deploy/update.sh` to push code changes and rebuild the remote Docker stack consistently.

```bash
VM_HOST=YOUR_VM_IP VM_USER=azureadmin bash deploy/update.sh                 # full update
VM_HOST=YOUR_VM_IP VM_USER=azureadmin bash deploy/update.sh --backend-only  # backend only
VM_HOST=YOUR_VM_IP VM_USER=azureadmin bash deploy/update.sh --frontend-only # frontend only, no migrations
```

**What it does:** rsyncs the repo → `docker compose up -d --build` → waits for `rrp_app` health → `php artisan migrate --force` (unless `--frontend-only`/`--no-migrate`) → rebuilds config/route caches → restarts queue worker → validates and reloads container nginx.

Manual cache clear:

```bash
docker exec rrp_app php artisan config:cache
docker exec rrp_app php artisan route:cache
docker exec rrp_app php artisan view:cache
docker exec rrp_app php artisan queue:restart
```

---

## 9. Rollback

```bash
sudo bash /opt/rrp-v2/deploy/rollback.sh                                     # interactive
sudo bash /opt/rrp-v2/deploy/rollback.sh --to /opt/rrp-backups/rrp-backup-20260422_020001.tar.gz
sudo bash /opt/rrp-v2/deploy/rollback.sh --db-only
sudo bash /opt/rrp-v2/deploy/rollback.sh --app-only
docker exec rrp_app php artisan migrate:rollback --step=1 --force            # migration only
```

> Always take a fresh backup before rolling back.

---

## 10. Backups

```bash
sudo bash /opt/rrp-v2/deploy/backup.sh                    # timestamped .tar.gz in /opt/rrp-backups/
sudo bash /opt/rrp-v2/deploy/backup.sh --keep-days 30     # retention
sudo bash /opt/rrp-v2/deploy/backup.sh --db-only          # DB dump only
AZURE_STORAGE_ACCOUNT=acct AZURE_STORAGE_KEY=key sudo bash /opt/rrp-v2/deploy/backup.sh --upload
```

Daily automated backup (`/etc/crontab`, runs 02:00 as root):

```
0 2 * * * root bash /opt/rrp-v2/deploy/backup.sh --keep-days 14 >> /var/log/rrp-backup.log 2>&1
```

---

## 11. Test / UAT Deployment (seeds all users and programs)

Use this for a **test / UAT environment** where you want the database pre-populated with demo users, programs, workflows, and submission categories. **Do not seed a production database.**

### Option 1 — Seed at deploy time

Deploy **without** `--no-seed`:

```bash
git clone https://github.com/vejendlakirankumar/CityU-Research-Tracker.git
cd CityU-Research-Tracker
bash deploy/quick-start-docker.sh --domain uat.myorg.com --https
```

### Option 2 — Seed an existing deployment

```bash
cd /opt/rrp-v2

# Seed EVERYTHING (users, programs, submission types, workflows, org settings)
docker exec rrp_app php artisan db:seed --force

# …or seed individual datasets
docker exec rrp_app php artisan db:seed --class=UsersSeeder --force      # all users
docker exec rrp_app php artisan db:seed --class=ProgramsSeeder --force   # all programs
docker exec rrp_app php artisan db:seed --class=SubmissionTypeSeeder --force
```

### Verify seeded data

```bash
docker exec rrp_app php artisan db:show --counts
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

> **⚠️ Never run the seeders against production.** If a test build is promoted to production, wipe the database and re-migrate clean, then create the admin account manually per [Section 7](#7-first-time-configuration).

---

## 12. Post-Deployment Validation

### Required checks

```bash
docker compose ps                                             # rrp_app = healthy
curl -fsS http://127.0.0.1:${HOST_PORT:-80}/api/system/public # HTTP-only: JSON
curl -kfsS https://127.0.0.1/api/system/public                # HTTPS: JSON
docker exec rrp_app php artisan about --only=environment      # Environment = production
docker compose logs --tail=50 worker                          # no crash loop
```

Then confirm from a browser:
1. Login works with an admin account.
2. `GET /api/system/public` returns HTTP 200 + JSON.
3. A small file upload succeeds.
4. A queued notification is processed.
5. No repeating errors in logs for 5–10 minutes after first login.

### HTTPS checks (when enabled on the VM)

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
