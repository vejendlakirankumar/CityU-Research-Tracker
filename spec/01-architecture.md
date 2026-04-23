# v2 — Architecture

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│               Azure linux VM /Docker / cloud based web app      │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │   Nginx      │───▶│  Frontend SPA (React + Vite build)  │   │
│  │  :443        │    │  Served as static files             │   │
│  │  (SSL/TLS)   │    └─────────────────────────────────────┘   │
│  │              │                                               │
│  │              │    ┌─────────────────────────────────────┐   │
│  │              │───▶│  Laravel API  :8000                 │   │
│  │              │    │  PHP-FPM + php-fpm.sock             │   │
│  └──────────────┘    │                                     │   │
│                       │  ┌──────────────────────────────┐  │   │
│                       │  │ WorkflowEngine Service       │  │   │
│                       │  │ StageEvaluator Service       │  │   │
│                       │  │ GatedReleaseService          │  │   │
│                       │  │ VisibilityService            │  │   │
│                       │  └──────────────────────────────┘  │   │
│                       └─────────────────────────────────────┘   │
│                                         │                        │
│  ┌──────────────────┐   ┌─────────────────────────────────────┐ │
│  │  PostgreSQL 16   │◀──│  Redis 7                            │ │
│  │  :5432           │   │  Queue driver + Cache               │ │
│  └──────────────────┘   └─────────────────────────────────────┘ │
│                                         │                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Supervisor                                              │   │
│  │  ├── php-fpm                                             │   │
│  │  ├── queue:work (escalation + notifications)            │   │
│  │  └── reverb (WebSocket server :8080)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  v1 WordPress (still running on :80/old vhost)          │   │
│  │  Read-only during migration period                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Boundaries

### 2.1 Laravel API

Responsibilities:
- Authentication (Sanctum SPA tokens)
- Authorization (Policies per model)
- All business logic (Workflow Engine, Evaluator, Release Service)
- Email dispatch (queued)
- WebSocket event broadcasting
- File upload/storage

NOT responsible for:
- Rendering HTML (100% API responses)
- Frontend routing
- Session state beyond auth token

### 2.2 React SPA

Responsibilities:
- All UI rendering
- Role-based route guards
- Client-side form validation (Zod)
- Optimistic updates (React Query)
- WebSocket subscription (Reverb Echo)
- File download/preview

NOT responsible for:
- Any business logic
- Authorization decisions (always re-validated server-side)

### 2.3 Workflow Engine (PHP Service)

Single class `WorkflowEngine` owned by the backend. Stateless — takes data in, returns result. Testable in isolation.

```
WorkflowEngine::startWorkflow(Submission $s, WorkflowDefinition $wf): WorkflowRun
WorkflowEngine::advanceStage(WorkflowRun $run): void
WorkflowEngine::handleRevision(WorkflowRun $run): WorkflowRun  // new version
```

### 2.4 Stage Evaluator

```
StageEvaluator::evaluate(StageInstance $si): EvaluationResult
  // EvaluationResult: PASSED | FAILED | REVISION_REQUIRED | PENDING
```

Reads decisions for the stage instance. Applies `approval_strategy` + `min_approvals`. Returns deterministic result. Pure function — no side effects.

### 2.5 Visibility Service

```
VisibilityService::forRole(string $role, Submission $s, User $user): SubmissionView
```

Applies visibility rules from `StageDefinition.visibility_config` to produce a role-appropriate view of the submission. Single place for all data stripping — no ad-hoc unset() calls in controllers.

### 2.6 Queue Workers

| Job | Trigger | Action |
|---|---|---|
| `EscalationCheckJob` | Scheduled every 15 min | Find overdue review tasks; fire escalation |
| `SendNotificationJob` | Event-driven | Send email + in-app notification |
| `BroadcastStatusJob` | Event-driven | Push WebSocket event to connected clients |

---

## 3. Authentication Flow

```
Browser                          Laravel API
  │                                  │
  │──POST /auth/login──────────────▶│
  │   {email, password}              │
  │                                  │──Validate credentials
  │                                  │──Issue Sanctum token
  │◀──{token, user, roles}──────────│
  │                                  │
  │  Store token in memory           │
  │  (not localStorage — XSS risk)   │
  │                                  │
  │──GET /api/submissions ──────────▶│
  │  Authorization: Bearer <token>   │──Verify token
  │                                  │──Apply Policy
  │◀──{data filtered by role}───────│
```

