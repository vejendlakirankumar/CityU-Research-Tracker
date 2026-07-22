# RRP Pilot — Test Plan, Results & Findings

**System under test:** https://rrp.westus3.cloudapp.azure.com
**Execution method:** Live API (PowerShell `Invoke-RestMethod` / `curl.exe`) against the production HTTPS endpoint.
**Date executed:** 2026-07-22
**Reference plan:** RRP Pilot — Six-Tester Run Plan (Waves 0–5).

---

## 1. Cohort & test data

| Role | Account | Password |
|---|---|---|
| Admin | `admin@cityu.edu` | `admin12345` |
| Coordinator A | `coordinator@cityu.edu` | `admin12345` |
| Coordinator B | `coordinator1@cityu.edu` | `admin12345` |
| Reviewer A | `reviewer@cityu.edu` | `admin12345` |
| Reviewer B | `reviewer1@cityu.edu` | `admin12345` |
| Student A | `student@cityu.edu` | `admin12345` |
| Student B | `student1@cityu.edu` | `admin12345` |

**Submissions used**

| # | Owner | Purpose | Final status |
|---|---|---|---|
| S1 | Student A | Main path — two reviewers, full cycle | ACCEPTED |
| S2 | Student B | Revision loop + resubmission | ACCEPTED |
| S3 | Student A | Throwaway — withdraw | WITHDRAWN |
| S4 | Student B | Throwaway — reject + appeal | REJECTED (F1 fixed 2026-07-22 — reject now terminal; appeal + adjudicate verified) |
| S5 | Student B | Throwaway — cancel | CANCELLED |

Submission type for the run: **Capstone-project** (non-gated, workflow `capstone-wf`: stage 1 `Guide`, stage 2 `Faculty`; approval strategy `ALL`, min approvals 1).

---

## 2. Test scenarios & results

Legend: ✅ Pass · ❌ Fail (defect) · ⚠️ Finding/partial · 🚫 Blocked · ℹ️ Behavioral note · ⏭️ UI-only (not API-testable)

### Wave 1 — Access; students submit

| ID | Scenario | Result | Detail |
|---|---|---|---|
| ACC-01 | All six testers + admin log in | ✅ | 7/7 logins, correct roles returned |
| ACC-02 | Role boundaries (backend authz) | ✅ | student/reviewer → 403 on `/users`, `/system/organization`, `/admin/audit-logs`, `/system/feature-flags`, `/admin/analytics/overview`; coordinator → 403 on admin-only; admin/coordinator allowed where expected. **No privilege escalation.** |
| ST-01 | Student creates DRAFT submissions | ✅ | S1 (Student A), S2 (Student B) created as DRAFT |
| ST-02 | Submit with no document rejected | ✅ | HTTP 422 |
| ST-03 | Valid PDF upload | ✅ | HTTP 201 |
| ST-04 | Disallowed file type (.exe) rejected | ✅ | HTTP 422 |
| ST-05 | Submit after upload → locked | ✅ | Status SUBMITTED; edit after submit → 403 |
| ST-06 | Student cannot see another student's submission | ✅ | Student A GET S2 → 403 |
| CO-01 | Both coordinators see submissions + search/filter | ✅ | Both see S1+S2; `search=Pilot` → 2 hits; `status=SUBMITTED` filter homogeneous |

### Wave 2 — Coordinators assign; reviewers respond

| ID | Scenario | Result | Detail |
|---|---|---|---|
| CO-02 | Assign reviewers (incl. deadline) | ✅ | revA→S1, revB→S1, revA→S2 (with due date) |
| CO-03 | Two separate assignment cards on S1 | ✅ | Reviewer list count = 2 |
| CO-04 | Review Management shows active assignments | ✅ | coordA sees 2 on S1; coordB sees own S2 assignment |
| CO-06 | Resolve conflict by reassigning | ✅ | resolve-conflict(reassign) removes, then re-assign succeeds |
| RV-01 | Reviewer queues | ✅ | revA pending=2, revB pending=1 |
| RV-02 | Reviewer accepts assignments | ✅ | Status → accepted |
| RV-04 | Reviewer B declares conflict on S1, then loses access | ⚠️ **F3** | Conflict recorded + coordinators notified, but reviewer **retains read access** after flagging (still HTTP 200 on GET). Access is only removed when the coordinator resolves via "reassign". |

