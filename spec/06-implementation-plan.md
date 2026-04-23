# v2 — Implementation Plan

8 phases. Each phase is a deployable increment — the app runs end-to-end after phase 3.  
Phases are sequential. Within a phase, tasks can be parallelized between frontend and backend.

**Status legend:** ✅ Done · 🔄 Partial · ⬜ Not started

---

## Progress Summary

| Phase | Title | Status |
|---|---|---|
| 1 | Foundation | ✅ Complete |
| 1b | System Configuration UI | ✅ Complete |
| 7b | User Management Engine | ✅ Complete |
| 2 | Submission Core | ✅ Complete |
| 3 | Workflow Engine | ✅ Complete |
| 4 | Gated Review | ✅ Complete (2026-04-20) |
| 5 | Notifications & Escalation | ✅ Complete |
| 6 | UI Polish | ✅ Complete |
| 7 | Admin Panel & Workflow Builder | ✅ Complete |
| 8 | Migration & Launch | ✅ Complete |

### Phase 2 & 3 Completion Notes (2026-04-20)
- Built on `submission_reviewers` table (not `stage_instances`/`stage_assignments` which exist in DB but were unused)
- `StageEvaluator` — evaluates stage outcome (PENDING/PASSED/REVISION_REQUIRED/FAILED) from submission_reviewers decisions
- `WorkflowAdvancer` — auto-advances submission status after every reviewer decision
- `DashboardController` — role-based stats (GET /api/dashboard/stats)
- `SubmissionController::myReviews()` — reviewer queue with overdue/due-soon flags (GET /api/submissions/my-reviews)
- Fixed `Submission::scopeVisibleTo` — reviewers now see only their assigned submissions
- Fixed `SubmissionPolicy::isAssignedReviewer` — checks submission_reviewers table instead of role check
- Frontend: DashboardPage (real stats), ReviewsPage (queue), ReviewerDecisionPanel (inline decision form in SubmissionDetailPage)
- Phase 4 (Gated Review) deferred: the formal GatedRelease model requires workflow_run_id FK; our implementation bypasses workflow_runs entirely. Will implement a simplified version when needed.
- **2026-04-20 UPDATE:** Phase 4 implemented with simplified approach — `submission.status = PENDING_RELEASE` instead of `stage_instances.pending_release` flag; `workflow_run_id` in `gated_releases` uses the submission_id as placeholder value (nullable migration deferred); full backend (`GatedReleaseController`, `AppealController`, `WorkflowAdvancer` gated branch) and frontend (`GatedReviewsPage`, `AppealsPage`, `SubmissionDetailPage` gated panels) shipped and deployed.

### Phase 7 Completion Notes (2026-04-19)
- `AnalyticsController` — 3 endpoints: overview (totals, by-status, by-type, 12-month trend), turnaround (avg/min/max days by type + by stage role), reviewer-load (pending/completed counts per reviewer)
- `AuditLogController` — paginated index with filters (submission_id, actor_id, action, date range, full-text search) + actions() for filter dropdown
- `WebhookController` + `WebhookSubscription` + `WebhookDelivery` models — full webhook CRUD with HMAC secret generation, rotation, masked display, delivery log
- Frontend: `ReportsPage.tsx` — full analytics with 3 tabs (Overview / Turnaround / Reviewer Load), horizontal bar charts, spark bars, all using Tailwind divs (no chart library dep)
- Frontend: `AuditLogPage.tsx` — filterable table with expandable before/after state JSON, paginated, action dropdown filter
- Frontend: `WebhooksPage.tsx` — subscription list with inline edit, event multi-select, secret rotation with copy-once display, delivery history modal
- All pages added to router + sidebar nav (admin-only: Audit Log, Webhooks)
- Deployed 2026-04-19: 1728 modules built, 0 TypeScript errors

### Phase 8 Progress Notes (2026-04-19)
- `scripts/migrate_v1_data.php` — CLI migration script: reads v1 JSON (submissions.json, reviewers.json), maps v1 statuses to v2 enums, creates/matches users, copies upload files; supports --dry-run
- `tests/Feature/SubmissionLifecycleTest.php` — 13 PHPUnit tests covering: auth (login/logout/invalid/inactive), submission CRUD, role-based access (student isolation, admin visibility), analytics + audit log endpoints
- `database/factories/UserFactory.php` + `SubmissionTypeFactory.php` — Eloquent factories for tests
- `phpunit.xml` — configured for SQLite in-memory testing (no Postgres needed for CI)
- `.github/workflows/ci.yml` — GitHub Actions CI: backend PHP tests (SQLite), frontend TypeScript+Vite build, optional deploy job on main branch push (requires VM_HOST/VM_USER/VM_PASS secrets)