Tokens are stored in an `httpOnly` cookie (Sanctum default) — not `localStorage`. CSRF tokens used for mutating requests.

---

## 4. Real-Time Updates

```
Browser                      Reverb (WebSocket)          Laravel API
  │                               │                           │
  │──WS connect ─────────────────▶│                           │
  │  Subscribe: submission.{id}   │                           │
  │                               │                           │
  │                               │          Decision submitted│
  │                               │◀──BroadcastStatusJob─────│
  │◀──{event: stage_updated}──────│                           │
  │  Update React Query cache     │                           │
```

---

## 5. Deployment Topology

The application is **deployment-target agnostic** — the same build artifact runs unchanged on all three targets. The only difference is how secrets are injected into the process environment (see §5.4).

---

### 5.1 Development (Local)

```bash
# Copy example env and generate key (only in dev)
cp .env.example .env
php artisan key:generate

# Start services
composer install && php artisan migrate --seed
npm install && npm run dev       # Vite dev server :5173
php artisan serve                 # Laravel API :8000
php artisan queue:work
php artisan reverb:start
```

The `.env` file is **only used in local development**. It is never deployed or committed.

---

### 5.2 Production — Linux VM (Nginx + systemd)

```
/etc/nginx/sites-enabled/rrp       Nginx HTTPS vhost
/etc/rrp/secrets.env               Credential file (chmod 600, owned by www-data)
/etc/systemd/system/rrp-worker.service
/etc/systemd/system/rrp-reverb.service
/var/www/rrp/                      Application root (no .env file)
```

**Credential file** (`/etc/rrp/secrets.env`) — readable only by `www-data`:
```ini
APP_KEY=base64:...
DB_HOST=127.0.0.1
DB_DATABASE=rrp_production
DB_USERNAME=rrp_app
DB_PASSWORD=...
REDIS_PASSWORD=...
APP_URL=https://portal.university.edu
```

```bash
sudo chown www-data:www-data /etc/rrp/secrets.env
sudo chmod 600 /etc/rrp/secrets.env
```

**systemd service unit** reads the credential file:
```ini
[Unit]
Description=RRP PHP-FPM
After=network.target postgresql.service redis.service

[Service]
User=www-data
EnvironmentFile=/etc/rrp/secrets.env
ExecStart=/usr/sbin/php-fpm8.3 --nodaemonize --fpm-config /etc/php/8.3/fpm/pool.d/rrp.conf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

The same `EnvironmentFile=` directive is applied to `rrp-worker.service` and `rrp-reverb.service`. No other OS user can read the credential file.

Nginx vhost routes:
- `/ → /var/www/rrp/public/index.php` (PHP-FPM)
- `/storage/ → /var/www/rrp/storage/app/public/` (direct static)
- All HTTPS; redirect port 80 → 443

---

### 5.3 Production — Docker

Two secret-injection strategies are supported. Choose one per environment.

**Option A — Docker Secrets (recommended for Swarm / sensitive keys)**

```yaml
# docker-compose.yml
services:
  app:
    image: rrp:latest
    secrets: [app_key, db_password, redis_password]
    environment:
      SECRETS_FROM_FILES: "true"   # entrypoint exports /run/secrets/* as env vars
      APP_URL: https://portal.university.edu
      APP_ENV: production
  worker:
    image: rrp:latest
    command: php artisan queue:work --sleep=3 --tries=3
    secrets: [app_key, db_password, redis_password]
    environment:
      SECRETS_FROM_FILES: "true"
  reverb:
    image: rrp:latest
    command: php artisan reverb:start --port=6001
    secrets: [app_key]
    environment:
      SECRETS_FROM_FILES: "true"
  nginx:
    image: nginx:alpine
    ports: ["443:443", "80:80"]
    depends_on: [app]
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD_FILE}

secrets:
  app_key:       { external: true }   # docker secret create app_key <file>
  db_password:   { external: true }
  redis_password: { external: true }

volumes:
  pgdata:
