# RRP v2 — Getting Started

## Prerequisites

- **VM**: Existing Azure VM with Docker + Docker Compose v2 installed  
- **Port**: v1 WordPress app stays on port 80; v2 runs on **port 8080**
- **Local**: Node 22, PHP 8.3, Composer 2 for local dev

---

## Local Development

### 1. Backend (Laravel)

```bash
cd v2/backend

# Install PHP dependencies
composer install

# Copy env
cp .env.example .env

# Edit .env — set DB_HOST=127.0.0.1, your local PG credentials, etc.
nano .env

# Generate app key
php artisan key:generate

# Run migrations
php artisan migrate

# Seed demo data
php artisan db:seed

# Start dev server (port 8000)
php artisan serve
```

### 2. Frontend (React)

```bash
cd v2/frontend

# Install dependencies
npm install

# Start Vite dev server (port 5173, proxies /api → :8000)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Demo credentials (after seeding)

| Email | Password | Role |
|---|---|---|
| admin@rrp.local | Admin@RRP2026! | Admin |
| coordinator1@rrp.local | Coord@RRP2026! | Coordinator |
| reviewer1@rrp.local | Review@RRP2026! | Reviewer |
| student1@rrp.local | Student@RRP2026! | Student |

---

## VM Deployment (port 8080)

### First-time setup

```bash
# From your local machine — sync code to VM and run setup
cd v2
./deploy-vm.sh

# Then SSH into the VM and run setup
ssh azureuser@rcgapimtest.eastus2.cloudapp.azure.com
cd /opt/rrp-v2
bash setup.sh
```

`setup.sh` will:
1. Generate `.env.production` with random DB/Redis passwords  
2. Start Docker services  
3. Run migrations  
4. Optionally seed demo data  

The app will be available at: `http://rcgapimtest.eastus2.cloudapp.azure.com:8080`

### Subsequent deploys

```bash
cd v2
./deploy-vm.sh
```

---

## Project Structure

```
v2/
├── backend/                 Laravel 11 API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── AuthController.php     login / logout / me / change-password
│   │   │   │   └── SystemController.php   org settings / feature flags / policy
│   │   │   ├── Middleware/
│   │   │   │   └── EnsureRole.php
│   │   │   └── Resources/
│   │   │       └── UserResource.php
│   │   └── Models/                        Eloquent models
│   ├── bootstrap/app.php                  Laravel 11 bootstrap
│   ├── config/cors.php
│   ├── database/
│   │   ├── migrations/                    All 33 tables in order
│   │   └── seeders/DatabaseSeeder.php
│   └── routes/api.php
│
├── frontend/                React 18 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── components/
│       │   ├── guards/ProtectedRoute.tsx
│       │   └── layout/
│       │       ├── AppShell.tsx           Sidebar + TopBar wrapper
│       │       ├── Sidebar.tsx            Role-filtered navigation
│       │       └── TopBar.tsx             User menu + logout
│       ├── lib/
│       │   ├── axios.ts                   Axios with auth header
│       │   └── queryClient.ts
│       ├── pages/
│       │   ├── LoginPage.tsx              Fetches org branding before render
│       │   └── DashboardPage.tsx          Role-aware stat cards
│       ├── stores/authStore.ts            Zustand (token in sessionStorage)
│       ├── types/
│       │   ├── auth.ts
│       │   └── organization.ts
│       └── router.tsx
│
├── docker/
│   ├── nginx.conf                         Port 8080, SPA + API proxy
│   ├── entrypoint.sh                      Secrets, migrate, start
│   └── postgres-init.sql                  rrp_readonly role
│
├── Dockerfile                             Multi-stage: node → composer → ubuntu
├── docker-compose.yml                     app + worker + postgres + redis
├── setup.sh                               First-time VM setup script
└── deploy-vm.sh                           rsync + remote rebuild script
```

---

## API Routes (Phase 1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | — | Login, returns token |
| POST | /api/auth/logout | ✓ | Revoke current token |
| GET | /api/auth/me | ✓ | Current user |
| POST | /api/auth/change-password | ✓ | Change password |
| GET | /api/system/public | — | Org branding for login page |
| GET | /api/system/organization | ✓ Admin | Org settings |
| PATCH | /api/system/organization | ✓ Admin | Update org settings |
| POST | /api/system/organization/logo | ✓ Admin | Upload logo |
| GET | /api/system/feature-flags | ✓ Admin | All flags |
| PATCH | /api/system/feature-flags | ✓ Admin | Update flags |
| GET | /api/system/password-policy | ✓ Admin | Password policy |
| PATCH | /api/system/password-policy | ✓ Admin | Update policy |



# CityU Research Review Portal — v2