### Wave 3 — Reviews and decisions

| ID | Scenario | Result | Detail |
|---|---|---|---|
| RV-05 | Reviewer decisions (Approve / Request Revisions) with comments | ✅ | Decisions + comments recorded; S2 → REVISION_REQUIRED on "revise" |
| RV-07 (pre-finalize) | Reopen & edit a decision | ✅ | Editable pre-finalize (HTTP 200, comments updated) |
| RV-08 | Request deadline extension (days + reason) | ✅ | extension_status = pending |
| CO-05 | Approve extension; deadline updates | ✅ | Due date moved +5 days |
| ST-09 (pre-finalize) | Student feedback should be hidden pre-finalize | ℹ️ **F5** | For the **non-gated** Capstone type, reviewer comments become visible to the student the moment a decision is recorded (before coordinator finalize). "Hidden until finalize" only holds for gated types. |

### Wave 4 — Outcomes, revision loop, confidentiality

| ID | Scenario | Result | Detail |
|---|---|---|---|
| CO-07 | Finalize submission → terminal outcome | ✅ | S1 → ACCEPTED (both stages approved); S2 → ACCEPTED after revision loop |
| ST-08 | Upload revised doc + resubmit; versions preserved | ✅ | Version history 1 → 2, both preserved |
| ST-09 (post-finalize) | Comments now visible | ✅ | 3 decisions with comments visible to student |
| ST-07 | Activity timeline | ✅ | 12 events returned |
| RV-06 | Student sees reviewer comments; **cannot** see internal notes | ✅/⚠️ | Student sees comments. **No separate internal-notes field exists in the API** — only a single `comments` field per decision. The reviewer-comments vs internal-notes split is UI-only and must be verified in the browser. |
| RV-07 (post-finalize) | Editing a decision on a finalized submission should be blocked | ❌ **F2** | Reviewer changed approve→reject on an ACCEPTED submission (HTTP 200). No lock on decisions after terminal status. |

### Wave 5 — Appeals, destructive tests, wrap-up

| ID | Scenario | Result | Detail |
|---|---|---|---|
| ST-10 | Create S3 → withdraw; locks afterward | ✅ | S3 WITHDRAWN; edit after withdraw → 403 |
| CO-10 | Cancel a throwaway; permanence | ✅ | S5 CANCELLED; edit after cancel → 403 |
| ST-11 | Appeal a rejection with grounds | ✅ (F1 fixed) | Reviewer reject now yields REJECTED; appeal returns 201/APPEAL_PENDING; premature appeal returns a clean 422 |
| CO-09 | Adjudicate the appeal | ✅ (F1 fixed) | PATCH /admin/appeals/{id} → 200; DISMISSED returns submission to REJECTED, UPHELD returns it to IN_REVIEW |
| CO-11 | Announcement targeted to a role; others don't see it | ✅/⚠️ **F4** | Targeting correct: reviewers received the notice, students did not. But the delivered notification shows a generic title/body instead of the announcement's own text. |
| CO-12 | Reports / analytics spot-check | ✅ | `/admin/analytics/overview` + `/turnaround` return data |
| RV-09 | Reviewer "My Analytics" | ✅ | 4 assigned, 4 completed, 100% completion / on-time |
| ST-12 | Reference lookup by real DOI | ✅ | `10.1038/171737a0` → "Molecular Structure of Nucleic Acids: A Structure for Deoxyribose Nucleic Acid" |
| ST-13 | Print / PDF | ⏭️ | UI-only |
| XC-01 | Mobile | ⏭️ | UI-only |
| XC-02 | Real-time update without refresh | ⏭️ | UI-only (websocket) |
| XC-03 | Session behavior | ⏭️ | UI-only (partial) |
| XC-04 | Browser matrix | ⏭️ | UI-only |
| XC-05 | Confusion log | ⏭️ | Human/manual |

---

## 3. Findings (prioritized)