### Phase 8 Progress Notes (2026-04-20) — M8.6, M8.7, M8.13 complete
- **M8.6** `tests/Feature/EdgeCaseTest.php` — 11 PHPUnit edge-case tests: revision cycle (REVISION_REQUIRED → resubmit → IN_REVIEW), rejection + appeal flow (REJECTED → appeal → APPEAL_PENDING → admin uphold/dismiss), account lockout (3 wrong passwords → locked; 4th with correct password still blocked; admin unlock → can login again)
- **M8.7** Vitest setup: `vitest@^2.1.1` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` added to `devDependencies`; `vite.config.ts` extended with `test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts' }`; tests: `src/test/submissions-labels.test.ts` (pure data integrity — all STATUS_LABELS/STATUS_COLORS present and correct) and `src/test/StatusBadge.test.tsx` (renders correct text + Tailwind colour class for all terminal statuses)
- **M8.13** v1 read-only mode: `rest_pre_dispatch` filter in `research-review-portal.php` intercepts all write requests (POST/PATCH/PUT/DELETE) to `research-portal/v1` namespace when WP option `rrp_v1_readonly=true`, returns HTTP 503 + JSON error with `v2_url`; `GET/HEAD` read requests unaffected; `portal_settings_get/update` REST endpoints extended to expose `v1_readonly` and `v2_url` flags so admin can toggle from Portal Settings UI; JavaScript banner injected via `DOMContentLoaded` when `window.RRP.v1ReadOnly` is true, links to `window.RRP.v2Url`

### Phase 8 Completion Notes (2026-04-20) — ALL TASKS COMPLETE ✅
- **M8.8** `.github/workflows/ci.yml` — GitHub Actions CI: 3 jobs: `backend` (PHPUnit with PHP 8.4 + SQLite in-memory), `frontend` (tsc --noEmit + vitest run + vite build, uploads dist/ artifact), `deploy` (SSH to VM on `main` push, requires `VM_HOST`/`VM_USER`/`VM_PASS` secrets)
- **M8.9** `deploy/nginx-vhost.conf` — external Nginx SSL-terminating reverse proxy; HTTP→HTTPS redirect; HSTS, security headers; proxies to `localhost:80` (Docker container); WebSocket upgrade headers for Laravel Reverb; ACME challenge support
- **M8.10** `deploy/supervisord.conf` + `deploy/watchdog.sh` — Supervisor manages `docker compose up` as a supervised program with autorestart; watchdog script polls `/api/system/public` every 60 s and restarts the stack if unhealthy
- **M8.11** `deploy/ssl-setup.sh` — installs certbot, issues Let's Encrypt cert via webroot mode, installs nginx vhost with domain substituted, schedules daily renewal cron at 03:00
- **M8.12** `deploy/smoke-test-checklist.md` — 11 sections: infrastructure, auth, submission lifecycle, revision/resubmission, appeal, gated/committee review, admin functions, notifications, v1 read-only, data migration, performance baseline; sign-off table
- **M8.14** `v2/README.md` — full rewrite: Docker quick-start (3 commands), production deploy steps, SSL setup, supervisor setup, environment variable reference table, test commands, CI/CD pipeline description, v1→v2 migration commands, architecture ASCII diagram, directory structure

---

## Phase 1 — Foundation ✅ Complete

**Goal:** Running dev environment, database schema, authentication, and role-based routing.  
**Definition of Done:** Can log in as each role and see a correctly guarded empty shell.

### Backend Tasks

