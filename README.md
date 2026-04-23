# CityU Research Review Portal

A full-featured, multi-role research submission and peer review management platform for universities and research institutions. It replaces manual email-based review processes with a structured, auditable, web-based workflow — from initial submission through peer review, gated release, appeals, and final decision.

---

## Overview

The Research Review Portal (RRP) gives every stakeholder a purpose-built interface for their role in the research review process. Students submit research and track its progress in real time. Reviewers evaluate submissions and record structured decisions. Coordinators orchestrate the review process, manage reviewer assignments, and oversee appeals. Administrators configure the portal, manage users, and monitor system health.

The entire lifecycle — from draft to decision — is tracked, timestamped, and logged. No research is lost in an inbox.

---

## Key Benefits

| Benefit | Description |
|---|---|
| **End-to-end traceability** | Every action — submission, assignment, decision, appeal — is recorded in an immutable audit log |
| **Configurable workflows** | Review processes are defined as directed-acyclic-graph (DAG) workflows; no code changes needed to add stages, parallel branches, or conditional routing |
| **Role-appropriate interfaces** | Students, reviewers, coordinators, and administrators each see only what is relevant to their role |
| **Real-time visibility** | WebSocket-powered live updates mean all parties see status changes the moment they happen |
| **Automated notifications** | Email alerts are dispatched automatically for every significant workflow event — submission received, reviewer assigned, decision posted, deadline approaching |
| **Deadline management** | Per-stage due dates with configurable escalation rules; overdue items surface automatically |
| **Built for scale** | Asynchronous queue-based processing handles large volumes of submissions without slowing the UI |
| **Secure by design** | HTTPS-only, CSRF protection, per-resource authorization policies, rate limiting, and OWASP-aligned security controls |
| **Self-hosted or cloud** | Deploy on any Ubuntu server, in Docker, or on any cloud provider — with a single script |

---

## Features

### Submission Management

- **13 submission statuses** tracked throughout the lifecycle: Draft → Submitted → In Review → Revision Required → Accepted / Conditionally Accepted / Rejected → Withdrawn / Appeal Pending
- **Versioned resubmissions** — each revision creates a new tracked version while preserving the full history
- **File uploads** with configurable allowed extensions and per-category size limits
- **Student withdraw** — students can retract active submissions; coordinators can cancel on their behalf
- **Communication tab** — threaded in-portal messaging between students and reviewers per submission
- **APA 7 References tool** — integrated citation builder for students

### Review Workflows

- **DAG-based workflow engine** — stages can run in sequence, in parallel, or conditionally based on submission metadata
- **Configurable approval strategies** — majority, unanimous, or minimum-approvals per stage
- **Gated release** — final decision can be held pending coordinator/chair release, even after all reviewers have voted
- **Reviewer conflict-of-interest declarations** — reviewers can flag and recuse themselves
- **Extension requests** — reviewers can request additional time; coordinators approve or deny
- **Blind review mode** — configurable per workflow to anonymise student details from reviewers
- **Stage skip conditions** — stages can be automatically bypassed based on submission metadata rules

### Reviewer Tools

- **Assignments dashboard** — all active and past review assignments in one view
- **Inline document annotation** — annotate uploaded PDFs and DOCX files directly in the browser
- **Structured decision forms** — Accept / Conditionally Accept / Reject / Revision Required with required comments
- **My Analytics** — personal performance metrics: review turnaround time, decision distribution, overdue rate

### Coordinator Tools

- **Review Management** — full oversight of all submissions across all stages
- **Reviewer Pool** — manage reviewer profiles, expertise tags, and workload caps
- **Auto-assignment** — rules-based automatic reviewer assignment by expertise, workload, and conflict checks
- **Gated Reviews** — release or override final decisions before they are visible to students
- **Appeals Management** — review and adjudicate student appeals on rejected submissions
- **Meeting / Calendar integration** — schedule review committee meetings and link them to submissions
- **Announcements** — broadcast portal-wide notices to all users or specific roles
- **Programs** — organise submissions by academic program or department
- **Reports** — exportable analytics on submission volumes, review times, decision rates, and reviewer workload

### Similarity / Plagiarism Checking

- **Turnitin integration** — automatic similarity report on submission; results visible to reviewers and coordinators
- **Built-in similarity check** — local comparison against all other portal submissions when Turnitin is not configured

### Administrator Tools

