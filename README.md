# CityU Research Review Portal

**Version:** 2.0 · **Platform:** WordPress Plugin · **Language:** PHP 8.1 + Vanilla JavaScript  
**Institution:** City University of Seattle — School of Technology and Computing (STC)  
**Authors:** Kiran Kumar Vejendla · Jemell Garris  
**Live URL:** `https://portal.your-institution.edu`  
**Health check:** `GET /wp-json/research-portal/v1/health` → `{"ok":true}`

---

## What is this?

The **CityU Research Review Portal** is a full-featured academic research submission and peer-review management system built as a WordPress plugin. It replaces the default WordPress front end with a single-page application (SPA) that provides structured, multi-stage review workflows for all major research output types at City University of Seattle.

Researchers submit their work, coordinators assign reviewers, reviewers give structured feedback — and the portal automatically moves submissions through each stage, sends email notifications, and keeps a complete audit trail.

---

## Submission Types

| ID Prefix | Type | Stages |
|-----------|------|--------|
| `ARS` | Academic Research / Conference Paper | 6 |
| `PUB` | Journal Publication | 6 |
| `PROJ` | Student Project | 6 |
| `GRN` | Grant Proposal | 7 |

Custom submission types can be added through the Administration panel.

---

## User Roles

| Role | Description |
|------|-------------|
| **Student / Researcher** | Submits research, tracks status, uploads revisions |
| **Reviewer** | Reviews assigned submissions, records decisions, gives feedback |
| **Coordinator** | Manages workflow, assigns reviewers, handles escalations |
| **Portal Admin** | Full system configuration, user management, analytics |
| **Faculty** | Extended student role with additional type access |
| **Public** | (Optional) External submitters via self-registration |

Custom roles can be created from the Administration panel.

---

## Feature Overview

### Submission & Document Management
- Multi-type submission form with client + server validation and draft saving
- Automatic ID generation — year-scoped, zero-padded (e.g. `ARS-2026-007`)
- Configurable file uploads — type whitelist, max size, max count (admin-configurable)
- ClamAV virus scanning and real MIME-type verification on every upload
- Inline document viewer — PDF (iframe) and DOCX (mammoth.js)
- Reviewer annotation upload — reviewers attach a marked-up copy
- Version and revision tracking — round counter, full attachment history per revision
- **Two-phase submission** — abstract-first → full paper workflow per submission type
- Submission withdrawal by submitter; coordinator/admin cancel with mandatory reason
- **Revision diff view** — side-by-side metadata comparison between revision rounds

### Multi-Stage Review Workflow
- Sequential stage progression with configurable required reviewer count per stage
- Automatic advancement when all stage approvals are collected
- Parallel review — multiple reviewers per stage
- Revision request — returns submission to submitter with structured feedback
- Stage skipping — coordinator/admin with mandatory justification
- Reviewer assignment modes: random pool, round-robin, or expertise-based matching
- Workload-aware assignment — active/completed counts shown in assignment panel
- Auto-assignment on submission if a pool is configured
- **Double-blind review** — per-type toggle; hides identities until final decision

### Reviewer Tools
- Rich text feedback editor (bold, italic, underline, strikethrough, bullet/numbered lists, blockquote) — self-contained, no CDN
- Review criteria templates — pre-populated guidance per submission type
- Scoring / rating system — weighted multi-criteria scores with comments
- **Collaborative stage notes** — shared per-stage workspace with live-sync and presence badge
- Conflict of interest (COI) declaration — triggers coordinator notification and reassignment
- Extension requests — reviewer requests more time; coordinator approves/denies
- Calendar integration — Google Calendar links, Outlook links, and `.ics` download

### Deadline & Calendar Management
- Per-stage due-day configuration (admin-configurable per submission type)
- Working-day calculation — configurable weekend and public holiday skipping
- Grace period and extension approval workflow
- **Deadline calendar view** — monthly grid of all active-stage deadlines
- **My Deadlines** — personal deadline calendar for students and reviewers
- `.ics` download, Google Calendar link, and Outlook link on every deadline badge

### Status Tracking & Notifications
- Real-time submission status dashboard for all roles
- Stage timeline view — full chronological log of every decision and status change
- Audit log — per submission; 10+ event types; accessible via UI and REST API
- Email notifications for all key events (confirmation, assignments, decisions, revisions, appeals)
- In-app notification centre — pending review and revision alerts
- **Configurable notification preferences** — per-user opt-in/out for 7 categories
- Automatic deadline reminder emails (3 days before; WP-Cron daily)
- Escalation emails — daily cron notifies coordinators of overdue submissions
- Estimated completion dates on student dashboard
- Session timeout warning — configurable idle timeout with 5-minute pre-expiry alert

