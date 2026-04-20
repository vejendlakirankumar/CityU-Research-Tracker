# CityU Research Review Portal v2 — Deployment Guide

> **Target OS:** Ubuntu 22.04 LTS (all production scripts assume this)  
> **Container runtime:** Docker Engine 25 + Docker Compose v2  
> **Live server:** Azure VM `172.206.114.248`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Option A — Docker Compose (recommended)](#3-option-a--docker-compose-recommended)
4. [Option B — Bare-Metal Linux (no Docker)](#4-option-b--bare-metal-linux-no-docker)
5. [Option C — Fresh Azure VM (automated)](#5-option-c--fresh-azure-vm-automated)
6. [SSL / HTTPS Setup](#6-ssl--https-setup)
7. [CI/CD with GitHub Actions](#7-cicd-with-github-actions)
8. [Incremental Updates](#8-incremental-updates)
9. [Rolling Back](#9-rolling-back)
10. [Database Migrations](#10-database-migrations)
11. [First-Time Seed Accounts](#11-first-time-seed-accounts)

---

## 1. Architecture Overview

```
Browser (HTTPS)
  └── Host Nginx (port 443) ── deploy/nginx-vhost.conf
        ↓  reverse-proxy to port 80
        └── Docker: rrp_app container (port 80 → internal 8080)
              ├── /app/*          React SPA  (static, /var/www/frontend/)
              ├── /api/*          Laravel API (PHP-FPM → port 9000)
              └── /sanctum/*      Sanctum auth endpoints

Supporting containers:
  postgres   — PostgreSQL 16  (volume: pg_data)
  redis      — Redis 7        (volume: redis_data)
  worker     — php artisan queue:work (email, notifications, escalation)
```

The **app** container is built from the repo's `Dockerfile`. It contains PHP 8.4-FPM, the compiled Laravel application, and Nginx (port 8080) serving the compiled React SPA from `/var/www/frontend/`.

---

## 2. Environment Variables Reference

Copy `backend/.env.example` → `backend/.env` (Docker) or `/var/www/rrp/backend/.env` (bare-metal).

| Variable | Required | Example / Default | Description |
|---|---|---|---|
| `APP_NAME` | | `Research Review Portal` | Displayed in emails |
| `APP_ENV` | ✅ | `production` | |
| `APP_KEY` | ✅ | `base64:...` | Run `php artisan key:generate` |
| `APP_DEBUG` | | `false` | Must be `false` in production |
| `APP_URL` | ✅ | `https://portal.cityu.edu` | Public URL (no trailing slash) |
| `DB_HOST` | ✅ | `postgres` (Docker) / `127.0.0.1` (bare-metal) | |
| `DB_PORT` | | `5432` | |
| `DB_DATABASE` | ✅ | `rrp_production` | |
| `DB_USERNAME` | ✅ | `rrp_app` | |
| `DB_PASSWORD` | ✅ | — | Strong random password |
| `REDIS_HOST` | ✅ | `redis` (Docker) / `127.0.0.1` (bare-metal) | |
| `REDIS_PASSWORD` | | — | Set if Redis has auth enabled |
| `QUEUE_CONNECTION` | | `redis` | |
| `SESSION_DRIVER` | | `redis` | |
| `SANCTUM_STATEFUL_DOMAINS` | ✅ | `portal.cityu.edu` | Frontend domain for Sanctum cookie auth |
| `SESSION_DOMAIN` | ✅ | `portal.cityu.edu` | Must match cookie domain |
| `MAIL_MAILER` | | `smtp` | `smtp`, `ses`, or `log` |
| `MAIL_HOST` | | `smtp.sendgrid.net` | |
| `MAIL_PORT` | | `587` | |
| `MAIL_USERNAME` | | — | |
| `MAIL_PASSWORD` | | — | |
| `MAIL_FROM_ADDRESS` | | `noreply@portal.cityu.edu` | |
| `MAIL_FROM_NAME` | | `Research Review Portal` | |
| `FILESYSTEM_DISK` | | `local` | `local` or `s3` |
| `AWS_BUCKET` | | — | Required if `FILESYSTEM_DISK=s3` |
| `LOG_LEVEL` | | `error` | |

---

## 3. Option A — Docker Compose (recommended)

### Prerequisites

- Docker Engine 25+ and Docker Compose v2
- 2 GB RAM, 20 GB disk minimum

### Steps

```bash
# 1. Clone or copy the repo
git clone https://github.com/your-org/CityU-Research-Tracker.git
cd CityU-Research-Tracker/v2

# 2. Create the environment file
cp backend/.env.example backend/.env
#    Edit at minimum: DB_PASSWORD, APP_URL, SANCTUM_STATEFUL_DOMAINS

# 3. Generate the app key and add to .env
docker compose run --rm app php artisan key:generate --show
#    Paste the output into .env as APP_KEY=base64:...

# 4. Start all services
docker compose up -d

# 5. First-time database setup
docker exec rrp_app php artisan migrate --force --seed
docker exec rrp_app php artisan storage:link

# 6. Verify
curl http://localhost/api/system/public
```

### Useful Docker commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f worker

# Open a shell in the app container
docker exec -it rrp_app bash

# Run Artisan commands
docker exec rrp_app php artisan tinker
docker exec rrp_app php artisan queue:restart

# Stop all services
docker compose down

# Stop and wipe volumes — DESTRUCTIVE (deletes database)
docker compose down -v
```

---

## 4. Option B — Bare-Metal Linux (no Docker)

The automated installer handles everything:

```bash
# On a fresh Ubuntu 22.04 server (requires root / sudo)
sudo bash deploy/install.sh --domain portal.cityu.edu --email admin@cityu.edu
```

### What `install.sh` does

1. Installs PHP 8.4-FPM, Composer, Nginx, PostgreSQL 16, Redis, Node 20, Certbot
2. Creates system user `rrp`, application directory `/var/www/rrp`
3. Copies application files; installs Composer and npm dependencies
4. Creates the PostgreSQL database and user
5. Generates `APP_KEY`; writes `/var/www/rrp/backend/.env`
6. Runs database migrations and seeds
7. Configures PHP-FPM pool, Nginx vhost, and Supervisor for queue workers
8. Obtains a Let's Encrypt TLS certificate (if `--domain` provided and DNS is live)
9. Sets up a daily cron for `php artisan schedule:run`

---

## 5. Option C — Fresh Azure VM (automated)

```bash
# From your local machine (requires WSL or Linux shell)
export VM_HOST=<public-ip>
export VM_USER=azureadmin
export VM_PASS=<password>   # or set SSH_KEY=~/.ssh/id_rsa

bash v2/deploy/install-remote.sh \
    --domain portal.cityu.edu \
    --email  admin@cityu.edu
```

This SSHes into the VM, installs Docker + Compose, copies the v2 directory, and runs `deploy/install.sh`.

---

## 6. SSL / HTTPS Setup

### Let's Encrypt (automated)

```bash
# DNS A record must already point to this server's IP
sudo bash deploy/ssl-setup.sh portal.cityu.edu admin@cityu.edu
```

Installs certbot, issues certificate, installs SSL Nginx vhost, schedules auto-renewal.

### Existing certificate

```bash
sudo cp fullchain.pem  /etc/ssl/rrp/fullchain.pem
sudo cp privkey.pem    /etc/ssl/rrp/privkey.pem
sudo cp deploy/nginx-vhost.conf /etc/nginx/sites-available/rrp
sudo sed -i 's/PORTAL_DOMAIN/portal.cityu.edu/g' /etc/nginx/sites-available/rrp
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. CI/CD with GitHub Actions

`.github/workflows/ci.yml` runs on every push/PR to `main` or `develop`:

| Job | Trigger | What it does |
|---|---|---|
| `backend` | every push/PR | PHPUnit with SQLite in-memory |
| `frontend` | every push/PR | `tsc --noEmit`, Vitest, `vite build` |
| `deploy` | push to `main` only | SSHes to VM; runs `deploy/update.sh` |

**Required GitHub Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `VM_HOST` | `172.206.114.248` |
| `VM_USER` | `azureadmin` |
| `VM_PASS` | SSH password |

---

## 8. Incremental Updates

```bash
# From the repo root on your dev machine
VM_HOST=172.206.114.248 VM_USER=azureadmin bash v2/deploy/update.sh
```

The update script:
1. Rsyncs changed backend PHP files to the VM (skipping `vendor/`, `.env`, `storage/`)
2. `docker cp`s into the running `rrp_app` container
3. Runs `php artisan migrate --force` and clears caches
4. Rebuilds the React SPA and reloads Nginx

---

## 9. Rolling Back

```bash
# Interactive rollback — lists available backups and prompts for selection
sudo bash /opt/rrp-v2/deploy/rollback.sh
```

Database-only rollback:

```bash
docker exec rrp_app php artisan migrate:rollback        # last batch
docker exec rrp_app php artisan migrate:rollback --step=2  # last 2 batches
```

---

## 10. Database Migrations

```bash
docker exec rrp_app php artisan migrate --force        # run pending
docker exec rrp_app php artisan migrate:status         # show status
docker exec rrp_app php artisan migrate:rollback       # undo last batch
docker exec rrp_app php artisan migrate:fresh --seed   # DROP ALL + re-seed (DESTRUCTIVE)
```

Migration files: `backend/database/migrations/YYYY_MM_DD_HHMMSS_description.php`

---

## 11. First-Time Seed Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cityu.edu` | `admin12345` |
| Coordinator | `coordinator@cityu.edu` | `admin12345` |
| Reviewer | `reviewer@cityu.edu` | `admin12345` |
| Student | `student@cityu.edu` | `admin12345` |

**Emergency admin:** If all admin accounts are locked, `emergency.admin@system.local` / `admin12345` activates automatically.

> ⚠️ Change all default passwords immediately after first login in production.


---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables Reference](#2-environment-variables-reference)
3. [Option A — Docker Compose (recommended)](#3-option-a--docker-compose-recommended)
4. [Option B — Bare-Metal Linux (no Docker)](#4-option-b--bare-metal-linux-no-docker)
5. [Option C — Fresh Azure VM (automated)](#5-option-c--fresh-azure-vm-automated)
6. [SSL / HTTPS Setup](#6-ssl--https-setup)
7. [CI/CD with GitHub Actions](#7-cicd-with-github-actions)
8. [Incremental Updates](#8-incremental-updates)
9. [Rolling Back](#9-rolling-back)
10. [Database Migrations](#10-database-migrations)
11. [First-Time Seed Accounts](#11-first-time-seed-accounts)

---

## 1. Architecture Overview

```
Browser (HTTPS)
  └── Host Nginx (port 443) ── deploy/nginx-vhost.conf
        ↓  reverse-proxy to port 80
        └── Docker: rrp_app container (port 80 → internal 8080)
              ├── /app/*          React SPA  (static, /var/www/frontend/)
              ├── /api/*          Laravel API (PHP-FPM → port 9000)
              └── /sanctum/*      Sanctum auth endpoints

Supporting containers:
  postgres   — PostgreSQL 16  (volume: pg_data)
  redis      — Redis 7        (volume: redis_data)
  worker     — php artisan queue:work (email, notifications, escalation)
```

The **app** container is built from the repo's `Dockerfile`. It contains PHP 8.4-FPM, the compiled Laravel application, and Nginx (port 8080) serving the compiled React SPA from `/var/www/frontend/`.

---

## 2. Environment Variables Reference

Copy `backend/.env.example` → `backend/.env` (Docker) or `/var/www/rrp/backend/.env` (bare-metal).

| Variable | Required | Example / Default | Description |
|---|---|---|---|
| `APP_NAME` | | `Research Review Portal` | Displayed in emails |
| `APP_ENV` | ✅ | `production` | |
| `APP_KEY` | ✅ | `base64:...` | Run `php artisan key:generate` |
| `APP_DEBUG` | | `false` | Must be `false` in production |
| `APP_URL` | ✅ | `https://portal.cityu.edu` | Public URL (no trailing slash) |
| `DB_HOST` | ✅ | `postgres` (Docker) / `127.0.0.1` (bare-metal) | |
| `DB_PORT` | | `5432` | |
| `DB_DATABASE` | ✅ | `rrp_production` | |
| `DB_USERNAME` | ✅ | `rrp_app` | |
| `DB_PASSWORD` | ✅ | — | Strong random password |
| `REDIS_HOST` | ✅ | `redis` (Docker) / `127.0.0.1` (bare-metal) | |
| `REDIS_PASSWORD` | | — | Set if Redis has auth enabled |
| `QUEUE_CONNECTION` | | `redis` | |
| `SESSION_DRIVER` | | `redis` | |
| `SANCTUM_STATEFUL_DOMAINS` | ✅ | `portal.cityu.edu` | Frontend domain for Sanctum cookie auth |
| `SESSION_DOMAIN` | ✅ | `portal.cityu.edu` | Must match cookie domain |
| `MAIL_MAILER` | | `smtp` | `smtp`, `ses`, or `log` |
| `MAIL_HOST` | | `smtp.sendgrid.net` | |
| `MAIL_PORT` | | `587` | |
| `MAIL_USERNAME` | | — | |
| `MAIL_PASSWORD` | | — | |
| `MAIL_FROM_ADDRESS` | | `noreply@portal.cityu.edu` | |
| `MAIL_FROM_NAME` | | `Research Review Portal` | |
| `FILESYSTEM_DISK` | | `local` | `local` or `s3` |
| `AWS_BUCKET` | | — | Required if `FILESYSTEM_DISK=s3` |
| `LOG_LEVEL` | | `error` | |

---

## 3. Option A — Docker Compose (recommended)

### Prerequisites

- Docker Engine 25+ and Docker Compose v2
- 2 GB RAM, 20 GB disk minimum

### Steps

```bash
# 1. Clone or copy the repo
git clone https://github.com/your-org/CityU-Research-Tracker.git
cd CityU-Research-Tracker/v2

# 2. Create the environment file
cp backend/.env.example backend/.env
#    Edit at minimum: DB_PASSWORD, APP_URL, SANCTUM_STATEFUL_DOMAINS

# 3. Generate the app key and add to .env
docker compose run --rm app php artisan key:generate --show
#    Paste the output into .env as APP_KEY=base64:...

# 4. Start all services
docker compose up -d

# 5. First-time database setup
docker exec rrp_app php artisan migrate --force --seed
docker exec rrp_app php artisan storage:link

# 6. Verify
curl http://localhost/api/system/public
```

### Useful Docker commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f worker

# Open a shell in the app container
docker exec -it rrp_app bash

# Run Artisan commands
docker exec rrp_app php artisan tinker
docker exec rrp_app php artisan queue:restart

# Stop all services
docker compose down

# Stop and wipe volumes — DESTRUCTIVE (deletes database)
docker compose down -v
```

---

## 4. Option B — Bare-Metal Linux (no Docker)

The automated installer handles everything:

```bash
# On a fresh Ubuntu 22.04 server (requires root / sudo)
sudo bash deploy/install.sh --domain portal.cityu.edu --email admin@cityu.edu
```

### What `install.sh` does

1. Installs PHP 8.4-FPM, Composer, Nginx, PostgreSQL 16, Redis, Node 20, Certbot
2. Creates system user `rrp`, application directory `/var/www/rrp`
3. Copies application files; installs Composer and npm dependencies
4. Creates the PostgreSQL database and user
5. Generates `APP_KEY`; writes `/var/www/rrp/backend/.env`
6. Runs database migrations and seeds
7. Configures PHP-FPM pool, Nginx vhost, and Supervisor for queue workers
8. Obtains a Let's Encrypt TLS certificate (if `--domain` provided and DNS is live)
9. Sets up a daily cron for `php artisan schedule:run`

---

## 5. Option C — Fresh Azure VM (automated)

```bash
# From your local machine (requires WSL or Linux shell)
export VM_HOST=<public-ip>
export VM_USER=azureadmin
export VM_PASS=<password>   # or set SSH_KEY=~/.ssh/id_rsa

bash v2/deploy/install-remote.sh \
    --domain portal.cityu.edu \
    --email  admin@cityu.edu
```

This SSHes into the VM, installs Docker + Compose, copies the v2 directory, and runs `deploy/install.sh`.

---

## 6. SSL / HTTPS Setup

### Let's Encrypt (automated)

```bash
# DNS A record must already point to this server's IP
sudo bash deploy/ssl-setup.sh portal.cityu.edu admin@cityu.edu
```

Installs certbot, issues certificate, installs SSL Nginx vhost, schedules auto-renewal.

### Existing certificate

```bash
sudo cp fullchain.pem  /etc/ssl/rrp/fullchain.pem
sudo cp privkey.pem    /etc/ssl/rrp/privkey.pem
sudo cp deploy/nginx-vhost.conf /etc/nginx/sites-available/rrp
sudo sed -i 's/PORTAL_DOMAIN/portal.cityu.edu/g' /etc/nginx/sites-available/rrp
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. CI/CD with GitHub Actions

`.github/workflows/ci.yml` runs on every push/PR to `main` or `develop`:

| Job | Trigger | What it does |
|---|---|---|
| `backend` | every push/PR | PHPUnit with SQLite in-memory |
| `frontend` | every push/PR | `tsc --noEmit`, Vitest, `vite build` |
| `deploy` | push to `main` only | SSHes to VM; runs `deploy/update.sh` |

**Required GitHub Secrets** (Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `VM_HOST` | `172.206.114.248` |
| `VM_USER` | `azureadmin` |
| `VM_PASS` | SSH password |

---

## 8. Incremental Updates

```bash
# From the repo root on your dev machine
VM_HOST=172.206.114.248 VM_USER=azureadmin bash v2/deploy/update.sh
```

The update script:
1. Rsyncs changed backend PHP files to the VM (skipping `vendor/`, `.env`, `storage/`)
2. `docker cp`s into the running `rrp_app` container
3. Runs `php artisan migrate --force` and clears caches
4. Rebuilds the React SPA and reloads Nginx

---

## 9. Rolling Back

```bash
# Interactive rollback — lists available backups and prompts for selection
sudo bash /opt/rrp-v2/deploy/rollback.sh
```

Database-only rollback:

```bash
docker exec rrp_app php artisan migrate:rollback        # last batch
docker exec rrp_app php artisan migrate:rollback --step=2  # last 2 batches
```

---

## 10. Database Migrations

```bash
docker exec rrp_app php artisan migrate --force        # run pending
docker exec rrp_app php artisan migrate:status         # show status
docker exec rrp_app php artisan migrate:rollback       # undo last batch
docker exec rrp_app php artisan migrate:fresh --seed   # DROP ALL + re-seed (DESTRUCTIVE)
```

Migration files: `backend/database/migrations/YYYY_MM_DD_HHMMSS_description.php`

---

## 11. First-Time Seed Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cityu.edu` | `admin12345` |
| Coordinator | `coordinator@cityu.edu` | `admin12345` |
| Reviewer | `reviewer@cityu.edu` | `admin12345` |
| Student | `student@cityu.edu` | `admin12345` |

**Emergency admin:** If all admin accounts are locked, `emergency.admin@system.local` / `admin12345` activates automatically.

> ⚠️ Change all default passwords immediately after first login in production.


### One-command deploy (from Windows dev machine)

```bash
wsl bash /mnt/d/Development/CityU-Research-Tracker/check_routes.sh
```

This script:
1. SCPs all changed backend PHP files to the VM via `sshpass`
2. `docker cp`s them into the running `rrp_app` container
3. Runs `php artisan migrate --force` inside the container
4. Clears the route and config caches
5. Rsyncs frontend `src/` to `/opt/rrp-v2/frontend-src/src/` on the VM
6. Runs `/opt/rrp-v2/build_frontend.sh` on the VM (npm install + vite build + nginx reload)

### Manual backend-only deploy

```bash
# Copy a single controller
sshpass -p "$PASS" scp MyController.php azureadmin@172.206.114.248:/tmp/
sshpass -p "$PASS" ssh azureadmin@172.206.114.248 '
  docker cp /tmp/MyController.php rrp_app:/var/www/html/app/Http/Controllers/MyController.php
  docker exec -w /var/www/html rrp_app php artisan route:cache
'
```

### Smoke test API endpoints (must run inside container — API is localhost-only)

```bash
sshpass -p "$PASS" ssh azureadmin@172.206.114.248 '
  docker exec rrp_app curl -s http://localhost/api/system/public | python3 -m json.tool
  docker exec rrp_app curl -s -X POST http://localhost/api/auth/login \
    -H "Content-Type: application/json" \
    -d '"'"'{"email":"admin@cityu.edu","password":"admin12345"}'"'"' | python3 -m json.tool
'
```

---

## Docker Compose (local or new server)

```bash
cd v2
docker compose up -d
docker exec rrp_app php artisan migrate --seed
docker exec rrp_app php artisan storage:link
```

### Environment variables (v2/backend/.env)

| Variable | Description |
|----------|-------------|
| `APP_KEY` | Run `php artisan key:generate` |
| `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL credentials |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP for notifications |
| `SANCTUM_STATEFUL_DOMAINS` | Frontend domain (e.g. `portal.cityu.edu`) |
| `APP_URL` | API base URL |

---

## Frontend build (on VM)

The VM script `/opt/rrp-v2/build_frontend.sh` handles:
1. `npm install --legacy-peer-deps`
2. `npm run build` (TypeScript + Vite → `dist/`)
3. `cp -r dist/* /var/www/html/app/`
4. `nginx -s reload`

The frontend is served at `https://portal.cityu.edu/app` by nginx.

---

## GitHub Actions CI/CD

See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

- **On every push/PR:** runs PHPUnit (SQLite in-memory) + TypeScript/Vite build
- **On push to `main`:** deploys to production VM (requires `VM_HOST`, `VM_USER`, `VM_PASS` secrets in repo settings)

---

## Database migrations

All migrations are in `v2/backend/database/migrations/`.  
To run on the container:

```bash
docker exec -w /var/www/html rrp_app php artisan migrate --force
```

To roll back the last batch:

```bash
docker exec -w /var/www/html rrp_app php artisan migrate:rollback
```

---

## v1 → v2 data migration

```bash
cd v2/backend
php scripts/migrate_v1_data.php --dry-run --v1-data=../../data
# Review output, then:
php scripts/migrate_v1_data.php --v1-data=../../data
```

The script maps v1 JSON statuses to v2 enums, creates user accounts for reviewers/submitters (printing temporary passwords), and copies uploaded files into v2's storage structure.