- **User Management** — create, edit, deactivate, and assign roles (student / reviewer / coordinator / admin) to any user
- **Submission Categories** — define research types with custom metadata schemas, file requirements, and workflow assignments
- **Workflow Designer** — create and version DAG-based review workflows with drag-and-drop stage configuration
- **Settings** — Organisation branding, email (SMTP), SSO providers (OIDC / Azure AD), password and security policy, feature flags, notification toggles, integrations, and backup management — all configurable from the UI with no server restart
- **Audit Log** — immutable record of every user action and system event, searchable and filterable
- **Webhooks** — push portal events to external systems (e.g. HRIS, LMS) via HMAC-signed HTTP callbacks
- **Feature Flags** — enable or disable portal features (blind review, gated release, appeals, meetings, References tool) without touching code

### Security

- Laravel Sanctum token authentication with CSRF protection
- Per-resource authorization policies (no role-based shortcuts — every action is checked against the specific record)
- Rate limiting on auth, submission, and file upload endpoints
- HTTPS-only with HSTS, TLS 1.2/1.3, and security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Configurable password policy: minimum length, complexity rules, expiry, reuse limit, lockout threshold

### Notifications

Automated email notifications for: submission received, reviewer assigned, review decision posted, revision requested, resubmission received, submission accepted/rejected, appeal received/resolved, deadline approaching, and more.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand |
| **Backend** | Laravel 10, PHP 8.4, Laravel Sanctum, Laravel Reverb (WebSockets) |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7 |
| **Runtime** | Docker (PHP 8.4-FPM + Nginx 1.25 in one container) |
| **Process manager** | Supervisor (queue worker + watchdog) |
| **TLS** | Let's Encrypt via Certbot |

---

## Roles

| Role | What they do |
|---|---|
| **Student** | Submit research, track status, respond to revision requests, raise appeals, use the References tool |
| **Reviewer** | Evaluate assigned submissions, record decisions, request extensions, declare conflicts of interest |
| **Coordinator** | Assign reviewers, manage the review process, handle appeals and gated releases, run reports |
| **Administrator** | Configure the portal, manage users and workflows, monitor the audit log, set up integrations |

---

## Quick Start

```bash
# Docker (any machine with Docker installed)
bash deploy/quick-start-docker.sh

# Docker on a custom port
bash deploy/quick-start-docker.sh --port 8080

# Production server with SSL
export ADMIN_EMAIL=admin@myorg.com
sudo bash deploy/quick-start-docker.sh --domain portal.myorg.com --https --no-seed

# Bare-metal Ubuntu (no Docker)
sudo bash deploy/install.sh --domain portal.myorg.com --email admin@myorg.com
```

Default login after seeding: **`admin@cityu.edu`** / **`admin12345`**  
Change this immediately after first login.

For full deployment options see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Documentation

| Document | Description |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | All deployment options: Docker, bare-metal, cloud VM, CI/CD |
| [USER-MANUAL.md](USER-MANUAL.md) | Role-by-role guide for students, reviewers, coordinators, and admins |
| [OPERATIONS-MANUAL.md](OPERATIONS-MANUAL.md) | Sysadmin reference: backups, updates, SSL, monitoring, troubleshooting |
| [GETTING-STARTED.md](GETTING-STARTED.md) | Local development setup |

---

## Repository Structure

```
.
+-- backend/              Laravel 10 API (PHP 8.4)
+-- frontend/             React + TypeScript SPA
+-- deploy/               Deployment and operations scripts
|   +-- quick-start-docker.sh   Single-command Docker deployment
|   +-- install.sh              Bare-metal Ubuntu installer
|   +-- install-remote.sh       Remote cloud VM deployment
|   +-- update.sh               Incremental update script
|   +-- rollback.sh             Restore from backup
|   +-- backup.sh               Database + files backup
|   +-- ssl-setup.sh            Let's Encrypt TLS provisioning
|   +-- nginx-vhost.conf        Production Nginx vhost
|   +-- supervisord.conf        Supervisor process config
|   +-- watchdog.sh             Health-check watchdog
|   +-- smoke-test-checklist.md Post-deployment verification
+-- docker/               Docker support files (entrypoint, postgres init)
+-- spec/                 Architecture and feature specification docs
+-- Dockerfile            Multi-stage build (Node + Composer + Ubuntu runtime)
+-- docker-compose.yml    Full stack: app, worker, postgres, redis
```

---

## License

This project is maintained by CityU Research Technology. Contact the repository owner for licensing terms.