```

The container entrypoint script (`docker/entrypoint.sh`):
```bash
#!/bin/sh
if [ "$SECRETS_FROM_FILES" = "true" ]; then
  for f in /run/secrets/*; do
    varname=$(basename "$f" | tr '[:lower:]' '[:upper:]')
    export "$varname"=$(cat "$f")
  done
fi
exec "$@"
```

**Option B — env_file (single-node Compose)**
```yaml
services:
  app:
    env_file:
      - /etc/rrp/secrets.env   # host-side file; chmod 600; same format as §5.2
```

Single `docker compose up -d --build` deployment. v1 WordPress can remain on port 80; v2 runs on port 443 on the same host.

---

### 5.4 Production — Cloud Webapp

Supported platforms: **Azure App Service**, **AWS Elastic Beanstalk**, **Heroku**, **Render**, **Railway**.

Secrets are injected as platform-managed environment variables — **no secrets files, no committed config**.

| Platform | Mechanism |
|---|---|
| Azure App Service | Configuration → Application Settings (encrypted at rest by Azure) |
| AWS Elastic Beanstalk | Configuration → Software → Environment properties |
| Heroku | `heroku config:set APP_KEY=... DB_PASSWORD=...` |
| Render / Railway | Dashboard → Environment tab |

All four platforms inject the vars into the PHP process as `$_ENV` / `getenv()` — the same interface Laravel's `env()` reads. No code changes per platform.

**Azure App Service notes:**
- Set `WEBSITES_ENABLE_APP_SERVICE_STORAGE=false`
- Set `FILESYSTEM_DISK=azure` for file uploads → Azure Blob private container
- Startup command: `cp /home/site/wwwroot/docker/nginx.conf /etc/nginx/nginx.conf && php-fpm`
- Managed Identity can authenticate to Azure Blob — no blob key in env vars needed

---

### 5.5 Credential Source Priority

Laravel's `env()` resolves in this order (highest wins):

```
1. Process environment variable   ← set by systemd / Docker / platform
2. PHP-FPM fastcgi_param          ← set in Nginx config (non-secret only)
3. .env file                      ← local dev only; never in production
```

If a required credential is unset in production, the application **fails fast** on boot rather than silently using a wrong default.

**Must never be in any committed file:**
- `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`
- Any `*_enc`, `*_secret`, `*_key` value

**Safe in non-secret config** (may be in environment or non-secret docker-compose values):
- `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://...`
- `DB_HOST`, `DB_DATABASE`, `DB_USERNAME` (not passwords)
- `LOG_CHANNEL=stack`, `QUEUE_CONNECTION=redis`

---

### 5.6 File Storage Per Target

| Target | Upload storage | Config |
|---|---|---|
| Linux VM | Local filesystem, outside webroot | `FILESYSTEM_DISK=local` |
| Docker | Bind-mounted volume (`./storage:/var/www/rrp/storage`) | `FILESYSTEM_DISK=local` |
| Cloud Webapp | Azure Blob / S3 private bucket | `FILESYSTEM_DISK=azure` or `s3` |

SignedURL generation for downloads is handled uniformly by `StorageService::signedUrl()` regardless of disk driver — no caller-side changes per target.

---

## 6. Security Architecture

| Concern | Implementation |
|---|---|
| Authentication | Sanctum httpOnly cookie tokens; bcrypt passwords |
| Authorization | Laravel Policies on every model; no role-checking in controllers directly |
| CSRF | SameSite cookie + X-XSRF-TOKEN header on mutating requests |
| SQL Injection | Eloquent parameterized queries only; no raw SQL |
| XSS | React escapes all output by default; no dangerouslySetInnerHTML |
| File Upload | MIME validation + extension allowlist; store outside webroot; no execution |
| Rate Limiting | Laravel throttle middleware on auth endpoints (10/min) and API (120/min) |
| SSRF | No user-supplied URLs fetched server-side |
| Audit Log | Immutable append-only `audit_logs` table; no UPDATE/DELETE permitted on it |
| Sensitive data | Decisions/feedback stripped by VisibilityService before API response; never leaked |

---

## 7. Data Flow — Submission Review Lifecycle

```
Student: POST /submissions
    │
    ▼
WorkflowEngine::startWorkflow()
    │── create WorkflowRun
    │── create StageInstance[0]  (status: ACTIVE)
    │── create ReviewTasks for each assigned reviewer
    │── dispatch SendNotificationJob(reviewers)
    ▼
Reviewer: POST /decisions
    │
    ▼
StageEvaluator::evaluate(stage_instance)
    │── result: PENDING → nothing
    │── result: PASSED  → WorkflowEngine::advanceStage()
    │── result: REVISION_REQUIRED → WorkflowEngine::handleRevision()
    │── result: FAILED  → WorkflowEngine::handleFailure()
    │
    ▼
advanceStage():
    │── mark current StageInstance PASSED
    │── next_stage = next non-skipped stage
    │── if next_stage exists → create StageInstance[next], assign reviewers
    │── if no next_stage (non-gated) → WorkflowRun.status = COMPLETED → Submission.status = ACCEPTED
    │── if no next_stage (gated) → set pendingRelease = true on GatekeeperStage
    │
    ▼
Chair (gated only): POST /gated-releases
    │── GatedReleaseService::validate() — all higher stages completed
    │── create GatedRelease record
    │── WorkflowRun.status = COMPLETED
    │── Submission.status = per release decision
    │── dispatch SendNotificationJob(submitter)
```

---

## 8. Modularity & Extension Points

### 8.1 Laravel Service Container Bindings

All core services are bound behind interfaces in `AppServiceProvider`. Swapping an implementation requires changing one binding — no controller or job changes needed.

| Interface | Default Implementation | Notes |
|---|---|---|
| `WorkflowEngineContract` | `DAGWorkflowEngine` | DAG-based; replaces linear engine |
| `StageEvaluatorContract` | `OutcomeStageEvaluator` | Pure function, outcome-based |
| `GatedReleaseContract` | `GatedReleaseService` | |
| `VisibilityContract` | `VisibilityService` | |
| `AutoAssignmentContract` | `AutoAssignmentService` | MANUAL/POOL_RANDOM/POOL_ROUND_ROBIN |
| `WebhookDispatcherContract` | `HttpWebhookDispatcher` | HMAC-signed HTTP POST |
| `StorageContract` | `LaravelStorageAdapter` | Wraps `Storage::disk()` — local/azure/s3 |
| `NotificationDriverContract` | `LaravelMailDriver` | Swappable to queue-based, SES, etc. |

### 8.2 Queue Driver Portability

| Driver | Config | Use case |
|---|---|---|
| `redis` (default) | `QUEUE_CONNECTION=redis` | VM, Docker, most cloud |
| `database` | `QUEUE_CONNECTION=database` | Dev fallback; no Redis required |
| `sqs` | `QUEUE_CONNECTION=sqs` | AWS deployments |
| `sync` | `QUEUE_CONNECTION=sync` | Testing only |

Queue workers are stateless and horizontally scalable. The `worker` container/service can be scaled independently.

### 8.3 Event Bus

All significant state transitions dispatch a Laravel `Event`. Listeners are registered in `EventServiceProvider` and are decoupled from the triggering code.

| Event | Listeners |
|---|---|
| `SubmissionCreated` | `SendWelcomeNotification`, `WebhookDispatchJob` |
| `DecisionSubmitted` | `EvaluateStage`, `AuditLogger`, `WebhookDispatchJob` |
| `StagePassed` | `AdvanceWorkflow`, `AuditLogger`, `WebhookDispatchJob` |
| `GatedReleaseIssued` | `NotifySubmitter`, `AuditLogger`, `WebhookDispatchJob` |
| `RevisionRequested` | `NotifySubmitter`, `AuditLogger`, `WebhookDispatchJob` |
| `EscalationTriggered` | `SendEscalationNotification`, `AuditLogger` |

Webhook delivery is always async (`WebhookDispatchJob` queued). Failed deliveries are retried with exponential backoff (3 attempts).

### 8.4 Storage Abstraction

```php
interface StorageContract {
    public function store(UploadedFile $file, string $path): string;  // returns stored path
    public function signedUrl(string $path, int $expiresInMinutes = 60): string;
    public function delete(string $path): void;
    public function exists(string $path): bool;
}
```

The concrete adapter wraps `Storage::disk(config('filesystems.default'))`. Switching from local to Azure Blob requires only changing `FILESYSTEM_DISK=azure` in environment — no code change.

### 8.5 Config Scope Hierarchy

Configuration values are resolved from most-specific to most-general:

```
Stage-level override
  └─▶ SubmissionType-level override
        └─▶ Global (organization_settings)
              └─▶ Application default (seeded)
```

The `ConfigResolver` service handles this lookup:

```php
class ConfigResolver {
    public function get(string $key, ?UUID $submissionTypeId = null, ?UUID $stageId = null): mixed;
}
```

Currently configurable per scope: `max_file_size_mb`, `due_days`, `allowed_extensions`. Additional keys are added to `config_overrides` without schema changes.