### F1 — HIGH — `REJECTED` status is unreachable; appeal feature is dead code
- **Observed:** A reviewer "reject" decision on S4 resulted in `REVISION_REQUIRED`, not `REJECTED`. `submitAppeal()` requires `status === REJECTED`, so appeals can never be filed.
- **Root cause:** `Submission::STATUS_REJECTED` is only ever *read* across the backend, never *assigned*. `StageEvaluator` returns `FAILED`, but `WorkflowAdvancer::evaluateAndAdvance()` maps FAILED → `REVISION_REQUIRED` (non-gated) or `PENDING_RELEASE` (gated). The gated-release endpoints only support `REVISION_REQUIRED` / recheck. No path sets ACCEPTED-via-reject or REJECTED.
- **Impact:** Rejection + appeal + appeal-adjudication business flows (ST-11, CO-09) are non-functional. Coordinators cannot reject a submission outright.
- **Secondary:** `POST /submissions/{id}/appeal` returns HTTP 500 (not 422) when the submission is not rejected.
- **Files:** `app/Services/WorkflowAdvancer.php`, `app/Services/StageEvaluator.php`, `app/Http/Controllers/GatedReleaseController.php`, `app/Http/Controllers/SubmissionController.php` (`submitAppeal`).
- **Decision:** Non-gated reviews — the reviewer's decision is final. Gated reviews — the gatekeeper is the final decision maker.
- **Fix (code implemented):**
  - `WorkflowAdvancer::evaluateAndAdvance()` now splits the terminal branch: a `FAILED` outcome (a reviewer/gatekeeper reject) transitions to `REJECTED` (clearing the current stage), while `REVISION_REQUIRED` still routes to revision. Applies to non-gated stages and the gatekeeper stage of gated reviews.
  - Added `WorkflowAdvancer::notifySubmitterFinalDecision()` for the rejection notification.
  - `GatedReleaseController::store()` and `storeForSubmission()` now accept `decision` in `{ACCEPTED, CONDITIONALLY_ACCEPTED, REVISION_REQUIRED, REJECTED}`, mapping to the matching submission status (terminal decisions clear the current stage), so the gatekeeper can issue the final decision on escalated (`PENDING_RELEASE`) submissions.
  - Retest exposed a latent 500 on **appeal creation**: `appeal_requests` has only `created_at` (no `updated_at`) but the `AppealRequest` model used the default `$timestamps = true`, so every insert/update wrote `updated_at` → SQL error. Fixed by setting `public $timestamps = false;` on the model (mirrors `GatedRelease`). Also closed the loop: a **DISMISSED** appeal now returns the submission to `REJECTED` (previously it stayed `APPEAL_PENDING` forever).
- **Retest (live-verified 2026-07-22):**
  - Non-gated: premature appeal → 422; reviewer reject → **REJECTED**; appeal → 201/`APPEAL_PENDING`; adjudicate (DISMISSED) → 200 → back to `REJECTED`. All PASS.
  - Gated: Chair (gatekeeper) reject → **REJECTED**; Committee reject → `PENDING_RELEASE`; gatekeeper release ACCEPTED → `ACCEPTED`, REJECTED → `REJECTED`, REVISION_REQUIRED → `REVISION_REQUIRED`. All PASS.
- **Status:** ☑ Fixed, deployed, and retested — PASS

### F2 — MEDIUM — Reviewer decisions remain editable after a terminal outcome
- **Observed:** After S1 reached `ACCEPTED`, Reviewer A changed their decision from approve → reject (HTTP 200).
- **Root cause:** `SubmissionReviewerController::update()` has no guard preventing decision changes once the submission is in a terminal status.
- **Impact:** Audit/data-integrity: recorded outcomes can be altered after finalization.
- **Files:** `app/Http/Controllers/SubmissionReviewerController.php` (`update`).
- **Fix (code implemented):** `update()` now rejects any `status` (accept/decline) or `decision` change with HTTP 422 when the submission is in a terminal/finalized state (`ACCEPTED`, `CONDITIONALLY_ACCEPTED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`, `APPEAL_PENDING`).
- **Retest (live-verified 2026-07-22):** after `REJECTED`, reviewer decision change → 422 (status unchanged); after `ACCEPTED`, reviewer decision change → 422 and decline → 422 (status unchanged). All PASS.
- **Status:** ☑ Fixed, deployed, and retested — PASS

