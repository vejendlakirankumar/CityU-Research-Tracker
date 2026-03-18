# User Manual — CityU Research Review Portal

> **Version:** 2.0
> **Institution:** City University of Seattle · School of Technology and Computing (STC)
> **Authors:** Kiran Kumar Vejendla · Jemell Garris
> **Last updated:** March 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Student / Researcher Guide](#3-student--researcher-guide)
4. [Reviewer Guide](#4-reviewer-guide)
5. [Coordinator Guide](#5-coordinator-guide)
6. [Administrator Guide](#6-administrator-guide)
7. [Submission Types & Review Stages](#7-submission-types--review-stages)
8. [Quick Reference](#8-quick-reference)
9. [FAQ](#9-faq)

---

## 1. Introduction

The **CityU Research Review Portal** is the University's centralised platform for submitting and managing academic research through structured multi-stage peer review. It supports all major research output types:

| Submission Type | ID Prefix | Who submits |
|-----------------|-----------|-------------|
| Academic Research / Conference Paper | ARS | PhD students, faculty |
| Journal Publication | PUB | Faculty, researchers |
| Student Project | PROJ | Graduate students |
| Grant Proposal | GRN | Faculty, researchers |

Every submission follows a type-specific workflow: it passes through a series of reviewer stages in order. Each stage must be approved before the submission advances. The portal sends email notifications whenever action is required.

---

## 2. Getting Started

### 2.1 Logging In

1. Navigate to the portal URL provided by your department.
2. Click **Login Now** or **Login to Submit Your Work**.
3. Enter your CityU credentials (username / email + password).
   - If your institution uses Microsoft Single Sign-On, click **Sign in with Microsoft** instead.
4. You are automatically redirected to the dashboard for your role.

### 2.2 Your Dashboard

| Role | Default view |
|------|--------------|
| Student / Researcher | Personal submission list with status badges |
| Reviewer | Assigned reviews — Pending and Completed |
| Coordinator | All submissions — full workflow management |
| Admin | All submissions + administration panel |

Your name, role, and a **Logout** link appear in the top navigation bar at all times.

### 2.3 Notification Centre

The bell icon (🔔) in the top bar shows unread notifications. Click it to open the notification panel. You can configure which notifications you receive — see [Notification Preferences](#63-notification-preferences).

### 2.4 Session Timeout

For security, the portal automatically logs you out after a configurable idle period (default: 60 minutes). A warning appears 5 minutes before expiry. Click anywhere in the portal to reset the timer.

---

## 3. Student / Researcher Guide

### 3.1 Creating a New Submission

1. From your dashboard click **+ New Submission**.
2. Select a **Submission Type** from the dropdown.
3. Complete all required fields:
   - **Title** — full title of your work
   - **Abstract** — 150–500 words describing your research
   - **Keywords** — 3–6 comma-separated terms
   - **Supporting Document** — upload your document (see file requirements below)
4. Click **Submit**. A reference ID is assigned automatically (e.g. `ARS-2026-007`) and the first-stage reviewer is notified.

#### File Requirements
- **Allowed formats:** PDF, DOCX (your administrator may have configured additional types — check the upload hint on the form)
- **Maximum file size:** as shown on the upload field (default: 2 MB per file)
- **Maximum files per submission:** as shown on the upload field (default: 5)

> **Tip:** Save a draft any time by clicking **Save Draft**. Your work is preserved and you can return to complete it later.

### 3.2 Tracking Your Submission

Each submission card shows:

| Field | Meaning |
|-------|---------|
| Reference ID | Unique identifier (e.g. `ARS-2026-007`) |
| Status badge | Current state — Pending / Under Review / Needs Revision / Approved / Rejected |
| Current stage | Which review stage the work is at |
| Reviewer | Name of the reviewer at the active stage (hidden in double-blind submissions) |
| Due date | Expected completion date for the active stage |
| Est. completion | System-calculated estimate based on remaining stages |

Click **Details** to open the full submission view.

### 3.3 Filtering Your Submissions

Use the date-range pill bar (**Today / This Week / This Month / This Year / All Time**) at the top of your dashboard to filter. You can also search by title, ID, or keyword using the search box.

### 3.4 Viewing the Stage Timeline

Inside a submission, click **Timeline** to see a full chronological log of every stage decision, reviewer assignment, revision request, and system event.

### 3.5 Responding to Reviewer Feedback

When a reviewer requests revisions, your submission moves to **Needs Revision** status and you receive an email.

1. Open the submission and read the **Feedback** section.
2. Prepare a revised document.
3. Click **Upload Revision** and attach the updated file.
4. Enter a **Response Note** explaining how you addressed each comment.
5. Click **Submit Revision**. The reviewer is notified and the review cycle restarts.

The portal tracks revision rounds. Each revision clears previous stage decisions and increments the revision counter. A **Revision Diff** table shows what metadata changed between the previous and current version.

### 3.6 Two-Phase Submissions (Abstract → Full Paper)

Some submission types use a two-phase workflow. In Phase 1 you submit only an abstract; the first set of review stages evaluate the abstract. If approved, you receive a **Full Paper Invited** status. You then click **Submit Full Paper** and upload the complete document to enter Phase 2.

A phase indicator badge (Phase 1 / Phase 2) is shown in the submission detail.

### 3.7 Deadline Calendar

Click **My Deadlines** in the sidebar to open a monthly calendar view of all your active-stage deadlines. Click any date marker to go directly to the submission.

On any deadline badge in a submission's detail view, click the **📅** (calendar) button to:
- Add to **Google Calendar**
- Add to **Outlook Calendar**
- Download an **ICS file** for any calendar application

### 3.8 Withdrawing a Submission

If you need to withdraw a submission before a final decision:

1. Open the submission and click **Withdraw**.
2. Confirm the withdrawal in the dialog.
3. The submission is locked and a **Withdrawn** status badge is displayed. The coordinator is notified by email.

> Withdrawn submissions cannot be edited, revised, or resubmitted. Contact your coordinator if you need to reinstate a withdrawn submission.

### 3.9 Appealing a Rejection

If your submission receives a final **Rejected** decision, you may submit a formal appeal:

1. Open the submission and click **Appeal Decision**.
2. Enter your grounds for appeal.
3. Click **Submit Appeal**. The status changes to **Appeal Pending** and the coordinator is notified.
4. The coordinator reviews your appeal and either starts a re-review (**Appeal Under Review**), upholds the rejection, or overturns it.
5. You receive an email notification at each step.

---

## 4. Reviewer Guide

### 4.1 Your Reviewer Dashboard

When you log in you see two sections:

- **Pending Reviews** — submissions assigned to you requiring action, sorted by due date
- **Completed Reviews** — reviews you have already submitted

Each card shows the submission ID, title, type, submitter (or "Anonymous" in double-blind submissions), current stage, and your due date.

### 4.2 Reviewing an Assignment

1. Click **Review** on a pending submission card.
2. The submission detail opens, showing:
   - Title, abstract, keywords, and submitter information (redacted in double-blind)
   - Uploaded documents with a built-in preview (PDF / DOCX)
   - Previous stage decisions (if any)
   - Collaborative stage notes (shared with co-reviewers on this submission)
   - The review form
3. Read the document using the **Preview** button (opens inline viewer).
4. Complete the review form:
   - **Decision** — Approve / Request Revisions / Reject
   - **Feedback** — written feedback using the rich text editor (required for all decisions)
   - **Review Criteria** — answer any template questions configured for this submission type
   - **Score / Rating** — provide weighted scores if the scoring panel is shown
   - **Reviewer Attachment** — optionally upload an annotated copy or supplementary file
5. Click **Submit Decision**.

Your decision is recorded, the submitter is notified, and if all required approvals are collected, the submission advances to the next stage automatically.

### 4.3 Rich Text Feedback Editor

The feedback field uses a built-in rich text editor. The toolbar provides:

| Button | Effect |
|--------|--------|
| **B** | Bold |
| *I* | Italic |
| U | Underline |
| S̶ | Strikethrough |
| • | Bullet list |
| 1. | Numbered list |
| " | Blockquote |
| ✕ | Clear all formatting |

Paste clipboard content as plain text (HTML from external sources is automatically stripped for security).

### 4.4 Collaborative Stage Notes

The **Stage Notes** panel is shared with all reviewers assigned to the same stage. Use it to coordinate your reviews. Notes auto-save after 1 second of inactivity and update every 20 seconds for co-reviewers viewing the same submission. A presence indicator shows other reviewers currently viewing the submission.

> Stage notes are visible to all co-reviewers and coordinators, but not to the submitter.

### 4.5 Conflict of Interest

If you have a professional or personal conflict with a submission:

1. Click **Declare Conflict of Interest** on the assignment card.
2. Enter a brief reason.
3. The coordinator is notified and will reassign the submission to another reviewer.

You will no longer be able to access the submission after declaring a COI.

### 4.6 Requesting a Deadline Extension

If you need more time to complete your review:

1. Open the submission and click **Request Extension**.
2. Enter the number of additional days needed and a reason.
3. Click **Submit Request**. The coordinator is notified.
4. You receive an email when the request is approved or denied.
5. If approved, your deadline is updated automatically.

### 4.7 Deadline Calendar & Calendar Sync

The deadline for each of your assigned submissions is shown on the card and inside the submission detail. Click **📅** on any deadline badge to:
- Open a Google Calendar link
- Open an Outlook Calendar link
- Download an `.ics` file

Assignment notification emails also include Google Calendar and Outlook deep-links for your deadline.

### 4.8 Scoring / Rating

If the submission type has a scoring panel enabled, fill in the weighted criteria before submitting your decision. Each criterion has a numeric score and an optional comment. The coordinator can see aggregated scores across all reviewers.

---

## 5. Coordinator Guide

Coordinators manage the full review workflow. They can view all submissions, assign reviewers, advance or skip stages, manage deadlines, and access analytics.

### 5.1 Coordinator Dashboard Overview

The main table shows all submissions with:

| Column | Description |
|--------|-------------|
| Reference ID | Unique identifier |
| Title | Submission title (clickable) |
| Type | Submission type badge |
| Submitter | Submitter's name |
| Status | Current status badge |
| Stage | Active stage name |
| Reviewer | Assigned reviewer name(s) |
| Due Date | Colour-coded: red = overdue, amber = due within 3 days, green = on track |

Use the tab bar (**All / Unassigned / In Review / Overdue / Inactive**) to filter. Use the search box to find by title, ID, or submitter name. Use the date-range pill bar to filter by submission date.

### 5.2 Assigning Reviewers

1. Open a submission → **Details** → **Assignment** tab.
2. The panel shows each stage and its reviewer status.
3. For the current stage, click **Assign Reviewer**.
4. A dropdown lists eligible reviewers from the configured pool. Reviewer workload (active/completed counts) is shown alongside each name.
5. Click **Suggest** to ask the system to recommend the best match based on expertise tags, avoiding conflicts of interest.
6. Select a reviewer and click **Assign**. The reviewer receives an email with calendar links.

To use bulk assignment, go to **Administration → Reviewer Pools** and click **Apply Pool to All Active Submissions**.

### 5.3 Advancing a Stage

Once all required reviewers for a stage have approved, click **Advance to Next Stage** in the stage panel. Advancement also happens automatically when the last required approval is received.

### 5.4 Skipping a Stage

1. Open the submission → stage panel → **Skip Stage**.
2. Enter a mandatory justification note.
3. The stage is marked skipped and the submission advances.

### 5.5 Deadline Management

**Setting stage deadlines:**
1. Open the submission → **Deadlines** tab.
2. Adjust any stage deadline date.
3. Click **Save Deadlines**.

**Extension requests:**  
Extension requests from reviewers appear in the **Extension Requests** panel in the sidebar. Each request shows the reviewer, submission, requested days, and reason. Click **Approve** or **Deny**. The reviewer is notified by email. Approved extensions automatically update the reviewer's deadline (weekends and public holidays are skipped per system configuration).

### 5.6 Deadline Calendar

Click **Deadline Calendar** in the sidebar to open the monthly calendar view. Each event represents an active-stage deadline for a submission. Click an event to go directly to the submission detail.

### 5.7 Conflict of Interest Declarations

The **COI Declarations** panel (sidebar) lists all reviewer COI declarations with submission ID, reviewer name, and reason. Reassign the affected submission via the Assignment tab.

### 5.8 Inactive Submissions

The **Inactive Submissions** panel shows submissions with no audit activity for a selectable number of days (30 / 60 / 90 / 180). Use the checkboxes to select submissions and click **Bulk Cancel** to cancel them all with a single audit log entry and email to each submitter.

### 5.9 Processing Appeals

When a submitter appeals a rejection:

1. The submission appears in your list with **Appeal Pending** status.
2. Open the submission → **Appeal** panel.
3. Click **Start Review** to begin re-evaluation (status becomes **Appeal Under Review**).
4. After review, click **Uphold** (confirm rejection) or **Overturn** (approve the submission).
5. The submitter receives an email at each step.

### 5.10 Plagiarism / Similarity Check

If a plagiarism provider is configured in Portal Settings:

1. Open the submission → **Administrative Controls**.
2. Click **Run Similarity Check**.
3. The result (similarity score and report link) is fetched from the provider and stored with the submission.

### 5.11 Analytics

Go to **Analytics** in the sidebar for these reports:

| Report | Contents |
|--------|---------|
| Workflow | Stage completion rates and average time per stage |
| Performance | Submission throughput by type and date range |
| Reviewer | Per-reviewer: completion rate, average turnaround, on-time rate, feedback length |
| Workload | Active and completed counts per reviewer |
| Overdue | All submissions past their stage deadline |
| Daily | New submissions and decisions per day (90-day rolling) |

Click **Export** on any report to download as CSV or XLSX.

### 5.12 Bulk Email / Announcements

1. Open **Bulk Communications** in the Administration section.
2. Choose the audience: **All Active Submitters** or **All Assigned Reviewers**.
3. Optionally filter by submission type, status, or department.
4. Enter the subject and message body.
5. Click **Send Broadcast**. All matching users receive the email.

### 5.13 Audit Log

Every action on a submission is automatically recorded. Click **📋 Log** on any submission card to open the slide-in audit panel. The log shows timestamp, actor, action type, and detail for every event.

---

## 6. Administrator Guide

Administrators have all Coordinator capabilities plus user management, system configuration, and advanced features.

### 6.1 User Management

Go to **Administration → Users**.

#### Creating a User
1. Click **+ Add User**.
2. Enter display name, email, and select a role.
3. Fill optional profile fields: degree, department, expertise tags, allowed submission types.
4. Click **Create User**. A WordPress account is created and a password-setup email is sent.

#### Editing a User
Click the edit (✏) icon next to any user, modify fields, and click **Save**.

#### Resetting a Password
Click the password icon on any user's row. A new temporary password is generated and emailed to the user.

#### Deleting a User
Click the trash icon and confirm. The user is removed from WordPress and from all reviewer pool entries.

### 6.2 Role Management

Go to **Administration → Roles** to create custom roles beyond the five built-in ones.

**Built-in roles (protected, cannot be deleted):**

| Role | Key capabilities |
|------|-----------------|
| `rrp_student` | Submit own research, view own submissions |
| `rrp_reviewer` | View assigned submissions, submit decisions |
| `rrp_coordinator` | Manage all submissions, assign reviewers, analytics |
| `rrp_admin` | Everything + full configuration + user management |
| `rrp_faculty` | Extended student capabilities |

### 6.3 Notification Preferences

Users manage their own notification preferences from **My Profile → Notification Preferences**. The 7 configurable categories are:

| Category | Triggered by |
|----------|-------------|
| Submission Received | Your submission is confirmed |
| Stage Assigned | You are assigned to review a stage |
| Deadline Reminder | Your review deadline is 3 days away |
| Escalation | A submission you are linked to is overdue |
| Submission Status Changed | Any status change on your submission |
| Extension Resolved | Your extension request is approved/denied |
| Extension Requested | A reviewer requests an extension (coordinators) |

All notifications are on by default. Uncheck any category to stop receiving that notification type.

### 6.4 Portal Settings

Go to **Administration → Portal Settings** to configure:

#### General
- Portal name and welcome message
- Session idle timeout (minutes)
- Public submission portal toggle and allowed types for public users

#### Submission Types Editor
- Add, edit, or remove submission types
- Configure stage names, required reviewer counts, and days per stage per type
- Enable/disable double-blind review per type
- Enable/disable two-phase (abstract → full paper) workflow per type

#### File Upload Limits
- **Max file size (MB)** — maximum size per uploaded file
- **Max files per submission** — maximum number of attachments
- **Allowed extensions** — comma-separated list (e.g. `pdf,docx,doc`)

> Changes to upload limits take effect immediately for new uploads. ClamAV virus scanning is always applied regardless of these settings.

#### Email / SMTP
- SMTP host, port, encryption (SSL / STARTTLS / None)
- Auth credentials (password stored AES-256-GCM encrypted)
- From name and from address
- **Test Email** button — sends a test message to verify configuration

#### Deadline Options
- Default grace period (days after deadline before escalation email is sent)
- Skip weekends toggle
- Public holidays list (dates that are skipped in deadline calculation)

#### SSO — Microsoft Entra ID
- Tenant ID, Client ID, Client Secret
- Redirect URI
- Enable / disable SSO (when disabled, only WordPress credentials are accepted)

#### Plagiarism / Similarity
- Provider selection: iThenticate / Turnitin / CORE API / Disabled
- API key / credentials for the selected provider

#### Webhooks
- Registered webhook URLs with HMAC signing key
- Events: `submission.approved`, `submission.rejected`, `review.completed`, `submission.withdrawn`

### 6.5 Reviewer Pools

Go to **Administration → Reviewer Pools** to configure per-type reviewer pools:

- **Assignment mode** — `random` (pick randomly) or `round_robin` (distribute evenly)
- **Reviewer IDs** — add/remove WordPress users from the pool
- **Apply to all submissions** — bulk-assign the pool configuration to all active submissions

### 6.6 Review Templates

Go to **Administration → Review Templates** to create structured review forms per submission type. Each template can contain:
- **Text fields** — free-form written responses
- **Rating fields** — numeric score (1–10)
- **Yes/No fields** — checkbox questions
- **Required** — whether the field must be answered before decision

### 6.7 Backup & Restore

Go to **Administration → Backup & Restore**.

- **Download Backup** — downloads a ZIP containing all JSON data files and all uploaded documents
- **Restore** — upload a previously downloaded ZIP file; the portal unpacks and replaces the data files (ZipSlip attack protection is applied)

Back up before any major configuration change or before archiving old submissions.

### 6.8 Data Archive

Go to **Administration → Data Archive**.

1. Select the minimum age of submissions to archive (minimum: 30 days).
2. Enter an optional reason note.
3. Click **Archive Now**. All terminal submissions (Approved, Rejected, Withdrawn, Cancelled) older than the selected age are moved to a dated ZIP archive under `data/archives/`.
4. The archived submissions are removed from the active submissions list.
5. Archives can be downloaded or deleted from the archive list.

### 6.9 Public Submission Portal

When enabled, external users can self-register and submit research without a pre-existing CityU WordPress account.

To enable:
1. Portal Settings → **Public Submissions** → toggle **On**.
2. Select which submission types are available to public users.
3. Save. A self-registration link becomes visible on the portal login page.

Public registrations are subject to IP-based rate limiting. All public submissions are routed to coordinators for assignment.

---

## 7. Submission Types & Review Stages

### Academic Research / Conference Paper (ARS)

| Stage | Description |
|-------|-------------|
| 1 | Initial Screening |
| 2 | Chair Review |
| 3 | Committee Review (3 reviewers required) |
| 4 | External Review |
| 5 | Dean Approval |
| 6 | Final Decision |

### Journal Publication (PUB)

| Stage | Description |
|-------|-------------|
| 1 | Editorial Screening |
| 2 | Peer Review (2 reviewers required) |
| 3 | Revision Review |
| 4 | Section Editor |
| 5 | Editor-in-Chief |
| 6 | Final Decision |

### Student Project (PROJ)

| Stage | Description |
|-------|-------------|
| 1 | Advisor Review |
| 2 | Department Review |
| 3 | Faculty Committee |
| 4 | External Examiner |
| 5 | Program Director |
| 6 | Final Decision |

### Grant Proposal (GRN)

| Stage | Description |
|-------|-------------|
| 1 | Pre-screening |
| 2 | Internal Review |
| 3 | Expert Panel (2 reviewers required) |
| 4 | Budget Review |
| 5 | Compliance Check |
| 6 | Dean / VP Approval |
| 7 | Final Decision |

Stage names, required reviewer counts, and days per stage can all be edited by an administrator in the Submission Types editor.

---

## 8. Quick Reference

### Submission Statuses

| Status | Meaning |
|--------|---------|
| Draft | Saved but not submitted |
| Pending | Submitted; awaiting reviewer assignment |
| Under Review | Assigned to a reviewer; review in progress |
| Needs Revision | Reviewer requested changes; awaiting revised document |
| Revision Required | Same as Needs Revision (displayed after revision submitted) |
| Full Paper Invited | Phase 1 approved; awaiting full paper (two-phase types) |
| Approved | All stages approved; submission accepted |
| Rejected | Rejected at one or more stages |
| Appeal Pending | Submitter has appealed a rejection |
| Appeal Under Review | Coordinator has started appeal review |
| Withdrawn | Withdrawn by the submitter |
| Cancelled | Cancelled by coordinator or admin |

### Common Actions by Role

| Action | Student | Reviewer | Coordinator | Admin |
|--------|---------|----------|-------------|-------|
| New submission | ✅ | — | — | — |
| View own submissions | ✅ | — | — | — |
| View all submissions | — | — | ✅ | ✅ |
| Submit decision | — | ✅ | — | — |
| Assign reviewers | — | — | ✅ | ✅ |
| Skip stage | — | — | ✅ | ✅ |
| Cancel submission | — | — | ✅ | ✅ |
| Manage users | — | — | ✅ | ✅ |
| Portal Settings | — | — | — | ✅ |
| Backup / Archive | — | — | — | ✅ |

### Keyboard Reference

| Key | Action |
|-----|--------|
| `Esc` | Close any open dialog or panel |
| `Ctrl+S` (in feedback editor) | Not applicable — use Submit button |

---

## 9. FAQ

**Q: I submitted the wrong file. Can I replace it?**  
A: If the submission is in **Pending** or **Needs Revision** status, click **Details** and use **Upload Revision** to attach a new document. If the submission is **Under Review**, contact your coordinator.

**Q: I don't see a Submit button on my review form.**  
A: Scroll down — the Submit button is at the bottom of the review form. If it is still missing, ensure you have filled in all required fields (marked with an asterisk *).

**Q: My submission has been Under Review for a long time. What should I do?**  
A: You can see the reviewer's due date in the submission detail. If the date has passed, the system automatically escalates the submission to your coordinator. You can also contact your coordinator directly.

**Q: Can I edit my submission after submitting?**  
A: Metadata (title, abstract, keywords) cannot be changed after submission to preserve the review audit trail. You can upload a revised document when the submission is in **Needs Revision** status.

**Q: I declared a COI by mistake. Can I undo it?**  
A: Contact your coordinator. They can clear the COI declaration and reassign the submission back to you.

**Q: Why can't I see the submitter's name?**  
A: The submission type uses double-blind review. Your identity is also hidden from the submitter until a final decision is made.

**Q: I can't log in with my Microsoft account.**  
A: SSO must be enabled by your administrator. If the "Sign in with Microsoft" button is not visible on the login page, your institution is using WordPress credentials only. Contact your IT administrator.

**Q: My uploaded file was rejected. What file types are allowed?**  
A: The allowed types and size limits are shown directly on the upload field. By default, PDF and DOCX files up to 2 MB are accepted. Your administrator may have changed these limits.

**Q: How do I export my submission history?**  
A: Coordinators and Admins can export all submission data from the Analytics section. Individual submissions can be printed using your browser's print function.