A standalone Laravel 11 + React 18 replacement for the WordPress-based v1 research submission portal.

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the v2 directory
git clone <repo-url> rrp && cd rrp/v2

# 2. Copy the backend env file and fill in secrets
cp backend/.env.example backend/.env
# Edit DB_PASSWORD, APP_KEY (see next step), MAIL_* etc.

# 3. Start everything — app, worker, postgres, redis
docker compose up -d
docker exec rrp_app php artisan key:generate --force
docker exec rrp_app php artisan migrate --seed
docker exec rrp_app php artisan storage:link

# 4. Open the portal
open http://localhost/app
```

Default seeded credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@cityu.edu | admin12345 |
| Reviewer | reviewer@cityu.edu | reviewer123 |
| Researcher | researcher@cityu.edu | researcher123 |

---

## Production Deployment (Azure VM)

### First-time setup

```bash
# On the VM — install Docker Compose, copy files, start stack
sudo apt-get install -y docker.io docker-compose-v2
sudo mkdir -p /opt/rrp-v2
sudo chown azureadmin:azureadmin /opt/rrp-v2

# Copy docker-compose.yml + deploy/ scripts to VM
scp -r v2/docker-compose.yml v2/Dockerfile v2/docker/ v2/deploy/ \
    azureadmin@172.206.114.248:/opt/rrp-v2/

# Copy backend/.env.production to /opt/rrp-v2/backend/.env
scp backend/.env.production azureadmin@172.206.114.248:/opt/rrp-v2/backend/.env

# Start containers
ssh azureadmin@172.206.114.248 'cd /opt/rrp-v2 && docker compose up -d'
```

### SSL / HTTPS

```bash
# On the VM — installs certbot, issues cert, installs nginx vhost
sudo bash /opt/rrp-v2/deploy/ssl-setup.sh portal.cityu.edu admin@cityu.edu
```

The script:
1. Installs certbot and host-level nginx
2. Issues a Let's Encrypt certificate
3. Installs `deploy/nginx-vhost.conf` as an SSL-terminating reverse proxy in front of the Docker container
4. Schedules daily auto-renewal

### Process supervision (optional)

```bash
# Keep the Docker stack auto-restarting on crash
sudo apt-get install -y supervisor
sudo cp /opt/rrp-v2/deploy/supervisord.conf /etc/supervisor/conf.d/rrp-v2.conf
sudo cp /opt/rrp-v2/deploy/watchdog.sh /opt/rrp-v2/deploy/watchdog.sh
sudo chmod +x /opt/rrp-v2/deploy/watchdog.sh
sudo supervisorctl reread && sudo supervisorctl update
```

### Incremental deploys (from Windows dev machine)

```bash
wsl bash /mnt/d/Development/CityU-Research-Tracker/check_routes.sh
```

This SCPs changed PHP files, docker-cp them into the running container, runs migrations, rebuilds the React SPA inside a Node container, and reloads nginx — all in one step.

---

## Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_KEY` | ✅ | Run `php artisan key:generate` |
| `APP_URL` | ✅ | Public URL, e.g. `https://portal.cityu.edu` |
| `DB_HOST` | ✅ | Postgres host (`postgres` inside Docker) |
| `DB_DATABASE` | ✅ | Database name |
| `DB_USERNAME` | ✅ | Postgres user |
| `DB_PASSWORD` | ✅ | Postgres password |
| `REDIS_HOST` | ✅ | Redis host (`redis` inside Docker) |
| `MAIL_HOST` | | SMTP host for email notifications |
| `MAIL_PORT` | | SMTP port (587) |
| `MAIL_USERNAME` | | SMTP username |
| `MAIL_PASSWORD` | | SMTP password |
| `MAIL_FROM_ADDRESS` | | Sender address |
| `SANCTUM_STATEFUL_DOMAINS` | ✅ | Frontend domain for Sanctum cookie auth |
| `APP_DEBUG` | | `false` in production |
| `LOG_LEVEL` | | `error` in production |

---

## Running Tests

### Backend (PHPUnit — SQLite in-memory, no Postgres needed)

```bash
cd backend
composer install
php artisan test
# or in parallel:
php artisan test --parallel
```

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm install
npm run test          # run once
npm run test:watch    # watch mode
```

### TypeScript type check + production build

```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/PR to `main` or `develop`:

1. **backend** job — PHPUnit with SQLite, PHP 8.4
2. **frontend** job — `tsc --noEmit`, Vitest, `vite build`; uploads `dist/` artifact
3. **deploy** job — runs only on `main` push; SSHes to the VM and syncs files

Required GitHub secrets for the deploy job:

| Secret | Value |
|--------|-------|
| `VM_HOST` | `172.206.114.248` |
| `VM_USER` | `azureadmin` |
| `VM_PASS` | VM SSH password |