### Administrative Features
- Full CRUD user management from coordinator dashboard
- Reviewer pool management — assignment mode, reviewer IDs, expertise per type
- Bulk reviewer assignment across active submissions
- Analytics dashboard — workflow throughput, reviewer performance, submission trends, overdue
- CSV / XLSX export
- Submission filtering and free-text search (title / ID / submitter)
- Inactive submission detection (30/60/90/180 days) and bulk cancel
- **Decision appeal / reconsideration** — tracked statuses: *Appeal Pending*, *Appeal Under Review*
- **Bulk email / announcement broadcast** — to submitters or reviewers, filtered by type/status/dept
- **Plagiarism / similarity check** — iThenticate, Turnitin, or CORE API; configurable in Portal Settings
- **Webhooks** — HMAC-signed POST delivery on key submission events
- Custom roles beyond the five built-in ones
- Program and department management

### Security & Technical
- OWASP-compliant input sanitisation on all REST endpoints
- WordPress nonce authentication and capability-checked routes on all endpoints
- Rate limiting on public endpoints (IP-based, WP transients)
- HTTPS enforced — Let's Encrypt auto-renewing certificate
- Strict Content Security Policy headers
- AES-256-GCM encryption for SMTP password at rest
- **Configurable SMTP** — host, port, encryption, credentials, from address; test-email endpoint
- **Configurable upload settings** — max file size, max count, allowed extensions (admin UI)
- **Microsoft Entra ID SSO** — OAuth2 flow; optional, enabled in Portal Settings
- **Data backup & restore** — ZIP of all JSON + uploads; ZipSlip-protected restore
- **Data archive** — move terminal submissions into dated ZIP archives

---

## Documentation

| Document | Purpose |
|----------|---------|
| [USER-MANUAL.md](USER-MANUAL.md) | Complete guide for Students, Reviewers, Coordinators, and Admins |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker and Azure VM deployment instructions |
| [OPERATIONS-MANUAL.md](OPERATIONS-MANUAL.md) | Maintenance, backup, API reference, troubleshooting |
| [requirements.md](requirements.md) | Full requirements list with implementation status |

---

## Quick Start (Docker)

```bash
cp .env.example .env      # edit WP_URL if not localhost
make up                   # build and start containers
make init                 # install WordPress + activate plugin (first time only)
```

Open `http://localhost:8080` — portal loads at the front page.

Create role-specific test users (`make shell` first):

```bash
wp user create student student@test.com --role=rrp_student --user_pass=test123 --allow-root
wp user create reviewer reviewer@test.com --role=rrp_reviewer --user_pass=test123 --allow-root
wp user create coordinator coord@test.com --role=rrp_coordinator --user_pass=test123 --allow-root
wp user create rrpadmin admin@test.com --role=rrp_admin --user_pass=test123 --allow-root
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions including Azure VM deployment.

---

## Architecture

```
Browser  ──HTTPS──►  Apache 2.4
                         │
                     WordPress 6.7 (PHP 8.1)
                         │
                     Plugin: research-review-portal/
                         ├── research-review-portal.php   ← SPA bootstrap + CSP headers
                         ├── assets/portal.js             ← single-page application (IIFE)
                         ├── assets/portal.css
                         ├── includes/
                         │   ├── class-portal-rest.php    ← all REST endpoints
                         │   ├── class-portal-data.php    ← JSON read/write (file locking)
                         │   ├── class-user-management.php
                         │   ├── class-auth-provider.php  ← Entra SSO
                         │   └── class-process-documentation.php
                         └── data/
                             ├── config.json              ← system configuration
                             ├── submissions.json         ← all submissions + audit logs
                             ├── reviewers.json           ← reviewer pool
                             └── uploads/<id>/            ← uploaded files per submission
```

**Database:** WordPress MySQL stores user accounts and WP core settings only. All submission, workflow, and configuration data lives in JSON files — no custom database tables required.

---

## Production Environment

| Item | Value |
|------|-------|
| Host | `portal.your-institution.edu` |
| OS | Ubuntu 22.04 LTS |
| PHP | 8.1 |
| WordPress | 6.7 |
| Plugin path | `/var/www/html/wp-content/plugins/research-review-portal` |
| ClamAV | v1.4.3 |
| SSL | Let's Encrypt (auto-renewing) |

---

## License

Internal project — City University of Seattle, School of Technology and Computing.  
Not for public distribution.