### F3 — LOW–MEDIUM — Flagging a conflict of interest does not revoke reviewer access
- **Observed:** After Reviewer B flagged a conflict on S1, they could still GET the submission (HTTP 200). Access is only removed when the coordinator resolves via "reassign" (which deletes the assignment row).
- **Root cause:** `SubmissionPolicy::isAssignedReviewer()` grants view access based solely on an assignment row existing; it does not consider `conflict_flagged`.
- **Impact:** A reviewer who has declared a conflict retains visibility until a coordinator acts.
- **Files:** `app/Policies/SubmissionPolicy.php`.
- **Fix (code implemented):** `isAssignedReviewer()` now requires `conflict_flagged = false`, so a reviewer loses view/download access the moment they flag a conflict, until a coordinator resolves it (`continue` clears the flag and restores access; `reassign` removes the assignment).
- **Retest (live-verified 2026-07-22):** reviewer view before flag → 200; after flag → 403; after coordinator `resolve-conflict continue` → 200. All PASS.
- **Status:** ☑ Fixed, deployed, and retested — PASS

### F4 — LOW — Broadcast announcement notifications lose the announcement's title/body
- **Observed:** Role targeting works (reviewers received the notice, students did not), but the delivered notification shows a generic title "Notification" and an unrelated submission-template body.
- **Root cause:** `AnnouncementController::broadcastAnnouncement()` / `NotificationService` does not map the announcement's `title`/`body` into the notification content.
- **Impact:** Cosmetic/comprehension — recipients don't see the actual announcement text in the notification.
- **Files:** `app/Http/Controllers/AnnouncementController.php`, `app/Services/NotificationService.php`.
- **Actual root cause (found in fix):** The `notifications` table has only `type` + `data` (jsonb) — no `title`/`body` columns — and the `Notification` model's `$fillable` excludes `title`/`body`, so the broadcast's top-level `title`/`body`/`is_read` were silently dropped by mass-assignment. `NotificationController::toResource()` then regenerated title/body from `type`, and `announcement` had no case → generic "Notification" + submission-template body.
- **Fix (code implemented):** `broadcastAnnouncement()` now stores `title`/`body` inside the notification `data` JSON; `NotificationController` renders the `announcement` type from `data` (title, body) and links it to `/announcements`.
- **Retest (live-verified 2026-07-22):** reviewer notification title + body match the announcement verbatim; type=`announcement`; link=`/announcements`; students still excluded from a `role:reviewer` broadcast. All PASS.
- **Status:** ☑ Fixed, deployed, and retested — PASS

### F5 — Feedback visibility model (non-gated immediate, gated withheld until gatekeeper finalizes)
- **Observed:** Non-gated types surface reviewer comments to the student immediately upon each decision (before coordinator finalize). The plan's "hidden until finalize" (ST-09) only applies to gated review types.
- **Confirmed model (product decision):** For **non-gated** submissions, reviewer comments are visible to the student immediately. For **gated** reviews, ALL comments are withheld from the student until the **gatekeeper** finalizes the outcome. The gatekeeper is whoever is assigned to the `is_gatekeeper` stage — NOT the coordinator (a coordinator/admin may act on the release, but the assigned gatekeeper reviewer is the intended finalizer on both comments and decision).
- **Gap fixed:** After F1, a gatekeeper can finalize by deciding the gatekeeper stage directly (no `GatedRelease` record is created on that path). Previously the student would then see nothing. `feedback()` now, for a gated submitter with no `GatedRelease`, surfaces the gatekeeper-stage reviewer's decision + comments once the submission reaches a finalized status (ACCEPTED / CONDITIONALLY_ACCEPTED / REJECTED / REVISION_REQUIRED). Non-gatekeeper reviewers' raw comments remain hidden from the student.
- **Files:** `app/Http/Controllers/SubmissionController.php` (`feedback`).
- **Retest (live-verified 2026-07-22):** non-gated reviewer comment visible to student mid-review (status IN_REVIEW); gated comments withheld mid-review (0 items); gatekeeper direct-stage reject → student sees gatekeeper comment; escalation → PENDING_RELEASE withheld → gatekeeper release → student sees release note while committee raw comment stays hidden. All PASS.
- **Status:** ☑ Fixed, deployed, and retested — PASS

### F6 — INFO — Transient HTTP 500s during final-approval commit
- **Observed:** GET activity and reviewer PATCH returned 500 in the instant a final approval committed to ACCEPTED; not reproducible after settling.
- **Impact:** Possible race in workflow advancement / activity aggregation — monitor.
- **Files:** `app/Services/WorkflowAdvancer.php`, `app/Http/Controllers/SubmissionController.php` (`activityLog`).
- **Status:** ☐ To investigate