---

## v1 → v2 Migration

```bash
# Dry run first — shows what would be imported
docker exec -w /var/www/html rrp_app \
    php scripts/migrate_v1_data.php --dry-run --v1-data=/path/to/v1/data

# Full migration
docker exec -w /var/www/html rrp_app \
    php scripts/migrate_v1_data.php --v1-data=/path/to/v1/data
```

The migration imports v1 users, submissions (with status mapping), and file attachments. See [`backend/scripts/migrate_v1_data.php`](backend/scripts/migrate_v1_data.php) for all options.

**v1 read-only mode:** In the v2 Admin → Settings, toggle "v1 Read-Only Mode" to freeze the WordPress portal and direct researchers to v2 before cutting over entirely.

---

## Architecture

```
Browser
  └── HTTPS → Nginx (host, port 443) — deploy/nginx-vhost.conf
        └── HTTP proxy → Docker rrp_app (port 80 → internal 8080)
              ├── /app/      React SPA   (static, /var/www/frontend/)
              ├── /api/      Laravel API (PHP-FPM, port 9000)
              └── /sanctum/  Sanctum auth endpoints

docker-compose services:
  rrp_app     — PHP-FPM + nginx (serves both SPA and API)
  rrp_worker  — php artisan queue:work redis (email, notifications)
  postgres    — PostgreSQL 16
  redis       — Redis 7
```

---

## Directory Structure

```
v2/
├── backend/          Laravel 11 application
│   ├── app/          Models, Controllers, Services, Jobs, Policies
│   ├── database/     Migrations, seeders
│   ├── routes/       api.php
│   ├── tests/        PHPUnit Feature + Unit tests
│   └── scripts/      migrate_v1_data.php
├── frontend/         React 18 + TypeScript SPA
│   ├── src/          Components, pages, hooks, stores
│   └── src/test/     Vitest tests
├── docker/           nginx.conf, entrypoint.sh (inside container)
├── deploy/           Production infrastructure scripts
│   ├── nginx-vhost.conf    External SSL reverse proxy
│   ├── supervisord.conf    Process supervision
│   ├── watchdog.sh         Health watchdog
│   └── ssl-setup.sh        Let's Encrypt certificate setup
├── .github/workflows/ci.yml
├── docker-compose.yml
├── Dockerfile
└── spec/             Original design specifications
```

---

## Smoke Testing

After each deployment, run through [deploy/smoke-test-checklist.md](deploy/smoke-test-checklist.md).

---

## Why a Rewrite from v1?

| Problem in v1 | v2 Solution |
|---|---|
| Workflow logic in 7 000-line PHP file | Config-driven Workflow Engine |
| Status derived by string-scanning → bugs | Explicit state machine, stored status |
| Decisions overwritten on revision — no history | Immutable `review_decisions` table |
| No background jobs — escalation impossible | Laravel Queues + Redis |
| WordPress plugin — WP-specific auth/ORM | Standalone Laravel app |
| No type safety in 4 000-line portal.js | React 18 + TypeScript |
| JSON file persistence | PostgreSQL with migrations |
| PostgreSQL 16 | Full relational integrity, JSONB for flexible config, proper constraints |
| Redis 7 | Queue driver + cache; required for escalation background jobs |
| Laravel Reverb | WebSocket server (first-party, no Pusher dependency) for real-time notifications |
| Laravel Scout + Meilisearch | Full-text search across submissions (optional phase 7) |

### Frontend — React 18 + TypeScript

| Choice | Rationale |
|---|---|
| React 18 + TypeScript | Type safety eliminates whole class of v1 JS bugs |
| Vite 5 | Fast HMR dev server, optimal production bundles |
| Tailwind CSS 3 | Utility-first, consistent design tokens |
| shadcn/ui | Accessible, unstyled component primitives (Radix UI underneath) |
| React Query (TanStack) | Server-state management, automatic cache invalidation |
| React Hook Form + Zod | Type-safe forms with schema validation |
| Zustand | Minimal client-state store (auth, notifications) |
| React Router 6 | SPA routing with role-based route guards |

### Infrastructure

| Component | Choice |
|---|---|
| Web server | Nginx (replaces Apache) |
| Process manager | Supervisor (PHP-FPM + queue workers) |
| Container | Docker + Docker Compose (dev) |
| Deployment | Same Azure VM; separate vhost from v1 |
| File storage | Local disk initially; Azure Blob Storage adapter ready |
| Email | Laravel Mail + SMTP (existing ACS connector reused) |

---

## Repository Layout (target)

