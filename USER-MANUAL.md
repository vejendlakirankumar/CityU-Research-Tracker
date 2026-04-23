# CityU Research Review Portal — User Manual

> **Version:** 2.0  
> **Last updated:** April 2026  
> **Audience:** All portal users — students, reviewers, coordinators, and administrators

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Portal Navigation](#2-portal-navigation)
3. [Student Guide](#3-student-guide)
4. [Reviewer Guide](#4-reviewer-guide)
5. [Coordinator Guide](#5-coordinator-guide)
6. [Administrator Guide](#6-administrator-guide)
7. [Notifications](#7-notifications)
8. [Account Settings](#8-account-settings)
9. [Frequently Asked Questions](#9-frequently-asked-questions)

---

## 1. Getting Started

### 1.1 Creating an account

1. Browse to the portal URL provided by your institution.
2. Click **Register** on the login page.
3. Enter your full name, institutional email address, and a password, then click **Create Account**.
4. Check your inbox for a verification email and click the confirmation link.
5. Log in with your email and password.

### 1.2 Logging in with SSO

If your institution has configured Single Sign-On (e.g. Microsoft Entra / Azure AD):

1. Click the **Sign in with [Provider]** button on the login page.
2. Complete authentication through your institution's identity provider.
3. On your first SSO login, a portal account is created automatically with your institutional email.

### 1.3 Password requirements

- Minimum 8 characters
- At least one uppercase letter, one number, and one special character
- Expiry and reuse policy are set by your administrator

---

## 2. Portal Navigation

### 2.1 Layout

The portal uses a **left sidebar** for navigation and a **top header bar**. On small screens, a **bottom navigation bar** replaces the sidebar.

### 2.2 Sidebar sections and items by role

#### General

| Sidebar item | Student | Reviewer | Coordinator | Admin |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Submissions | ✓ | ✓ | ✓ | ✓ |
| Assignments | — | ✓ | ✓ | ✓ |
| My Analytics | — | ✓ | — | — |
| Notifications | ✓ | ✓ | ✓ | ✓ |
| Calendar | ✓ | ✓ | ✓ | ✓ |
| References | ✓ | — | — | — |
| Reports | — | — | ✓ | ✓ |

#### Configuration *(coordinator and admin only)*

| Sidebar item | Description |
|---|---|
| Submission Categories | Manage submission types and their review rules |
| Workflows | Define multi-stage review workflows |
| Reviewer Pool | Manage the pool of available reviewers |
| Researcher Access | Grant or revoke researcher portal access |
| Programs | Manage academic programs and directors |

#### Administration *(admin and coordinator unless noted)*

| Sidebar item | Coordinator | Admin |
|---|:---:|:---:|
| User Management | ✓ | ✓ |
| Gated Reviews | ✓ | ✓ |
| Review Management | ✓ | ✓ |
| Appeals | ✓ | ✓ |
| Announcements | ✓ | ✓ |
| Audit Log | — | ✓ |
| Webhooks | — | ✓ |
| Settings | — | ✓ |

### 2.3 Top header

| Element | Function |
|---|---|
| Bell icon | Open the notification centre |
| Dark mode toggle | Switch between light and dark themes |
| User avatar | Open account menu: Profile, and Logout |

---

## 3. Student Guide

Students submit research work for review and track its progress through the review pipeline.

### 3.1 Dashboard

The **Dashboard** shows a summary of your active submissions, any actions required (e.g. revisions due), and recent notifications.

### 3.2 Creating a new submission

1. Go to **Submissions** → **+ New Submission**.
2. Select a **Submission Type** from those configured by your institution (e.g. Academic Research Submission, Grant Application, Project Proposal, Publication).
3. Fill in the required fields:
   - **Title** and **Abstract**
   - **Authors / Co-investigators** — add co-authors by name, email, and affiliation. You may invite them to join the portal so they can follow progress.
   - **Keywords** and any other metadata fields shown for your submission type.
4. Select the relevant **Program** (if applicable).
5. Click **Save as Draft** to continue editing later, or proceed to upload documents before submitting.

### 3.3 Uploading documents

1. Open your submission and click the **Documents** tab.
2. Click **Upload File** and select your file (accepted formats and size limits are shown in the upload panel; PDF and DOCX are accepted for most submission types).
3. Each upload creates a new **version**. Version history is preserved and accessible on the Documents tab.
4. Click **Save** after uploading.

> You must upload at least one document before you can submit.

### 3.4 Submitting for review

Once your draft is complete and at least one document has been uploaded:

1. Open the submission.
2. Click **Submit** in the action bar at the bottom of the page.
3. Confirm the submission in the dialog that appears.

The submission status changes to **Submitted** and coordinators are notified.

> Once submitted, the submission is locked and cannot be edited unless a coordinator requests revisions.

### 3.5 Understanding submission statuses

| Status | What it means | Your next action |
|---|---|---|
| **Draft** | Saved but not yet submitted | Edit and submit when ready |
| **Submitted** | Received; awaiting reviewer assignment | Wait for coordinator to assign reviewers |
| **Awaiting Reviewers** | Submitted; coordinators are assigning reviewers | No action required |
| **In Review** | Reviewers are actively reviewing your submission | Wait for their decision |
| **Revision Required** | Reviewer(s) have requested changes | Upload revised documents and resubmit |
| **Revision Submitted** | You have resubmitted after revisions | Wait for reviewers to review again |
| **Pending Release** | All reviews complete; awaiting gatekeeper approval | Wait for coordinator/gatekeeper decision |
| **Accepted** | Submission fully approved | No further action required |
| **Conditionally Accepted** | Accepted subject to minor conditions | Follow coordinator instructions |
| **Rejected** | Submission declined | You may appeal (see §3.8) |
| **Appeal Pending** | Your appeal is under review | Wait for coordinator decision |
| **Withdrawn** | You withdrew the submission | Read-only — cannot be resubmitted |
| **Cancelled** | Cancelled by an administrator | Read-only |

### 3.6 Viewing feedback

When reviewers submit their decisions, their comments are visible on the **Feedback** tab of the submission detail page.

- **Reviewer feedback** — comments from assigned reviewers, displayed after the coordinator releases the outcome.
- **Activity log** — on the **Activity** tab, see a full timeline of every status change, assignment, and action taken on your submission.

### 3.7 Responding to revision requests

When status changes to **Revision Required**:

1. Open the submission — a banner shows the revision instructions and reviewer comments.
2. Click the **Documents** tab and upload a revised version of your document.
3. Optionally add a **Change Summary** describing what you changed.
4. Click **Resubmit for Review** in the action bar.

Status will change to **Revision Submitted** and reviewers are notified.

### 3.8 Appealing a rejection

If your submission is **Rejected**, you may lodge a formal appeal:

1. Open the rejected submission.
2. Click **Appeal** in the action bar.
3. In the **Appeal Rejection** dialog, enter your grounds for appeal.
4. Click **Submit Appeal**.

Status changes to **Appeal Pending**. Coordinators are notified and will review the appeal. You will receive a notification with their decision.

### 3.9 Withdrawing a submission

You can withdraw any of your own submissions that has not yet reached a terminal status (Accepted, Conditionally Accepted, Rejected, Withdrawn, or Cancelled):

1. Open the submission.
2. Click **Withdraw** in the action bar.
3. Confirm in the dialog.

The submission is immediately locked and marked **Withdrawn**. This action is permanent and cannot be undone. If the submission was in active review, any assigned reviewers are automatically removed and coordinators are notified.

### 3.10 Communicating with coordinators

Use the **Communication** tab on any submission to send and receive messages directly with coordinators managing your submission. All messages are logged against the submission record.

### 3.11 References tool

The **References** page (sidebar → References) is a citation management helper available to students.

1. Search for a publication by title, DOI, ISBN, or URL.
2. The portal resolves metadata and generates a formatted **APA 7th edition** reference.
3. Copy the reference or add it to your reference list.
4. References can be exported for use in your submission documents.

### 3.12 Calendar

The **Calendar** page shows any meetings you have been invited to (e.g. a review committee presentation). Click a meeting entry to view its details, agenda, and joining instructions.

### 3.13 Printing / exporting to PDF

On any submission detail page, click the **Print / PDF** button in the top-right corner to open a print-optimised view. Use your browser's print dialog (Ctrl+P / Cmd+P) to save as a PDF.

---

## 4. Reviewer Guide

Reviewers are invited to assess submissions assigned to them by coordinators.

### 4.1 Dashboard

The **Dashboard** shows:
- Pending reviews assigned to you
- Overdue reviews (highlighted in red)
- Recently completed reviews

### 4.2 Assignments queue

Go to **Assignments** to see the full list of submissions assigned to you.

| Column | Description |
|---|---|
| Title | Submission title (click to open) |
| Type | Submission type (e.g. ARS, PROJ) |
| Stage | Review stage you are assigned to |
| Deadline | Your review deadline |
| Status | Your assignment status: Pending / Accepted / Completed |

Use the status filter tabs to switch between **Pending**, **Active**, and **Completed** assignments.

### 4.3 Accepting or declining an assignment

When first assigned, your assignment status is **Pending**:

- Click **Accept** to confirm you will review the submission.
- Click **Decline** if you are unable to review it (e.g. due to a conflict of interest or workload). A decline notification is sent to the coordinator.

### 4.4 Declaring a conflict of interest

If you have a conflict of interest with a submission (e.g. you know the authors or have a competing interest):

1. Open the assignment.
2. Click **Declare Conflict** and enter your reason.
3. Click **Submit** — the assignment is flagged for the coordinator to reassign.

You will not be able to access submission details once a conflict is declared.

### 4.5 Reviewing a submission

1. Open the assignment from **Assignments**.
2. Read the submission details on the **Overview** tab — title, abstract, authors, submission type, and metadata.
3. Switch to the **Documents** tab to read uploaded files. DOCX files render inline; PDFs open in the browser viewer. Click **Download** to save a copy.
4. Review the **Feedback** tab to see any prior reviewer comments if this is a multi-stage workflow.
5. Scroll to the **Review Decision** panel.

### 4.6 Submitting your review decision

In the **Review Decision** panel:

1. Write your **Reviewer Comments** — these will be visible to the submitter once the coordinator releases the outcome.
2. Add **Internal Notes** if needed — visible to coordinators only, not the submitter.
3. Select one of the following decisions:
   - **Approve** — recommend the submission be accepted.
   - **Request Revisions** — return the submission to the author with specific changes required.
   - **Reject** — recommend the submission be declined.
4. Click **Submit Decision**.

> Once you submit a decision, you can update it (via **Edit Decision**) until the coordinator finalises the outcome.

### 4.7 Requesting a deadline extension

If you need more time:

1. Open the assignment.
2. Click **Request Extension**.
3. Enter the number of additional days needed and your reason.
4. Click **Submit Request** — the coordinator will approve or decline.

You can see the status of your extension request on the assignment card (Pending / Approved / Rejected). Each assignment allows a limited number of extension requests.

### 4.8 Requesting a meeting

For gated-review submissions, you may be invited to a committee meeting or be able to request one:

1. On the submission detail page, click **Request Meeting** if the option is available.
2. Select the meeting type.
3. The coordinator will schedule and confirm the meeting.

Meeting invitations appear in your **Calendar** and are sent by email.

### 4.9 My Analytics

**My Analytics** (sidebar) shows personal performance statistics:

- Total submissions reviewed
- Average decision turnaround time
- Decision breakdown (approve / revise / reject)
- Overdue rate and on-time completion rate

---

## 5. Coordinator Guide

Coordinators manage the entire submission review pipeline from receipt to final outcome.

### 5.1 Dashboard

The coordinator dashboard shows:
- Total active submissions
- Submissions awaiting reviewer assignment
- Pending and overdue reviews
- Active reviewers
- Recent activity across all submissions

### 5.2 Viewing all submissions

Go to **Submissions**. Coordinators see all submissions portal-wide, not just their own.

- Use the **Search** bar to find by title or ID.
- Use the **Status** filter to view submissions at a specific stage.
- Use the **Type** filter to filter by submission category.
- Click any submission row to open its detail page.

### 5.3 Assigning reviewers to a submission

1. Open a submission that is in **Submitted** or **Awaiting Reviewers** status.
2. Click **Assign Reviewer** in the action bar.
3. Select a reviewer from the dropdown — the list shows members of the configured reviewer pool.
4. Set a **Review Deadline**.
5. Click **Confirm Assignment**.

The reviewer receives a portal notification and email. Their assignment status begins as **Pending** until they accept.

You can assign multiple reviewers to the same submission (for multi-reviewer stages). Each appears as a separate assignment card.

### 5.4 Review workflows and stages

Submissions follow the workflow configured for their type (see §6.5 Workflows). Each workflow has one or more **stages**. A submission moves through stages sequentially.

- **Stage reviewers** are assigned per stage.
- When all reviewers in a stage have submitted decisions, the coordinator is notified to proceed to the next stage or close the submission.
- The active stage is shown on the submission header.

### 5.5 Gated reviews

Some submission types use a **gated review** workflow. In a gated review, a designated **gatekeeper** must approve or reject a submission before it advances from the **Pending Release** stage.

Go to **Gated Reviews** (sidebar → Administration) to manage submissions awaiting a gating decision:

| Tab | Contents |
|---|---|
| Pending | Submissions in Pending Release waiting for your gatekeeper decision |
| Recently Decided | Submissions where a gating decision was recently made |

**To make a gating decision:**

1. Click the submission title in the **Pending** list.
2. Review the submission and all reviewer decisions.
3. Select **Approve**, **Conditionally Approve**, or **Reject** in the Gating Decision panel.
4. Enter any coordinator notes.
5. Click **Confirm** — the submission status is updated and the submitter is notified.

### 5.6 Review Management

**Review Management** (sidebar → Administration) provides a consolidated view of all active reviewer assignments across all submissions.

Use this page to:
- Monitor which reviewers are overdue.
- View pending deadline extension requests and approve or decline them.
- View and resolve conflict-of-interest declarations.
- Reassign submissions when a reviewer declines or has a conflict.

**To approve or decline a deadline extension:**
1. Click the assignment row.
2. Review the reason and requested days.
3. Click **Approve** or **Decline**.

**To resolve a conflict of interest:**
1. Find the flagged assignment.
2. Click **Reassign** and select a replacement reviewer.

### 5.7 Finalising a submission outcome

Once all reviewers have decided and any gating step is complete:

1. Open the submission.
2. Click **Finalise Outcome** in the action bar.
3. Choose the official outcome: **Accepted**, **Conditionally Accepted**, or **Rejected**.
4. Enter coordinator comments (delivered to the submitter via notification and email).
5. Click **Confirm**.

The submission enters a terminal status and is locked.

### 5.8 Cancelling a submission

Coordinators (and admins) can cancel any submission that has not yet reached a terminal status:

1. Open the submission.
2. Click **Cancel Submission** in the action bar.
3. Confirm the cancellation.

The submission is immediately locked and marked **Cancelled**. The submitter is notified. This action is permanent.

### 5.9 Managing appeals

When a submitter appeals a rejection, the submission status changes to **Appeal Pending** and coordinators are notified.

Go to **Appeals** (sidebar → Administration) to review all pending and resolved appeals.

**To process an appeal:**

1. Click the appeal entry to open it.
2. Read the submitter's grounds and review the submission history.
3. Choose **Uphold Rejection** (status remains Rejected) or **Overturn Rejection** (status changes and the submission re-enters the pipeline).
4. Enter a coordinator decision note.
5. Click **Save Decision** — the submitter is notified of the outcome.

### 5.10 Scheduling meetings

Meetings can be scheduled directly against a submission or from the calendar.

**From a submission:**

1. Open the submission and click the **Overview** tab.
2. Scroll to the **Meetings** section.
3. Click **Request Meeting** or **+ Schedule Meeting** (depending on the submission type's meeting configuration).
4. Set **Date**, **Time**, **Duration**, **Meeting Type**, and **Location / Video Link**.
5. Add participants (reviewers, submitters, coordinators).
6. Attach agenda documents if needed.
7. Click **Save** — all participants are notified and the meeting appears in the **Calendar**.

**From the Calendar:**

1. Go to **Calendar**.
2. Click **+ New Meeting**.
3. Fill in meeting details, then link it to a submission if applicable.

**Meeting statuses:** Requested → Confirmed → Completed / Cancelled.

Coordinators can **Confirm** pending meeting requests, **Cancel** meetings, and record **Meeting Minutes** after the meeting.

### 5.11 Announcements

Go to **Announcements** (sidebar → Administration) to post portal-wide notices visible on the login page and dashboard.

1. Click **+ New Announcement**.
2. Enter a **Title**, **Body** text, and optional **Expiry Date**.
3. Click **Publish**.

Active announcements are shown to all users at the top of their dashboard. Expired announcements are automatically hidden.

### 5.12 Programs

Go to **Programs** (sidebar → Configuration) to manage academic programs:

- Create programs with a name, school, and optional program director.
- Assign a user as program director — they can view submissions linked to their program.
- Link programs to reviewer groups for easier assignment.

Submitters can link their submission to a program when creating it.

### 5.13 Researcher Access

Go to **Researcher Access** (sidebar → Configuration) to grant external researchers read-only access to specific submissions or submission categories without giving them a full student account.

### 5.14 Reports

Go to **Reports** (sidebar → General) to access analytics:

| Report | Description |
|---|---|
| **Submission Summary** | Count by type, status, and date range |
| **Reviewer Workload** | Pending, completed, and overdue reviews per reviewer |
| **Turnaround Times** | Average days from submission to final decision |
| **Stage Analysis** | Breakdown of decisions per review stage |
| **Appeals Summary** | Appeal rate and outcomes |

- Use the date range picker to scope reports by period.
- Click **Export** to download any report as CSV or PDF.

---

## 6. Administrator Guide

Administrators have all coordinator capabilities plus system-level configuration, user management, and audit access.

### 6.1 User management

Go to **User Management** (sidebar → Administration).

#### Create a user

1. Click **+ New User**.
2. Enter full name, email address, and a temporary password.
3. Assign one or more roles: `student`, `reviewer`, `coordinator`, `admin`.
4. Click **Create** — the user receives a welcome email with login instructions.

#### Edit a user

1. Click the user's name in the list.
2. Update name, email, roles, or status.
3. Click **Save**.

#### Deactivate / reactivate a user

- Click the user's name → **Deactivate** to immediately revoke login access.
- Click **Reactivate** to restore access.

#### Unlock a locked account

After multiple failed login attempts, an account is locked. To unlock it:

1. Open the user's profile in User Management.
2. Click **Unlock Account**.

#### Role assignment

A user can hold multiple roles simultaneously. Roles are additive — an admin can also act as a coordinator or reviewer.

| Role | Capabilities |
|---|---|
| `student` | Create and manage own submissions, use References tool |
| `reviewer` | View and decide on assigned submissions, view own analytics |
| `coordinator` | Full pipeline management, reports, all coordinator features |
| `admin` | All of the above + settings, audit log, webhooks, system integrations |

### 6.2 Submission Categories

Go to **Submission Categories** (sidebar → Configuration) to manage submission types:

- **Create / edit** submission types with a name, slug, description.
- **Review settings**: blind review, gated review, allow meetings.
- **File settings**: allowed extensions, max file size (MB), max number of files.
- **Activate / deactivate** types to control which ones are available to submitters.

### 6.3 Workflows

Go to **Workflows** (sidebar → Configuration) to define multi-stage review workflows:

1. Click **+ New Workflow** and give it a name.
2. Add **stages** in order (e.g. "Initial Screening", "Expert Review", "Committee Review").
3. For each stage, configure:
   - **Stage name** and role label shown to reviewers
   - **Is gatekeeper stage** — whether a coordinator must approve before advancing
   - **Review criteria / rubric** (if applicable)
4. Assign the workflow to a submission type in Submission Categories.

### 6.4 Reviewer Pool

Go to **Reviewer Pool** (sidebar → Configuration) to manage which users are available as reviewers:

- Add users (who have the `reviewer` role) to the pool.
- Organise reviewers into **groups** (e.g. by field, department, or panel).
- Groups can be assigned en masse to submissions when multiple reviewers are needed.

### 6.5 System Settings

Go to **Settings** (sidebar → Administration — admin only).

#### Organisation

- **Portal name** — displayed in the header and emails.
- **Logo** — URL to your institution's logo (PNG or SVG recommended).
- **Primary colour** — hex code used for the portal's branded colour scheme.
- **Timezone** and **Locale** — affects displayed dates and email formatting.

#### Email (SMTP)

- Configure outbound mail server (host, port, username, password, encryption).
- Click **Send Test Email** to verify the configuration.

#### SSO Providers

- Configure Microsoft (Entra ID / Azure AD) or other OAuth 2.0 / SAML providers.
- Set client ID, tenant, and secret for each provider.
- Toggle a provider on or off without deleting its configuration.

#### Password Policy

- Minimum length and complexity requirements.
- Password expiry period (days). Set to `0` to disable expiry.
- Number of previous passwords disallowed for reuse.
- Account lockout threshold (failed attempts) and lockout duration.

#### Integrations

- **Turnitin** — configure your Turnitin API key and webhook secret to enable similarity checking on submissions. When enabled, a **Similarity Check** panel appears on each submission detail page for reviewers and coordinators.
- If Turnitin is not enabled, a built-in local similarity check is used instead.

#### Feature Flags

Enable or disable portal features globally:
- Meetings / calendar
- Blind review
- Gated review
- Appeals
- References tool

#### Backup & Archive

- Click **Run Backup Now** to trigger an immediate database and file backup.
- View the backup list and click **Download** to save a backup archive.
- To restore, use the CLI — see the [Operations Manual — Backups](./OPERATIONS-MANUAL.md#3-backups).

### 6.6 Audit Log

Go to **Audit Log** (sidebar → Administration — admin only).

The audit log records every significant action in the system with a timestamp and the acting user:

- User logins and logouts
- Submission creation, status transitions, and deletions
- Reviewer assignments and decisions
- Settings changes
- User account changes (create, edit, deactivate, unlock)
- Backup operations

**Filter options:**
- Date range
- Acting user
- Action type

Click **Export CSV** to download the filtered log for compliance reporting.

### 6.7 Webhooks

Go to **Webhooks** (sidebar → Administration — admin only) to configure outbound HTTP webhooks:

1. Click **+ New Webhook**.
2. Enter the **Endpoint URL** (must be HTTPS).
3. Select the **Events** to subscribe to (e.g. submission created, decision submitted).
4. Enter a **Secret** — used to sign payloads with HMAC-SHA256 so your endpoint can verify authenticity.
5. Click **Save**.

Click **Test** on any webhook to send a sample payload and verify your endpoint responds with HTTP 200.

Delivery history and failure logs are shown on each webhook's detail page.

### 6.8 Announcements

Same as the coordinator feature (§5.11). Admins can create, edit, and delete all announcements.

---

## 7. Notifications

### 7.1 Notification events

| Event | Notified parties |
|---|---|
| New submission received | Coordinators |
| Reviewer assigned | Assigned reviewer |
| Reviewer accepted / declined assignment | Coordinators |
| Review decision submitted | Coordinators |
| Revision required | Submitter |
| Revision resubmitted | Coordinators, assigned reviewers |
| Submission outcome finalised (accepted / rejected) | Submitter |
| Submission cancelled | Submitter |
| Submission withdrawn | Coordinators, admins |
| Appeal submitted | Coordinators |
| Appeal decision made | Submitter |
| Meeting scheduled | All invited participants |
| Meeting confirmed | Meeting requester |
| Meeting cancelled | All invited participants |
| Meeting reminder | All invited participants (sent 24 hours before) |
| Deadline extension requested | Coordinators |
| Deadline extension approved / declined | Requesting reviewer |
| Conflict of interest flagged | Coordinators |

### 7.2 Notification centre

Click the **bell icon** in the top header. Unread notifications are indicated by a red badge counter.

- Click any notification to navigate directly to the relevant submission, meeting, or assignment.
- Click **Mark all as read** to clear the badge.
- All notifications remain in the list — use the **Notifications** page (sidebar) for a full paginated history.

### 7.3 Email notifications

All portal notifications also trigger email delivery if SMTP is configured by your administrator. Emails include a direct link back to the relevant item in the portal.

If you are not receiving emails, check your spam/junk folder and ask your administrator to verify the SMTP configuration via **Settings → Email → Send Test Email**.

---

## 8. Account Settings

### 8.1 Opening your profile

Click your **avatar** (initials or photo) in the top-right corner of the header → **Profile**.

### 8.2 Profile details

- Update your **display name** and **email address**.
- Upload or change your **profile picture**.
- View your current **roles** and the date your account was created.

### 8.3 Changing your password

1. On your Profile page, go to the **Security** section.
2. Click **Change Password**.
3. Enter your **current password**, then enter and confirm your **new password**.
4. Click **Update Password**.

If you have forgotten your current password, log out and use **Forgot Password** on the login page.

### 8.4 Dark mode

Click the **moon / sun icon** in the top header to toggle between light and dark themes. Your preference is stored in your browser and persists across sessions on the same device.

### 8.5 Print / export to PDF

On any submission detail page, click the **Print / PDF** button (top-right, next to the back button) to open a print-optimised view. Use your browser's print dialog (Ctrl+P / Cmd+P) to print or save as PDF.

---

## 9. Frequently Asked Questions

**Q: I forgot my password.**  
A: Click **Forgot Password** on the login page. Enter your registered email address — you will receive a password reset link valid for 60 minutes.

**Q: My account is locked and I cannot log in.**  
A: Accounts are locked after several consecutive failed login attempts. Wait 30 minutes for the lock to expire automatically, or contact your system administrator to unlock your account immediately via User Management.

**Q: I submitted my application but now need to change it.**  
A: Submissions are locked after submission. Contact your coordinator to request an unlock, or wait for a **Revision Required** decision which will allow you to upload a revised version.

**Q: I cannot see the Withdraw button on my submission.**  
A: The Withdraw button is only visible when: (a) you are the submitter of the submission, (b) you have the `student` role (not admin/coordinator), and (c) the submission has not yet reached a terminal status (Accepted, Rejected, Withdrawn, Cancelled, or Conditionally Accepted).

**Q: What is the difference between Withdraw and Cancel?**  
A: **Withdraw** is a student action — you can withdraw your own submission at any time before it reaches a terminal status. **Cancel** is an admin/coordinator action — they can cancel any active submission on administrative grounds. Both actions are permanent and lock the submission.

**Q: A file I uploaded is not showing up.**  
A: Refresh the page. Large files may take a few seconds to process. If the file is still missing, try uploading again. Contact your administrator if the problem persists (the storage disk may be full).

**Q: I am not receiving email notifications.**  
A: Check your spam/junk folder first. If notifications are not arriving, ask your administrator to verify the SMTP configuration via **Settings → Email → Send Test Email**.

**Q: Can I use the portal on a mobile device?**  
A: Yes. The portal is fully responsive and optimised for mobile browsers. The sidebar is replaced by a bottom navigation bar on small screens. Chrome and Safari on iOS/Android are recommended.

**Q: How do I log out?**  
A: Click your avatar in the top-right corner → **Logout**. Your session is immediately terminated.

**Q: The portal is very slow or unresponsive.**  
A: Contact your system administrator. Common causes include a full disk, overloaded background worker, or insufficient server memory. Refer to the [Operations Manual — Troubleshooting](./OPERATIONS-MANUAL.md#11-troubleshooting).

**Q: How are similarity scores calculated?**  
A: If your administrator has configured Turnitin integration, submissions are checked against the Turnitin database. Without Turnitin, a local similarity check compares abstracts and content against other submissions in the portal. Similarity scores are visible to reviewers and coordinators on the submission detail page.