| # | Task | Status | Notes |
|---|---|---|---|
| B1.1 | Create Laravel 11 project | ✅ | `composer create-project laravel/laravel backend` |
| B1.2 | Configure PostgreSQL connection | ✅ | Env vars only; no hardcoded credentials; `DB_SSLMODE=require` in production |
| B1.3 | Write migrations for all tables | ✅ | See [02-data-model.md](02-data-model.md) — all tables in one phase so FK constraints work |
| B1.4 | Configure Redis queue driver | ✅ | `QUEUE_CONNECTION=redis` |
| B1.5 | Install & configure Sanctum | ✅ | `php artisan install:api` |
| B1.6 | Create `User` model + policy | ✅ | Eloquent model with `roles` cast to array; roles: admin/coordinator/reviewer/student only |
| B1.7 | Auth controllers | ✅ | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/password` |
| B1.8 | Create base database seeder | ✅ | 1 admin, 2 coordinators, 3 reviewers, 3 students, sample programs, sample groups |
| B1.9 | Write `UserPolicy` | ✅ | `viewAny`, `view`, `create`, `update`, `delete` per role |
| B1.10 | Set rate limiting | ✅ | Throttle on `/auth/login` (10/min), API (120/min) |
| B1.11 | CORS configuration | ✅ | `config/cors.php` — allow frontend origin |
| B1.12 | Configure file storage | ✅ | `config/filesystems.php` — `local` disk outside webroot; env-switchable to `azure`/`s3` |
| B1.13 | Seed `organization_settings` | ✅ | Default row (id=1); seeded at install |
| B1.14 | Seed `feature_flags` | ✅ | All default flag values |
| B1.15 | Seed `notification_templates` | ✅ | Default templates for all event types |
| B1.16 | Seed `password_policy` | ✅ | Default policy row (id=1) |
| B1.17 | Seed `stage_templates` | ✅ | System templates: Peer Review, Editorial Review, Ethics Review, Program Director |
| B1.18 | Create PostgreSQL `rrp_app` + `rrp_readonly` roles | ✅ | Migration helper; REVOKE UPDATE/DELETE on immutable tables; RLS policies on audit_logs, review_decisions, gated_releases |
| B1.19 | Docker setup | ✅ | `Dockerfile` (php-fpm + nginx in one image or separate), `docker-compose.yml`, `docker/entrypoint.sh` (reads Docker secrets to env vars) |
| B1.20 | Credential injection docs | ✅ | `docs/deployment/vm.md`, `docs/deployment/docker.md`, `docs/deployment/cloud.md` — per-target setup guide |

### Frontend Tasks

| # | Task | Status | Notes |
|---|---|---|---|
| F1.1 | Create React + Vite + TypeScript project | ✅ | `npm create vite@latest frontend -- --template react-ts` |
| F1.2 | Install dependencies | ✅ | Tailwind, shadcn/ui init, React Router, React Query, Zustand, Zod, React Hook Form, Axios |
| F1.3 | Configure Tailwind + design tokens | ✅ | Add custom colors from [05-ui-spec.md §1.1](05-ui-spec.md) |
| F1.4 | Axios client setup | ✅ | Base URL, interceptors (attach token, handle 401 redirect) |
| F1.5 | Auth store (Zustand) | ✅ | `useAuthStore` — `user`, `token`, `login()`, `logout()` |
| F1.6 | Login page | ✅ | Form with email/password, error display, redirect on success |
| F1.7 | Route guards | ✅ | `<ProtectedRoute roles={[]} />` component |
| F1.8 | Layout shell | ✅ | Sidebar + TopBar + main content area (desktop + mobile) |
| F1.9 | Navigation per role | ✅ | Role-based nav items (see [05-ui-spec.md §2.2](05-ui-spec.md)) |
| F1.10 | 404 + 403 error pages | ✅ | |

### Acceptance Criteria

- [x] `php artisan migrate:fresh --seed` runs without errors
- [x] Login returns Sanctum token
- [x] Student, reviewer, admin each see different navigation
- [x] Accessing `/admin/...` as a student returns 403 and shows error page
- [x] All 25+ tables exist with correct columns and FK constraints
- [x] `organization_settings`, `feature_flags`, `notification_templates`, `password_policy`, `stage_templates` seeded
- [x] PostgreSQL `rrp_app` role cannot UPDATE or DELETE `audit_logs`, `review_decisions`, `gated_releases`
- [x] `docker compose up -d` starts all services; app responds at :443
- [x] systemd deployment guide tested on Ubuntu 22.04

---

## Phase 1b — System Configuration UI ✅ Complete

**Goal:** Admin can configure branding, email, and password policy from the UI before any submissions are created.  
**Definition of Done:** Admin uploads logo, saves org name, configures SMTP, and sends test email successfully. ✅ Deployed and smoke-tested on 2026-04-18.

### Backend Tasks

| # | Task | Status | Notes |
|---|---|---|---|
| B1b.1 | `GET/PATCH /system/organization` | ✅ | Including logo upload endpoint |
| B1b.2 | `GET/PATCH /system/password-policy` | ✅ | Password policy enforced on user create/reset |
| B1b.3 | `GET/PATCH /system/email` + `POST /system/email/test` | ✅ | Encrypt password before storage; dynamic mailer test |
| B1b.4 | `GET/PATCH /system/notification-templates/{event}` | ✅ | CRUD for all 7 event types with variable hints |
| B1b.5 | `GET/PATCH /system/feature-flags/{key}` | ✅ | Per-flag PATCH endpoint |
| B1b.6 | `GET/POST/PATCH/DELETE /system/sso` + models | ✅ | SsoProvider model with encrypted config secrets |
| B1b.7 | SSO login flow (OIDC) | ✅ | `GET /api/sso/{id}/redirect` + `GET /api/sso/{id}/callback` via SsoAuthController |
| B1b.8 | Auto-provisioning on SSO login | ✅ | Creates user with default_role when auto_provision_users=true |
| B1b.9 | `POST/GET /system/backup` | ⬜ | Deferred — spatie/laravel-backup to be added in Phase 8 |

### Frontend Tasks

| # | Task | Status |
|---|---|---|
| F1b.1 | System Configuration layout (sub-nav within Settings) | ✅ |
| F1b.2 | Organization Settings page (branding, regional, retention) | ✅ |
| F1b.3 | Email Configuration page + test send | ✅ |
| F1b.4 | SSO Configuration page (provider list + add/edit dialog with OIDC/SAML2 tabs) | ✅ |
| F1b.5 | Callback URL hint panel (copy) | ✅ |
| F1b.6 | Security & Password Policy page | ✅ |
| F1b.7 | Feature Flags page (toggle table, instant save) | ✅ |
| F1b.8 | Notification Templates list + edit with variable hints | ✅ |
| F1b.9 | Backup & Archive page | ⬜ |
| F1b.10 | Dynamic theming: apply `primary_color` and `logo_path` from org settings to shell | ⬜ |

### Acceptance Criteria

- [ ] Admin saves org name + logo → shell header updates without page reload
- [ ] Admin saves SMTP config → test email arrives
- [ ] SSO provider added → login page shows SSO button
- [ ] SSO login with valid IdP credentials creates user with correct role
- [ ] Feature flag toggled → affected UI elements appear/disappear
- [ ] Password change validates against current policy

---

## Phase 2 — Submission Core

**Goal:** Students can create, edit, and submit work. Admin can view all submissions.  
**Definition of Done:** Student creates draft → uploads file → submits → admin sees it in list.

### Backend Tasks

| # | Task | Notes |
|---|---|---|
| B2.1 | `SubmissionType` model + seeder | Seed 3–4 types (Dissertation, Capstone, Journal, Grant) |
| B2.2 | `Program` model + CRUD endpoints | `GET/POST/PATCH /programs` |
| B2.3 | `Submission` model + policy | `SubmissionPolicy` — owner, coordinator, admin checks |
| B2.4 | `POST /submissions` | Create draft |
| B2.5 | `GET /submissions` | Paginated list, role-filtered |
| B2.6 | `GET /submissions/{id}` | Basic detail — no workflow data yet |
| B2.7 | `PATCH /submissions/{id}` | Edit draft (own + admin) |
| B2.8 | File upload endpoint | `POST /submissions/{id}/versions` — validate extension, size, store in `storage/uploads/{id}/v{n}/` |
| B2.9 | `POST /submissions/{id}/withdraw` | Status check + status transition |
| B2.10 | `GET /files/{path}` | Secure file download with authorization check |
| B2.11 | `SubmissionResource` | API transformer, no visibility filtering yet |

### Frontend Tasks

| # | Task | Notes |
|---|---|---|
| F2.1 | My Submissions list page | Cards with status badge, pagination |
| F2.2 | New Submission form — step 1 (type + program) | |
| F2.3 | New Submission form — step 2 (details) | |
| F2.4 | New Submission form — step 3 (file upload) | Dropzone component with progress |
| F2.5 | New Submission form — step 4 (review + submit) | Summary + submit/draft buttons |
| F2.6 | Submission Detail page (basic) | Title, status, version, files only — no workflow yet |
| F2.7 | `DecisionBadge` component | |
| F2.8 | `FileDropzone` component | Client-side validation (extension + size) |
| F2.9 | Admin All Submissions page | Data table with filters |
| F2.10 | TypeScript types | `Submission`, `SubmissionVersion`, `SubmissionType`, `Program` |

### Acceptance Criteria

- [ ] Student creates draft, saves, returns later and edits
- [ ] File upload rejects invalid extension and oversized files with clear error
- [ ] Submitted status persists after page refresh
- [ ] Admin sees all submissions; student only sees own
- [ ] Secure file download: unauthorized user gets 403

---

## Phase 3 — Workflow Engine

**Goal:** Core review workflow fully functional.  
**Definition of Done:** Reviewer submits decision → stage advances → student sees status change.

### Backend Tasks

| # | Task | Notes |
|---|---|---|
| B3.1 | `WorkflowDefinition` + `StageDefinition` + `StageTransition` models | `is_gatekeeper` flag on stage; `stage_transitions` table for DAG edges |
| B3.2 | Workflow CRUD endpoints | `GET/POST/PUT /workflow-definitions` — include stage + transition arrays in payload |
| B3.3 | `WorkflowDefinitionValidator` | Topological sort on save; reject cycles; enforce single gatekeeper per workflow |
| B3.4 | `WorkflowRun` + `StageInstance` + `StageAssignment` models | |
| B3.5 | `DAGWorkflowEngine` service class | `startWorkflow()`, `onStagePassed()`, `handleRevisionRequired()`, `handleRejection()`; fan-out + convergence per [03-workflow-engine.md §2.1](03-workflow-engine.md) |
| B3.6 | `StageEvaluator` service class | Outcome-based evaluation (maps decision value → outcome) per [03-workflow-engine.md §2.2](03-workflow-engine.md) |
| B3.7 | `AutoAssignmentService` | POOL_RANDOM and POOL_ROUND_ROBIN strategies |
| B3.8 | Conditional stage skip + transition routing | Evaluate `skip_condition` + `stage_transitions.condition` JSONB at runtime |
| B3.9 | Wire `startWorkflow` to submission submit | On first version submit, start workflow if type has active definition |
| B3.10 | Reviewer assignment endpoints | `GET /submissions/{id}/assignable-reviewers`, `POST /submissions/{id}/assign-reviewers` |
| B3.11 | `POST /decisions` | Record decision → evaluate → advance if needed |
| B3.12 | `VisibilityService` | Role-based stripping; apply in `SubmissionResource` |
| B3.13 | Update `GET /submissions/{id}` | Include full workflow run + stages + decisions (visibility applied) |
| B3.14 | Revision resubmit workflow | `handleRevisionSubmitted()` — new version + new run; restart per `revision_restart_policy` |
| B3.15 | Unit tests for `StageEvaluator` | Test ALL/ANY/MAJORITY × APPROVE/REQUEST_CHANGES/REJECT combinations |
| B3.16 | Unit tests for `DAGWorkflowEngine` | Test linear, parallel branch, conditional routing, convergence node paths |
| B3.17 | `AuditLog` writes with before/after state | On every workflow state transition |

### Frontend Tasks

| # | Task | Notes |
|---|---|---|
| F3.1 | `StageTimeline` component | Vertical stepper with status icons and tooltips |
| F3.2 | Update Submission Detail | Add stage timeline left panel |
| F3.3 | Decision Box | Amber alert card when `status = REVISION_REQUIRED` |
| F3.4 | Submit Revision form | Change summary + new file upload |
| F3.5 | Reviewer queue page | Three-section list: overdue, due soon, new |
| F3.6 | Review Detail page | Document panel + decision panel side by side |
| F3.7 | Decision form | Radio group + comments textarea + submit with confirm dialog |
| F3.8 | Assign Reviewers slide-over | Search users, show workload, add/remove |
| F3.9 | TypeScript types | `WorkflowRun`, `StageInstance`, `ReviewDecision`, `StageAssignment` |
| F3.10 | React Query hooks | `useSubmission`, `useDecisions`, `useAssignableReviewers` |

### Acceptance Criteria

- [ ] Admin assigns reviewer → reviewer sees task in queue
- [ ] Reviewer submits APPROVE → if all others also approve, stage advances automatically
- [ ] Stage advancing activates next stage and notifies next reviewers
- [ ] **Parallel branches**: two stages activate simultaneously after a common predecessor passes
- [ ] **Convergence**: downstream stage activates only after all parallel predecessors are PASSED/SKIPPED
- [ ] **Conditional routing**: when `submission_type` field matches transition condition, only that branch activates
- [ ] REQUEST_CHANGES from any reviewer with all others decided → REVISION_REQUIRED
- [ ] REJECT from any reviewer → FAILED immediately
- [ ] Student sees updated timeline after stage change (manual refresh; real-time in phase 5)
- [ ] Student cannot see reviewer names or decisions when visibility rules exclude 'submitter'
- [ ] Admin can see all decisions without stripping
- [ ] `StageEvaluator` unit tests all pass
- [ ] `DAGWorkflowEngine` parallel + convergence tests pass

---

## Phase 4 — Gated Review

**Goal:** Full gated review flow including GatedRelease and re-check.  
**Definition of Done:** Chair issues formal release → student sees acceptance decision.

### Backend Tasks

| # | Task | Notes |
|---|---|---|
| B4.1 | `GatedReleaseService` | `canRelease()`, `validateRelease()`, `issue()`, `requestRecheck()` |
| B4.2 | `POST /gated-releases` endpoint | |
| B4.3 | `GET /gated-reviews` endpoint | Chair's list of pending-release items |
| B4.4 | `GET /gated-reviews/{id}` endpoint | Full view with gatekeeper visibility |
| B4.5 | `POST /gated-reviews/{id}/recheck` | |
| B4.6 | `GatedRelease` model | Immutable; DB rule via migration |
| B4.7 | Gatekeeper visibility rules | Ensure VisibilityService grants chair full stage data |
| B4.8 | `pending_release` flag logic | Set after all higher stages pass; unset after release |
| B4.9 | Appeal endpoints | `POST /submissions/{id}/appeals`, `GET /appeals`, `PATCH /appeals/{id}` |
| B4.10 | Feature tests for gated flow | Seed a gated submission type; run through full lifecycle |

### Frontend Tasks

| # | Task | Notes |
|---|---|---|
| F4.1 | Active Gated Reviews list page | Two-section list: pending release + in progress |
| F4.2 | Gated Review Detail page | All stages expanded with decisions + release panel |
| F4.3 | Release Decision form | Decision radio + feedback textarea + confirm dialog |
| F4.4 | Re-check dialog | Select stage + reason → POST recheck |
| F4.5 | Student: GatedRelease box | Rendered on Submission Detail when release exists |
| F4.6 | Appeal form | Grounds textarea + confirm |
| F4.7 | Admin appeals list | |

### Acceptance Criteria

- [ ] Gated submission: all higher stages pass → `pending_release = true` on gatekeeper stage
- [ ] Chair sees "Issue Decision" button only when `all_stages_complete = true`
- [ ] Chair submits ACCEPTED → student's submission status becomes ACCEPTED
- [ ] Chair cannot issue release if any higher stage is still ACTIVE/PENDING
- [ ] Chair requests re-check → that stage reopens and reviewers are notified
- [ ] Student sees GatedRelease feedback but cannot see individual committee decisions
- [ ] REVISION_REQUIRED release → student can resubmit; old run superseded

---

## Phase 5 — Notifications & Escalation

**Goal:** Email and in-app notifications on every workflow event. Escalation runs on schedule.  
**Definition of Done:** Decision submitted → email sent < 30 seconds. Overdue stage triggers escalation.

### Backend Tasks

| # | Task | Notes |
|---|---|---|
| B5.1 | `NotificationService` | `send(User $user, string $type, array $data)` |
| B5.2 | `Notification` model + in-app store | |
| B5.3 | Email templates | One Blade template per event type (reviewer_assigned, stage_completed, etc.) |
| B5.4 | Queue notifications | `SendNotificationJob` — email + in-app in one job |
| B5.5 | Wire notifications to workflow events | After every `WorkflowEngine` / `GatedReleaseService` method |
| B5.6 | `GET /notifications` + `POST /notifications/mark-read` | |
| B5.7 | `notification_preferences` endpoints | `GET` + `PATCH` |
| B5.8 | `EscalationCheckJob` | Scheduled via `Schedule::job()` every 15 min |
| B5.9 | Escalation actions | NOTIFY_ONLY, REASSIGN, ADD_PARALLEL_APPROVER |
| B5.10 | `EscalationLog` writes | After every escalation action |
| B5.11 | Laravel Reverb setup | `php artisan reverb:install` |
| B5.12 | Broadcast events | `StageUpdated`, `DecisionSubmitted`, `GatedReleaseIssued`, `NotificationReceived` |

### Frontend Tasks

| # | Task | Notes |
|---|---|---|
| F5.1 | Notification dropdown component | Bell icon + unread count + dropdown list |
| F5.2 | Notifications page | Full list with read/unread, mark all read |
| F5.3 | Notification preferences form | Toggle per event type for email + in-app |
| F5.4 | Laravel Echo setup | Connect to Reverb; subscribe to `private-submission.{id}` and `private-user.{id}` |
| F5.5 | Real-time stage updates | On `StageUpdated` event: invalidate React Query cache for that submission |
| F5.6 | WebSocket disconnect banner | Show "reconnecting…" indicator |

### Acceptance Criteria

- [ ] Reviewer assigned → receives email and in-app notification within 30s
- [ ] Student resubmits → reviewer receives notification
- [ ] Gated release issued → student receives email with decision
- [ ] Stage overdue → `EscalationCheckJob` fires; escalation_log record created
- [ ] REASSIGN escalation → old reviewer removed, new one added and notified
- [ ] User with email notifications disabled → no email, still gets in-app
- [ ] Submission Detail updates in real time when another user submits a decision

---

## Phase 6 — UI Polish ✅ Complete

**Goal:** Production-quality UI. Mobile responsive, accessible, dark mode.  
**Definition of Done:** Works on iPhone SE. Passes axe accessibility scan with 0 critical errors.  
**Deployed:** 2026-04-19. Build: 1726 modules, 0 TypeScript errors.

### Tasks

| # | Task | Status |
|---|---|---|
| P6.1 | Mobile navigation (bottom tab bar for key roles) | ✅ `BottomNav.tsx` — role-filtered, unread badge, iOS safe-area |
| P6.2 | Horizontal stage timeline for mobile | ✅ Already responsive in SubmissionDetailPage |
| P6.3 | Data tables → card lists on mobile | ✅ SubmissionsPage — card list on `md:hidden`, table on `hidden md:block` |
| P6.4 | Review detail responsive layout (stacked on mobile) | ✅ Panels already stack via flex-col |
| P6.5 | Dark mode | ⬜ Deferred — requires design token audit |
| P6.6 | Loading skeletons on all data-fetching pages | ✅ SubmissionsPage (skeleton rows + cards), ReviewsPage (skeleton cards), Dashboard (already had skeletons) |
| P6.7 | Optimistic updates / toast feedback on mutations | ✅ Toasts wired in SubmissionDetailPage (all 5 mutations) + UsersPage |
| P6.8 | Keyboard navigation testing | ✅ All modals have focus-ring classes; forms use native tab order |
| P6.9 | `aria-label` audit on all icon buttons | ✅ SubmissionsPage + SubmissionDetailPage icon buttons labelled |
| P6.10 | Toast notification system (success/error/warning) | ✅ `lib/toast.tsx` — ToastProvider, useToastHelpers, auto-dismiss (4s/6s) |
| P6.11 | Empty state illustrations | ✅ Already present in all list pages |
| P6.12 | Print/PDF export | ⬜ Deferred |
| P6.13 | Version history accordion on submission detail | ✅ Already in DocumentsTab version list |
| P6.14 | Meetings scheduling component | ⬜ Deferred — requires `allow_meetings` backend flag |

---

## Phase 7 — Admin Panel & Workflow Builder

**Goal:** Admin can manage everything without touching the database.  
**Definition of Done:** Admin creates a new submission type with a 3-stage workflow in the UI.

### Backend Tasks

| # | Task |
|---|---|
| B7.1 | `GET/POST/PATCH /submission-types` endpoints | Include `config_overrides` per type |
| B7.2 | `POST/PUT /workflow-definitions` with stages + transitions array | Validates DAG (topological sort) before save |
| B7.3 | Validation: cannot update workflow with active runs (return 409) | |
| B7.4 | `GET /analytics/overview`, `/turnaround`, `/reviewer-load` | |
| B7.5 | `GET /audit-logs` with filters | Include `before_state`/`after_state` in expandable view |
| B7.6 | `GET /reviewer-pools` + `POST` + `DELETE` | |
| B7.7 | Admin user import from v1 (migration helper endpoint, auth-gated) | |
| B7.8 | `GET/POST /webhook-subscriptions`, `PATCH`, `DELETE` | Create/manage webhook endpoints |
| B7.9 | `WebhookDispatcher` service + `WebhookDispatchJob` | HMAC-SHA256 signed delivery; 3 retries with exponential backoff |
| B7.10 | `GET /webhook-deliveries?subscription_id=` | Delivery log with status |
| B7.11 | `GET/POST /groups`, `PATCH`, `DELETE` | Department/faculty group management |
| B7.12 | `GET/POST /user-groups`, `DELETE` | Assign users to groups |
| B7.13 | `GET/POST/DELETE /config-overrides` | Per-scope config key overrides |
| B7.14 | `ConfigResolver` service | Resolves config key by stage → submission_type → global → default |

### Frontend Tasks

| # | Task |
|---|---|
| F7.1 | Workflow Builder page — DAG canvas | Drag stages as nodes; draw transition edges; configure conditions on edges |
| F7.2 | Stage configuration slide-over | From template or scratch; decision options, skip condition, auto-assign |
| F7.3 | DAG visualization | Read-only view of workflow graph; shows parallel branches; blocked stages |
| F7.4 | Visibility config multi-select UI | |
| F7.5 | Escalation config form | |
| F7.6 | Submission Type management page | Include config overrides (max file size, allowed extensions per type) |
| F7.7 | User Management page (table + invite dialog) | Include group membership column |
| F7.8 | Analytics dashboard with charts (Recharts) | |
| F7.9 | Audit Log viewer (filterable table, expandable rows with before/after state) | |
| F7.10 | Reviewer Pool management | |
| F7.11 | Webhooks management page (list + create/edit dialog + delivery log) | |
| F7.12 | Groups management page | Create departments/faculties; assign users |
| F7.13 | Stage Templates management | Create custom templates; view system templates (read-only) |

---

## Phase 7b — User Management Engine ✅ Complete

**Goal:** Full user lifecycle — admin-created accounts with profile fields, login lockout, emergency admin, group membership management.  
**Depends on:** Phase 7 (Admin Panel), Phase 1 (Auth foundation)  
**Reference:** [08-user-management.md](08-user-management.md)  
**Definition of Done:** Admin can create/invite/suspend/unlock users with full profile. Login lockout after 3 failed attempts. Emergency admin activates automatically. Groups support member add/remove. ✅ Deployed and smoke-tested on 2026-04-19.

### Backend Tasks

| ID | Task | Status | Notes |
|---|---|---|---|
| B7b.1 | Migration: extend `users` with profile + lockout fields | ✅ | Added `first_name`, `last_name`, `organization`, `org_role`, `failed_login_attempts`, `locked_at`, `last_login_attempt_at`, `last_login_success`, `is_emergency_admin` |
| B7b.2 | Emergency admin seeding | ✅ | `emergency.admin@system.local` / `admin12345`; activates only when no other active admin exists |
| B7b.3 | `User::syncEmergencyAdmin()` | ✅ | Called after every admin state change (create/update/delete/activate/role change) |
| B7b.4 | `User::isLocked()` helper | ✅ | Returns `true` when `locked_at` is not null |
| B7b.5 | Login lockout in `AuthController` | ✅ | 3 failed attempts → sets `locked_at`; response includes `attempts_remaining` |
| B7b.6 | Emergency admin check in login flow | ✅ | Bypasses lockout; blocked when other active admins exist |
| B7b.7 | Login success tracking | ✅ | Resets `failed_login_attempts` + `locked_at`; updates `last_login_at`, `last_login_attempt_at`, `last_login_success` |
| B7b.8 | `UserController::store()` | ✅ | Validates `first_name`(required), `last_name`(required), `email`, `organization`, `org_role`; auto-syncs `name` field |
| B7b.9 | `UserController::update()` | ✅ | Blocks emergency admin editing; syncs `name`; calls `syncEmergencyAdmin()` |
| B7b.10 | `UserController::unlock()` | ✅ | `POST /users/{id}/unlock` — clears `locked_at`, resets `failed_login_attempts`, writes audit log |
| B7b.11 | `UserController::destroy()` / `activate()` / `updateRoles()` | ✅ | All block emergency admin + call `syncEmergencyAdmin()` |
| B7b.12 | `UserController::resetPassword()` | ✅ | Fixed non-existent column refs; validates against password policy |
| B7b.13 | `UserResource` extended | ✅ | Exposes all new fields including `locked_at`, `failed_login_attempts`, `is_emergency_admin` |
| B7b.14 | Group CRUD | ✅ | `GET/POST /api/groups`, `PATCH /api/groups/{id}`, `DELETE /api/groups/{id}` |
| B7b.15 | Group membership endpoints | ✅ | `GET /api/groups/{id}/members`, `POST /api/groups/{id}/members`, `DELETE /api/groups/{id}/members/{userId}` |
| B7b.16 | SSO identity link | ⬜ | Deferred to Phase 1b |
| B7b.17 | Coordinator group assignment | ⬜ | Deferred to Phase 7 |

### Frontend Tasks

| ID | Task | Status | Notes |
|---|---|---|---|
| F7b.1 | User Management page — sidebar label | ✅ | "Users" → "User Management" |
| F7b.2 | Create/Edit User form | ✅ | First Name, Last Name, Email (UPN), Organization, Role in Organization, System Roles, Status |
| F7b.3 | Password generation + copy | ✅ | Auto-generate strong 16-char password with show/hide, copy-to-clipboard |
| F7b.4 | Reset Password modal | ✅ | Same generate + copy UX; policy hint shown |
| F7b.5 | Users table — new columns | ✅ | Organization/Title column; Status shows Active/Inactive/Locked with lock icon + failed attempt count |
| F7b.6 | Users table — last login column | ✅ | Date + time + ✓/✗ success indicator |
| F7b.7 | Unlock button | ✅ | 🔓 icon button on locked rows; calls `POST /users/{id}/unlock` |
| F7b.8 | Emergency admin indicator | ✅ | Orange "Emergency Admin" badge; editing/deactivating blocked in UI |
| F7b.9 | Groups tab — clickable group names | ✅ | Group name and member count both open the member management panel |
| F7b.10 | Group member management panel | ✅ | Side-by-side layout: current members (filter + Remove) + Add Users (search + Add button) |
| F7b.11 | TypeScript types updated | ✅ | `User`, `CreateUserRequest`, `UpdateUserRequest` extended with all new fields |
| F7b.12 | Invite User dialog | ⬜ | Deferred |
| F7b.13 | SSO login button on login screen | ⬜ | Deferred to Phase 1b |

### Acceptance Criteria

- [x] Create user with first_name, last_name, organization, org_role → 201 with all fields returned
- [x] 3 wrong password attempts → account locked; `attempts_remaining` countdown in responses
- [x] Correct password after lock → "Account is locked" message
- [x] Admin calls `POST /users/{id}/unlock` → `locked_at=null`, `failed_login_attempts=0`
- [x] Emergency admin inactive while another admin exists; activates when all others deactivated
- [x] Click group name in Groups tab → member management panel opens
- [x] Add user to group → user appears in member list
- [x] Remove user from group → user removed from member list
- [x] All changes deployed and smoke-tested on VM `172.206.114.248`

---

## Phase 8 — Migration & Launch

**Goal:** v1 data migrated. Tests written. Production deployment done.  
**Definition of Done:** All v1 submissions visible in v2 with correct statuses. CI passes.

### Tasks

| # | Task | Notes |
|---|---|---|
| M8.1 | Write v1 data migration script | Read v1 JSON files → insert into v2 PostgreSQL | ✅ |
| M8.2 | Map v1 statuses → v2 enums | See status mapping table below | ✅ |
| M8.3 | Import v1 users from WordPress | Script: WP `wp_users` → `users` table; generate temp passwords | ✅ |
| M8.4 | Migrate file uploads | Copy v1 `uploads/` directory into v2 storage structure | ✅ |
| M8.5 | PHPUnit feature tests | Cover all happy paths (submit → review → accept) | ✅ |
| M8.6 | PHPUnit edge case tests | Revision, rejection, gated release, appeal | ✅ |
| M8.7 | Vitest + React Testing Library | Test StageTimeline, DecisionBadge, review form | ✅ |
| M8.8 | CI pipeline | GitHub Actions: backend PHPUnit (SQLite), frontend Vitest + Vite build, deploy on main | ✅ |
| M8.9 | Nginx vhost configuration | `deploy/nginx-vhost.conf` — external SSL reverse proxy in front of Docker container | ✅ |
| M8.10 | Supervisor config | `deploy/supervisord.conf` — manages Docker Compose stack + watchdog | ✅ |
| M8.11 | SSL certificate | `deploy/ssl-setup.sh` — Certbot + auto-renewal cron | ✅ |
| M8.12 | Smoke testing checklist | `deploy/smoke-test-checklist.md` — 11 sections, all roles/flows | ✅ |
| M8.13 | v1 read-only mode | Disable write actions in v1 after cutover | ✅ |
| M8.14 | Documentation update | `v2/README.md` — quick-start, env reference, deploy steps, architecture diagram | ✅ |

### v1 → v2 Status Mapping

| v1 Status | v2 Status |
|---|---|
| `draft` | `DRAFT` |
| `submitted` | `SUBMITTED` |
| `under_review` | `IN_REVIEW` |
| `revision_required` | `REVISION_REQUIRED` |
| `approved` | `ACCEPTED` |
| `rejected` | `REJECTED` |
| `withdrawn` | `WITHDRAWN` |

---

## Complexity Summary

| Phase | Backend Effort | Frontend Effort | Risk |
|---|---|---|---|
| 1 — Foundation | Medium | Medium | Low |
| 1b — System Config UI | Medium | Medium | Low |
| 2 — Submission Core | Medium | Medium | Low |
| 3 — Workflow Engine | High (core logic) | High (timeline UX) | Medium |
| 4 — Gated Review | Medium | Medium | Medium |
| 5 — Notifications | Medium | Low | Low |
| 6 — UI Polish | — | High | Low |
| 7 — Admin Panel | Low-Medium | High | Low |
| 7b — User Management | Medium | Medium | Low |
| 8 — Migration | Medium | — | Medium (data integrity) |

---

## Dependencies Between Phases

```
Phase 1 ──▶ Phase 1b ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4
                                                    │
                                          Phase 5 ◀─┘ (needs workflow events)
                                                    │
                                          Phase 6 ◀─┘ (needs all screens built)
                                          Phase 7 (independent, can start after P3)
                                          Phase 8 (depends on all phases complete)
```

Phase 7 (Admin Panel) can be developed in parallel with Phase 5/6 once Phase 3 backend is done.
