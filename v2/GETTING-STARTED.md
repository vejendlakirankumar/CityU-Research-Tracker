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
