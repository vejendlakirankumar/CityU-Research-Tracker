# RRP v2 — Smoke Test Checklist

Run this checklist after every production deployment before announcing the release.
Mark each item ✅ or ❌ and note any errors.

---

## Environment

| Field | Value |
|-------|-------|
| Date | |
| Deployed by | |
| Commit / tag | |
| URL | https://PORTAL_DOMAIN |
| VM IP | 172.206.114.248 |

---

## 1 — Infrastructure

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 1.1 | HTTPS loads without cert warning | | |
| 1.2 | `http://` redirects to `https://` | | |
| 1.3 | `GET /api/system/public` returns `200 OK` with JSON | | |
| 1.4 | `GET /app/` serves the React SPA (HTML with `<div id="root">`) | | |
| 1.5 | `docker ps` shows `rrp_app`, `rrp_worker`, `rrp_postgres`, `rrp_redis` all `healthy` | | |

**Quick command:**
```bash
# Run on the VM
curl -s https://PORTAL_DOMAIN/api/system/public | python3 -m json.tool
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## 2 — Authentication

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 2.1 | Admin login succeeds and redirects to Admin Dashboard | | |
| 2.2 | Reviewer login succeeds and sees Reviewer Queue | | |
| 2.3 | Researcher login succeeds and sees My Submissions | | |
| 2.4 | Invalid credentials show "Invalid credentials" error | | |
| 2.5 | Logout clears session and redirects to `/app/login` | | |
| 2.6 | Accessing `/app/admin` without auth redirects to login | | |

---

## 3 — Submission Lifecycle (Happy Path)

> Log in as a researcher for steps 3.1 – 3.5.

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 3.1 | "New Submission" opens the form; all submission type options appear | | |
| 3.2 | Submit a new Publication submission with a PDF attachment | | |
| 3.3 | Submission appears in "My Submissions" with status `submitted` | | |
| 3.4 | Admin can see the new submission in the Admin submission list | | |
| 3.5 | Admin assigns reviewer; submission moves to `under_review` | | |
| 3.6 | Reviewer sees the submission in their queue | | |
| 3.7 | Reviewer opens submission; PDF attachment renders in the preview pane | | |
| 3.8 | Reviewer approves; submission becomes `approved`; researcher sees notification | | |

---

## 4 — Revision & Resubmission Flow

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 4.1 | Reviewer requests revision with a comment | | |
| 4.2 | Researcher sees `revision_requested` status and reviewer comment | | |
| 4.3 | Researcher uploads revised file and resubmits | | |
| 4.4 | Submission returns to `submitted`; reviewer is notified | | |
| 4.5 | No more than 3 revision rounds enforced (4th attempt blocked) | | |

---

## 5 — Appeal Flow

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 5.1 | Researcher can file appeal on a `rejected` submission | | |
| 5.2 | Admin sees appeal in the Appeals queue | | |
| 5.3 | Admin can Approve or Reject the appeal | | |
| 5.4 | Approved appeal → submission returns to `under_review` with new reviewer | | |

---

## 6 — Gated / Committee Review

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 6.1 | Grant submission requires committee approval panel | | |
| 6.2 | Department chair approval gate appears for project submissions | | |
| 6.3 | All committee members must approve before final decision is allowed | | |

---

## 7 — Admin Functions

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 7.1 | Analytics dashboard loads with submission counts per type/status | | |
| 7.2 | User management: create a new reviewer account | | |
| 7.3 | User management: deactivate the new reviewer; they can no longer log in | | |
| 7.4 | Audit log shows recent actions (login, submission create, approve) | | |
| 7.5 | Settings page saves changes and reflects them on reload | | |

---

## 8 — Notifications

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 8.1 | In-app notification bell shows unread count after an event | | |
| 8.2 | Email notification delivered to researcher on reviewer assignment | | |
| 8.3 | Email notification delivered on approval / rejection | | |

---

## 9 — v1 Read-Only Mode

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 9.1 | Enabling `v1_readonly` in v2 Settings POSTs to WordPress REST API | | |
| 9.2 | v1 portal shows "Read-Only Mode" banner | | |
| 9.3 | v1 new submissions are blocked while read-only is active | | |
| 9.4 | Disabling `v1_readonly` restores v1 functionality | | |

---

## 10 — Data Migration (one-time, post-launch)

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 10.1 | `php scripts/migrate_v1_data.php --dry-run` exits 0 with no errors | | |
| 10.2 | Full migration imports expected user and submission counts | | |
| 10.3 | Migrated submissions have correct statuses | | |
| 10.4 | Migrated file attachments are accessible via the v2 UI | | |

---

## 11 — Performance Baseline

| # | Check | Pass? | Notes |
|---|-------|-------|-------|
| 11.1 | Login page fully interactive in < 3 s on a 4G connection (Chrome DevTools throttle) | | |
| 11.2 | Submissions list (20 items) loads in < 2 s | | |
| 11.3 | File upload (2 MB PDF) completes in < 10 s | | |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| Admin / PM | | | |

---

*Checklist generated by Phase 8 (M8.12). Update as new features are added.*
