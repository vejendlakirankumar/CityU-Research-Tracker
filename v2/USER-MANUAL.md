# CityU Research Review Portal v2 — User Manual

> **Version:** 2.0  
> **Audience:** All portal users (students, reviewers, coordinators, and administrators)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Portal Navigation](#2-portal-navigation)
3. [Researcher / Student Guide](#3-researcher--student-guide)
4. [Reviewer Guide](#4-reviewer-guide)
5. [Coordinator Guide](#5-coordinator-guide)
6. [Administrator Guide](#6-administrator-guide)
7. [Notifications](#7-notifications)
8. [Account Settings](#8-account-settings)
9. [Frequently Asked Questions](#9-frequently-asked-questions)

---

## 1. Getting Started

### 1.1 Creating an account

1. Browse to the portal URL (e.g. `https://portal.cityu.edu`).
2. Click **Register** on the login page.
3. Fill in your name, email, and password, then click **Create Account**.
4. Check your inbox for a verification email and click the confirmation link.
5. Log in with your email and password.

### 1.2 Logging in with SSO

If your institution uses Single Sign-On (Microsoft, Google, etc.):

1. Click the SSO button on the login page (e.g. **Sign in with Microsoft**).
2. Complete authentication in your institution's IdP.
3. On first SSO login, your account is created automatically.

### 1.3 Password requirements

- Minimum 8 characters
- At least one uppercase letter, one number, and one special character
- Must be changed every 90 days (configurable by admin)
- Cannot reuse the last 5 passwords

---

## 2. Portal Navigation

The portal has a **sidebar** on the left and a **topbar** across the top.

### Sidebar menu (what you see depends on your role)

| Item | Available to |
|---|---|
| Dashboard | All |
| My Submissions | Student, Coordinator |
| Review Queue | Reviewer, Coordinator |
| Meetings | All |
| Reports | Coordinator, Admin |
| Users | Admin |
| Settings | Admin |

### Topbar

| Icon | Function |
|---|---|
| 🔔 Bell | Notification centre |
| 🌙 Moon | Toggle dark mode |
| 👤 Avatar | Account menu (Profile, Preferences, Logout) |

---

## 3. Researcher / Student Guide

### 3.1 Creating a new submission

1. Go to **My Submissions** → **+ New Submission**.
2. Select the **Submission Type**:
   - **ARS** — Academic Research Submission
   - **GRN** — Grant Application
   - **PROJ** — Project Proposal
   - **PUB** — Publication Submission
3. Fill in the required fields:
   - **Title**, **Abstract**, **Keywords**, **Submission Date**
   - Co-investigator names and affiliations (if applicable)
4. Click **Save as Draft** to continue later, or **Submit** to enter the review queue.

> Submitted applications cannot be edited unless a reviewer requests revisions.

### 3.2 Uploading supporting documents

1. Open your submission from **My Submissions**.
2. Scroll to the **Documents** section.
3. Click **Upload File** and select the document (PDF, DOCX, XLSX, JPG/PNG up to 50 MB).
4. Add a document title / description and click **Save**.

### 3.3 Tracking submission status

From **My Submissions**, the status column shows the current stage:

| Status | Meaning |
|---|---|
| Draft | Not yet submitted; still editable |
| Under Review | Assigned to a reviewer |
| Revisions Requested | Reviewer has requested changes |
| Approved | Submission accepted |
| Rejected | Submission declined |
| Withdrawn | Withdrawn by the submitter |

Click a submission to see the full timeline of events on the right-hand panel.

### 3.4 Responding to revision requests

When a reviewer requests revisions:

1. You receive an email and an in-portal notification.
2. Open the submission. A banner shows the reviewer's comments.
3. Edit the relevant fields or upload a revised document.
4. Click **Resubmit for Review** to notify the coordinator.

### 3.5 Appealing a rejection

1. Open the rejected submission.
2. Click **Appeal** in the action bar.
3. Enter your grounds for appeal and attach any supporting evidence.
4. Click **Submit Appeal**.

The coordinator will review the appeal and either uphold or overturn the rejection.

### 3.6 Withdrawing a submission

1. Open the submission.
2. Click **Withdraw** → confirm.

Withdrawn submissions are read-only and cannot be resubmitted.

---

## 4. Reviewer Guide

### 4.1 Your review queue

Go to **Review Queue** to see all submissions assigned to you. Submissions are listed with deadline and priority.

### 4.2 Opening a submission for review

1. Click the submission title in the queue.
2. Read the abstract and all uploaded documents (use the document viewer on the right).
3. Review the submission details, timeline, and any prior reviewer comments.

### 4.3 Submitting a review decision

1. Scroll to the **Review Decision** panel.
2. Score each rubric criterion (1–5 or as configured):
   - Originality
   - Methodology
   - Significance
   - Clarity
   - Feasibility
3. Write your feedback in **Reviewer Comments** (visible to the submitter).
4. Optionally, add **Internal Notes** (visible to coordinators only).
5. Select a decision:
   - **Approve** — accept the submission
   - **Request Revisions** — return to submitter with comments
   - **Reject** — decline the submission with reasons
6. Click **Submit Decision**.

### 4.4 Updating a decision

You may update your decision until the coordinator finalises the outcome. Click **Edit Decision** on the review panel.

### 4.5 Meetings and calendar

The **Meetings** section shows scheduled review committee meetings you are invited to. Click a meeting to view the agenda, attached documents, and conferencing link (Zoom / Teams).

---

## 5. Coordinator Guide

### 5.1 Overview

Coordinators manage the review pipeline: they assign reviewers, set deadlines, schedule meetings, monitor progress, and close out submissions.

### 5.2 Viewing all submissions

Go to **My Submissions**. Unlike students, coordinators see all submissions, not just their own. Use filters and the search bar to narrow results.

### 5.3 Assigning reviewers

1. Open a submission.
2. Click **Assign Reviewer** in the action bar.
3. Select one or more reviewers from the dropdown.
4. Set a review **Deadline**.
5. Click **Confirm Assignment**.

The assigned reviewer receives an email and a portal notification.

### 5.4 Using reviewer groups

For batch assignment:

1. Go to **Review Queue** → **Reviewer Groups**.
2. Create or select a group (e.g. "Biomedical Panel Q4 2026").
3. Add reviewers to the group.
4. When assigning a submission, choose **Assign to Group** to notify all members.

### 5.5 Scheduling a meeting

1. Go to **Meetings** → **+ Schedule Meeting**.
2. Set **Date**, **Time**, **Duration**, **Location / Video link**.
3. Select participants (coordinators, reviewers, submitters as appropriate).
4. Attach agenda documents.
5. Click **Save** — all participants receive a calendar invitation by email.

### 5.6 Recording meeting minutes

1. Open a past or in-progress meeting.
2. Click **Edit Minutes**.
3. Enter the minutes text.
4. Click **Save Minutes** — archived with the meeting record.

### 5.7 Closing a submission

After all reviewers have submitted decisions:

1. Open the submission.
2. Click **Finalise Outcome**.
3. Choose the official status (Approved / Rejected / Deferred).
4. Enter coordinator comments (sent to the submitter).
5. Click **Confirm** — the submitter is notified by email.

### 5.8 Reports

Go to **Reports** to access:

| Report | Description |
|---|---|
| **Submission Summary** | Count by type, status, and time period |
| **Reviewer Workload** | Pending, completed, and overdue reviews per reviewer |
| **Turnaround Times** | Average days from submission to decision |
| **Committee Activity** | Meeting frequency and attendance |

Export any report to CSV or PDF via the **Export** button.

---

## 6. Administrator Guide

### 6.1 User management

Go to **Users** to view, create, edit, or deactivate user accounts.

**Create a user:**
1. Click **+ New User**.
2. Enter name, email, and temporary password.
3. Assign one or more roles: `admin`, `coordinator`, `reviewer`, `student`.
4. Click **Create**. The user receives a welcome email.

**Edit a user:**
1. Click the user's name.
2. Update details and click **Save**.

**Deactivate a user:**
1. Click the user's name → **Deactivate**.
2. Confirm. The user is immediately unable to log in.

**Unlock a locked account:**
1. Open the user → **Unlock Account**.

### 6.2 Role assignment

A single user can hold multiple roles. Roles are cumulative — an admin also has all coordinator and reviewer capabilities.

| Role | Capabilities |
|---|---|
| `student` | Create/manage own submissions |
| `reviewer` | Access review queue for assigned submissions |
| `coordinator` | Full submission pipeline management, reports |
| `admin` | All of the above + system settings, user management |

### 6.3 System settings

**Admin → Settings** contains all portal-wide configuration. See the [Operations Manual](./OPERATIONS-MANUAL.md#5-system-configuration) for the full settings reference.

Key settings:

- **Organization** — portal name, logo, timezone, locale
- **Email** — outbound SMTP configuration
- **SSO Providers** — identity provider configuration
- **Password Policy** — complexity, expiry, lockout
- **Feature Flags** — turn portal features on or off
- **Backup** — trigger backups and download archives

### 6.4 Audit log

**Admin → Audit Log** shows a timestamped record of all administrative actions, login events, and workflow transitions.

Filter by:
- Date range
- User
- Action type (login, submission, review, settings change, etc.)

Export to CSV for compliance reporting.

### 6.5 Theming and branding

1. **Settings → Organization → Primary Colour** — enter a hex colour (e.g. `#1a3a6b`).
2. **Logo URL** — enter a URL to your institution's logo (PNG/SVG recommended).
3. Click **Save** — changes apply immediately across all active sessions.

### 6.6 Backup and restore

**Trigger a backup:**  
**Settings → Backup & Archive → Run Backup Now**

**Download a backup:**  
In the backup list, click **Download** next to a backup file.

**Restore from backup:**  
Restores must be performed via the CLI. See the [Operations Manual — Backups](./OPERATIONS-MANUAL.md#3-backups).

---

## 7. Notifications

### Notification types

| Event | Who receives it |
|---|---|
| New submission | Coordinator |
| Reviewer assigned | Reviewer |
| Review submitted | Coordinator, submitter |
| Revisions requested | Submitter |
| Outcome finalised | Submitter |
| Meeting scheduled | All invited participants |
| Meeting reminder | All invited participants (24h before) |
| Appeal submitted | Coordinator |
| Password expiry warning | User (7 days before expiry) |

### Notification centre

Click the bell icon in the topbar. Unread notifications are shown with a red badge.

- Click a notification to jump to the relevant submission or meeting.
- Click **Mark all as read** to dismiss all.

### Email notifications

If your system administrator has configured SMTP, you also receive email for the events above.

---

## 8. Account Settings

Click your avatar in the top-right corner → **Profile** or **Preferences**.

### Profile

- Update your display name, email, and phone number.
- Upload a profile picture.
- View your role(s) and account creation date.

### Change password

1. **Profile → Security → Change Password**
2. Enter your current password.
3. Enter and confirm your new password.
4. Click **Update Password**.

### Dark mode

Click the 🌙 moon icon in the topbar to toggle dark mode. Your preference is saved per device.

### Print / PDF export

On any submission detail page, click **Print / Export PDF** in the action bar to open a print-optimised view. Use your browser's print function (Ctrl+P / Cmd+P) to save as PDF.

---

## 9. Frequently Asked Questions

**Q: I forgot my password.**  
A: Click **Forgot Password** on the login page. Enter your email; you will receive a reset link valid for 60 minutes.

**Q: My login is locked.**  
A: After 5 consecutive failed logins, accounts are locked for 30 minutes. Contact your system administrator to unlock early via **Admin → Users → Unlock**.

**Q: I can't edit my submission after submitting.**  
A: Submitted submissions are locked. Request an edit unlock from your coordinator, or wait for a "Revisions Requested" decision.

**Q: I don't see the file I uploaded.**  
A: Verify the upload was successful (look for the filename in the Documents section). Large files may take a few seconds to process. If the file is missing after a page refresh, try uploading again. If the problem persists, contact your administrator (storage disk may be full).

**Q: I'm not receiving email notifications.**  
A: Check your spam folder. If notifications are not arriving, ask your administrator to verify SMTP settings in **Settings → Email → Send Test Email**.

**Q: Can I use the portal on mobile?**  
A: Yes. The portal is fully responsive and works on modern mobile browsers. For best results, use Chrome or Safari on iOS/Android.

**Q: How do I log out?**  
A: Click your avatar in the topbar → **Logout**. All sessions are terminated when you log out.

**Q: The portal is slow.**  
A: Contact your system administrator. The most common causes are a full disk, an overloaded queue worker, or insufficient server RAM. See the [Operations Manual — Troubleshooting](./OPERATIONS-MANUAL.md#11-troubleshooting).