```
v2/
├── backend/                    # Laravel 11 application
│   ├── app/
│   │   ├── Enums/              # Status, Decision, ApprovalStrategy, etc.
│   │   ├── Events/             # DecisionSubmitted, StageCompleted, etc.
│   │   ├── Http/Controllers/   # Thin — delegate to Services
│   │   ├── Http/Resources/     # API response transformers (visibility applied here)
│   │   ├── Jobs/               # EscalationCheckJob, NotificationJob
│   │   ├── Models/             # Eloquent models
│   │   ├── Policies/           # Authorization (submitter/reviewer/admin)
│   │   ├── Services/
│   │   │   ├── WorkflowEngine.php
│   │   │   ├── StageEvaluator.php
│   │   │   ├── GatedReleaseService.php
│   │   │   ├── VisibilityService.php
│   │   │   └── NotificationService.php
│   │   └── Rules/              # Custom validation rules
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── tests/
│       ├── Feature/            # HTTP-level tests
│       └── Unit/               # Service unit tests
│
├── frontend/                   # React 18 + TypeScript SPA
│   ├── src/
│   │   ├── api/                # React Query hooks, axios client
│   │   ├── components/         # Shared UI components
│   │   │   ├── workflow/       # StageTimeline, DecisionBadge, etc.
│   │   │   └── ui/             # shadcn/ui wrappers
│   │   ├── pages/              # Route-level page components
│   │   │   ├── student/
│   │   │   ├── reviewer/
│   │   │   ├── chair/
│   │   │   └── admin/
│   │   ├── store/              # Zustand stores
│   │   └── types/              # TypeScript types mirroring backend models
│   └── vite.config.ts
│
├── spec/                       # This folder — all specification documents
│   ├── 01-architecture.md
│   ├── 02-data-model.md
│   ├── 03-workflow-engine.md
│   ├── 04-api-spec.md
│   ├── 05-ui-spec.md
│   ├── 06-implementation-plan.md
│   └── 07-system-config.md
│
└── README.md                   # This file
```

---

## Spec Documents

| Document | Contents |
|---|---|
| [01-architecture.md](spec/01-architecture.md) | System diagram, component boundaries, deployment topology |
| [02-data-model.md](spec/02-data-model.md) | Full PostgreSQL schema — all tables, constraints, security & encryption |
| [03-workflow-engine.md](spec/03-workflow-engine.md) | State machine, stage evaluation, dynamic workflow, gated release |
| [04-api-spec.md](spec/04-api-spec.md) | All REST endpoints + system config endpoints |
| [05-ui-spec.md](spec/05-ui-spec.md) | All screens per role, system config UI, workflow builder, design tokens |
| [06-implementation-plan.md](spec/06-implementation-plan.md) | 9 phases (incl. Phase 1b: system config) with tasks and acceptance criteria |
| [07-system-config.md](spec/07-system-config.md) | SSO (SAML2/OIDC), email, encryption algorithms, password policy, backup |

---

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| D1 | Stay PHP (Laravel) not Node | Team knows PHP; same deployment VM; Laravel queue system is production-grade |
| D2 | PostgreSQL not MySQL | JSONB column for stage visibility config; better constraint support |
| D3 | Standalone app, not WordPress plugin | Eliminate WP coupling; proper ORM; testable; deployable independently |
| D4 | WordPress user import at migration | Existing users imported via migration script; new auth handled by Laravel Sanctum |
| D5 | React SPA not SSR | All role-specific rendering is client-side; SSR adds complexity with no SEO benefit |
| D6 | `review_decisions` is append-only / immutable | Compliance requirement; audit trail; version isolation |
| D7 | Stage role labels are free text, not an enum | Admin configures any label ('Chair', 'IRB Officer', 'External Examiner') per stage; `is_gatekeeper` flag identifies the release-issuing stage |
| D8 | Only 4 global roles: admin, coordinator, reviewer, student | Stage-level labels don't create new role types; authorization is via `stage_assignments` table |
| D9 | `GatedRelease` is a separate first-class entity | Gatekeeper vote ≠ student-visible decision; two distinct actions |
| D10 | Visibility rules declared in `StageDefinition` | Eliminates ad-hoc stripping code; single source of truth |
| D11 | `FULL_RESTART` default for gated, `FAILED_STAGE_RESTART` for non-gated | Matches academic workflow expectations |
| D12 | All system config stored in DB, not `.env` | Only `APP_KEY` and DB credentials live in `.env`; everything else is admin-configurable at runtime |
| D13 | SSO coexists with local auth | `disable_local_auth` feature flag forces SSO-only when needed |
| D14 | Sensitive config encrypted with `APP_KEY` | SMTP passwords, SSO secrets stored as AES-256-CBC ciphertext via `Crypt::encryptString()` |
| D15 | Decision options configurable per stage | Not hardcoded APPROVE/REJECT; each stage defines its own labels mapped to outcomes (APPROVED/REVISION/REJECTED) |