### F7 — Gatekeeper could not release a Reject/Accept decision from the reviewer UI
- **Observed (UI test, live):** For a gated dissertation escalated to **Pending Release**, the assigned gatekeeper reviewer's only on-page control (Feedback tab → “Gatekeeper Action Required” panel) offered just **“Send Feedback & Request Revision”** (hardcoded `REVISION_REQUIRED`) or **“Return Stage for Re-review”**. There was **no way to release a Rejected or Accepted final decision**, even when the reviewers had rejected. The full-decision UI (`GatedReviewsPage`, decision dropdown) is **admin/coordinator-only** and not in the reviewer's sidebar/routes — so a stage gatekeeper who is not also a coordinator was blocked from finalizing a rejection.
- **Impact:** Directly contradicts the F5 model (“whoever is assigned to the gatekeeper stage is the finalizer on comments **and** decision”). The gatekeeper could only bounce the work back for revision/re-review.
- **Fix (frontend):** `GatedReleasePanel` in `SubmissionDetailPage.tsx` now presents an **“Issue Final Decision”** mode with a decision selector — **Reject / Request Revision / Accept / Conditionally Accept** — defaulting to Reject or Revision based on the reviewers' stage outcome. It posts the chosen decision to `POST /submissions/{id}/gated-release` (the backend already accepted the full decision set since F1) with dynamic button styling, confirm-modal messaging, and success toast. The “Return Stage for Re-review” option is retained.
- **Retest (UI, live-verified 2026-07-22):** As the gatekeeper reviewer on a Pending-Release dissertation submitted by *student2*: selected **Reject**, entered consolidated feedback, confirmed → submission moved to **Rejected**; “Submission Rejected” banner + appeal option appeared. Student view (`/feedback`) showed **only** the gatekeeper's REJECTED release note, not the raw committee comment. All PASS.
- **Status:** ☑ Fixed, deployed (bundle `index-DAlIpm2x.js`), and retested — PASS

---

## 4. Additional behavioral notes (not defects)
- Review lifecycle: `submit` → coordinator `advance-review` (→ AWAITING_REVIEWERS) → assign reviewers → `advance-review` again (→ IN_REVIEW) → reviewer accept → reviewer decide → auto-advance.
- Resubmitting a `REVISION_REQUIRED` submission returns it directly to `IN_REVIEW` (no separate coordinator advance required); FULL_RESTART policy resets reviewer decisions for re-review.
- Cancel returns HTTP 204 (no body); withdraw/cancel both lock the submission against edits.

---

## 5. Fix & retest tracker

| Finding | Priority | Fix status | Deployed | Retested | Result |
|---|---|---|---|---|---|
| F1 REJECTED unreachable / appeals | HIGH | ☑ | ☑ | ☑ | PASS — non-gated reject→REJECTED→appeal→adjudicate; gated gatekeeper accept/reject/revise all verified live |
| F2 Decision editable post-finalize | MEDIUM | ☑ | ☑ | ☑ | PASS — change/decline after ACCEPTED or REJECTED both return 422; status unchanged |
| F3 Conflict flag doesn't revoke access | LOW–MED | ☑ | ☑ | ☑ | PASS — flag → 403; resolve-continue → 200 restored |
| F4 Announcement notification content | LOW | ☑ | ☑ | ☑ | PASS — title/body now delivered verbatim; targeting preserved |
| F5 Feedback visibility model | INFO→FIX | ☑ | ☑ | ☑ | PASS — non-gated immediate; gated withheld until gatekeeper finalizes (direct-stage or release); non-gatekeeper comments stay hidden |
| F6 Transient 500s | INFO | ☐ | ☐ | ☐ | |
| F7 Gatekeeper reject/accept not releasable in reviewer UI | MEDIUM | ☑ | ☑ | ☑ | PASS — gatekeeper panel now has decision selector (Reject/Revision/Accept/Cond.); UI-verified reject release → Rejected; student sees only release note |

**Retest protocol:** after each fix is deployed, re-run the affected wave(s) via the live API harness and update the row above. A full regression (Waves 1–5) is run once all HIGH/MEDIUM findings are fixed.
