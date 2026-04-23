# v2 — UI Specification

---

## 1. Design System

### 1.1 Design Tokens

**Colors** (Tailwind custom palette)

| Token | Value | Use |
|---|---|---|
| `brand-500` | `#1E40AF` (deep blue) | Primary buttons, active links |
| `brand-50` | `#EFF6FF` | Active row backgrounds, selected states |
| `surface` | `#F8FAFC` | Page background |
| `card` | `#FFFFFF` | Card/panel backgrounds |
| `border` | `#E2E8F0` | Card borders, dividers |
| `text-primary` | `#0F172A` | Headings, body text |
| `text-muted` | `#64748B` | Labels, helper text |

**Status Badge Colors**

| Status | Badge Style |
|---|---|
| DRAFT | Gray outline |
| SUBMITTED | Blue outline |
| IN_REVIEW | Blue filled |
| REVISION_REQUIRED | Amber filled |
| ACCEPTED | Green filled |
| CONDITIONALLY_ACCEPTED | Teal filled |
| REJECTED | Red filled |
| WITHDRAWN | Gray filled |
| APPEAL_PENDING | Orange outline |

**Stage Instance Badge Colors**

| Stage Status | Color |
|---|---|
| PENDING | Gray |
| ACTIVE | Blue pulse animation |
| PASSED | Green |
| REVISION_REQUIRED | Amber |
| FAILED | Red |
| SKIPPED | Gray, strikethrough text |

### 1.2 Typography

- Font: Inter (system fallback: -apple-system)
- Scale: `text-xs` (12) | `text-sm` (14) | `text-base` (16) | `text-lg` (18) | `text-xl` (20) | `text-2xl` (24) | `text-3xl` (30)
- Headings: `font-semibold`
- Body: `font-normal`

### 1.3 Spacing

8px grid. All spacing values multiples of 4px (Tailwind default scale).

### 1.4 Responsive Breakpoints

| Name | Breakpoint |
|---|---|
| Mobile | < 640px |
| Tablet | 640–1024px |
| Desktop | > 1024px |

### 1.5 Accessibility

- All interactive elements keyboard-accessible
- ARIA labels on icon-only buttons
- Focus ring: `ring-2 ring-brand-500 ring-offset-2`
- Color contrast: ≥ 4.5:1 for normal text (WCAG AA)
- All form inputs have associated `<label>`
- Error messages linked to inputs via `aria-describedby`

---

## 2. Layout Shell

### 2.1 Authenticated Shell

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR (desktop) / HAMBURGER DRAWER (mobile)             │
│  ┌─────────┐  ┌──────────────────────────────────────────┐ │
│  │         │  │  TOP BAR                                  │ │
│  │  LOGO   │  │  Page title            🔔 3  Avatar ▾    │ │
│  │         │  └──────────────────────────────────────────┘ │
│  ├─────────┤  ┌──────────────────────────────────────────┐ │
│  │ Nav     │  │                                          │ │
│  │ items   │  │   PAGE CONTENT                           │ │
│  │  (role  │  │                                          │ │
│  │  based) │  │                                          │ │
│  │         │  │                                          │ │
│  │         │  └──────────────────────────────────────────┘ │
│  └─────────┘                                               │
└────────────────────────────────────────────────────────────┘
```

**Sidebar width:** 240px (collapsible to icon-only 64px)

### 2.2 Navigation by Role

Navigation items are role-based. The **Gated Reviews** item is shown conditionally to any reviewer who has at least one active or pending assignment on an `is_gatekeeper = true` stage — it is not tied to a global role.

**Student**
- My Submissions
- New Submission
- Notifications

**Reviewer** *(any user with global role `reviewer`)*
- My Review Queue
- Gated Reviews *(visible only when assigned to a gatekeeper stage)*
- Completed Reviews
- Notifications

**Coordinator**
- All Submissions *(group-scoped — only submissions from users in assigned groups)*
- Assign Reviewers *(group-scoped)*
- Programs
- Notifications

> ⚠️ Coordinators do **not** see a "Users" item. User administration is Admin-only. See [08-user-management.md §3](08-user-management.md#3-coordinator-group-scoping).

**Admin**
- All Submissions
- Users
- Groups
- Programs
- Workflow Builder
- Submission Types
- Analytics
- Audit Log
- System Configuration
  - Organization
  - SSO
  - Email
  - Security & Password Policy
  - Notification Templates
  - Feature Flags
  - Backup & Archive
- Notifications

---

## 3. Student Portal

### 3.1 My Submissions List

**Route:** `/submissions`

```
┌─────────────────────────────────────────────────────────────┐
│  My Submissions                          [+ New Submission]  │
├─────────────────────────────────────────────────────────────┤
│  Filter: [All ▾] [Status ▾] [Type ▾]    🔍 Search...        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Dissertation Proposal — Chapter 1 Draft            │   │
│  │  Type: Dissertation · Version 2 · Updated 3 days ago│   │
│  │  ● IN REVIEW          Stage: Committee (Due Mar 1)  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Capstone Project Outline                           │   │
│  │  Type: Capstone · Version 1 · Submitted Jan 10     │   │
│  │  ⚠ REVISION REQUIRED                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Each card links to submission detail. Empty state shows illustration + "Create your first submission" CTA.

### 3.2 New Submission Form

**Route:** `/submissions/new`

Multi-step form (Wizard):

**Step 1 — Type & Program**
- Dropdown: Submission Type (only active types)
- Dropdown: Program (auto-populated from user's program, editable)
- After selection: show type description and required materials hint

**Step 2 — Details**
- Title (required, max 500)
- Abstract (required, textarea)
- Dynamic metadata fields (rendered from `submission_type.config`)

**Step 3 — Files**
- Dropzone (drag-and-drop + click)
- Shows allowed extensions and max file size
- Progress bar per file
- List of uploaded files with remove button

**Step 4 — Co-Authors** *(only shown when `enable_co_authors` flag is on)*
- Section header: “Add Co-Authors (optional)” with help text: “Co-authors will receive reviewer feedback notifications. Submitter identity remains hidden from reviewers.”
- Search box: “Search by name or email” — searches registered users; shows matching users with [Add] button
- “Invite by email” fallback: if no user found, shows “No user found. Invite [email] to register?” with name field + [Send Invite] button
- Current co-authors list: avatar + name/email + role badge + [Remove] icon
- Pending invites shown with ⚠️ badge and “Invitation pending” label + [Resend] / [Remove] actions
- Skip button available — co-authors can be added after submission from detail page

**Step 5 — Review & Submit**
- Summary of all entered data including co-authors
- "Save as Draft" button (no workflow started)
- "Submit" button (starts workflow — only enabled if files uploaded)

### 3.3 Submission Detail

**Route:** `/submissions/{id}`

```
┌────────────────────────────────────────────────────────────┐
│  ← Back   Dissertation Proposal — Chapter 1 Draft          │
│           ● IN REVIEW     Type: Dissertation · v2          │
├────────────────┬───────────────────────────────────────────┤
│  STAGE TIMELINE│  MAIN PANEL                               │
│                │                                           │
│  ① Gatekeeper  │  [Decision Box]          (only when       │
│    ✓ PASSED    │  ┌─────────────────┐      status=         │
│                │  │ ⚠ REVISION      │      REVISION_       │
│  ② Committee   │  │ REQUIRED        │      REQUIRED)       │
│    ● ACTIVE    │  │ "Revise methods"│                      │
│                │  │ [Submit Revision│                      │
│  ③ Prog Director│  │  Button]        │                      │
│    ○ PENDING   │  └─────────────────┘                      │
│                │                                           │
│                │  [Version History]                        │
│                │  v2 — Jan 15 · "Revised methodology"     │
│                │  v1 — Jan 1 · Initial submission          │
│                │                                           │
│                │  [Document Preview]                       │
│                │  📄 dissertation-v2.pdf   [Download]      │
│                │                                           │
│                │  [Meetings]  (if type allows)             │
│                │  No meetings scheduled                    │
│                │                                           │
│                │  [Authors]  (visible to submitter + ADM)  │
│                │  • Jane Smith (You) — Submitter           │
│                │  • Bob Lee — Co-Author                    │
│                │  • pending@x.com — ⚠ Invite pending       │
│                │  [+ Add Co-Author]                        │
└────────────────┴───────────────────────────────────────────┘

**Authors Panel** (in submission detail, submitter view):
- Lists all authors with role badge
- Pending invites shown with expiry countdown and [Resend] link
- [+ Add Co-Author] opens inline search / invite form
- [Remove] available for co-authors (not for submitter row)
- Panel is hidden from reviewers in all cases
```

**Stage Timeline Component**
- Vertical stepper on left
- Circle icon per stage: ✓ (PASSED/green), ● (ACTIVE/blue-pulse), ○ (PENDING/gray), ✗ (FAILED/red), ⚠ (REVISION/amber)
- On hover: show tooltip with stage name, status, due date
- On mobile: horizontal scrollable stepper at top

**Decision Box** (only visible when `status = REVISION_REQUIRED`)
- Alert card with amber border
- Shows the feedback message (if visible_to includes 'submitter')
- "Submit Revision" primary button → opens revision form

**Gated Release Box** (only visible when a GatedRelease exists)
- Shows decision (colored badge) + feedback text
- History of previous releases (older versions) in accordion

### 3.4 Submit Revision Form

**Route:** `/submissions/{id}/revisions/new` (or modal)

- Pre-filled with current submission data
- Change Summary field (required)
- New file upload (required)
- "Submit Revision" button — confirmation dialog before submit

### 3.5 Appeal Form

**Route:** `/submissions/{id}/appeal`

- Only visible when `status = REJECTED`
- Grounds text area (required)
- Warning: "Appeals are reviewed by administration and may take time."
- Submit button → confirmation dialog

---

## 4. Reviewer Portal

### 4.1 Review Queue

**Route:** `/reviews`

```
┌────────────────────────────────────────────────────────────┐
│  My Review Queue                                           │
├────────────────────────────────────────────────────────────┤
│  🔴 OVERDUE (2)                                            │
│  ┌───────────────────────────────────────────────────┐    │
│  │ Dissertation Proposal — Chan Siu Ming             │    │
│  │ Stage: Committee Review   ⏰ 3 days overdue        │    │
│  │                                     [Review Now →] │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  🟡 DUE SOON (1)                                          │
│  ┌───────────────────────────────────────────────────┐    │
│  │ Capstone Final Report — Li Wei                    │    │
│  │ Stage: Program Director    Due tomorrow            │    │
│  │                                     [Review Now →] │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  🔵 NEW (3)                                               │
│  [ list of newly assigned reviews ]                       │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Review Detail

**Route:** `/reviews/{stage_instance_id}`

```
┌────────────────────────────────────────────────────────────┐
│  ← Queue   Review: Dissertation — Chan Siu Ming            │
│            Stage: Committee Review   Due: Mar 1, 2026      │
├──────────────────┬─────────────────────────────────────────┤
│  DOCUMENT PANEL  │  DECISION PANEL                         │
│                  │                                         │
│  📄 doc.pdf      │  Decision *                             │
│  [Inline preview │  ○ Approve                              │
│   or PDF viewer] │  ○ Request Changes                      │
│                  │  ○ Reject                               │
│                  │                                         │
│  [Download]      │  Comments                               │
│                  │  ┌─────────────────────────────────┐   │
│  Other reviewers │  │ Textarea (required if not       │   │
│  on this stage:  │  │  Approve)                       │   │
│  (if visible)    │  └─────────────────────────────────┘   │
│  ● 2 pending     │                                         │
│                  │  [Submit Decision]                      │
│                  │                                         │
│                  │  ──────────────────────────             │
│                  │  Submission Details                     │
│                  │  Title, Abstract, Type                  │
└──────────────────┴─────────────────────────────────────────┘
```

- Document panel: If a single PDF, use embedded PDF viewer. Multiple files shown as download list.
- Decision panel is disabled after submission (shows read-only badge)
- If reviewer has already submitted: show their submitted decision + comments, read-only

### 4.3 Review History

**Route:** `/reviews/history`

Table view: Submission, Stage, Decision, Date submitted, Days taken
Sortable by date. Filterable by decision type.

---

## 5. Gated Review Portal

*(Visible to any reviewer assigned to a stage where `is_gatekeeper = true`.)*

### 5.1 Active Gated Reviews List

**Route:** `/gated-reviews`

```
┌────────────────────────────────────────────────────────────┐
│  Gated Reviews                                      │
├────────────────────────────────────────────────────────────────┤
│  🟡 PENDING RELEASE (2) — all stages complete, awaiting   │
│     your formal decision                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Dissertation Proposal — Chan Siu Ming    v2        │    │
│  │ Committee Review: 3/3 ✓ · Prog Director: 1/1 ✓   │    │
│  │                              [Issue Decision →]    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                            │
│  🔵 IN PROGRESS (3) — higher stages still ongoing         │
│  [ list of submissions with stage progress summary ]      │
└────────────────────────────────────────────────────────────────┘
```

The stage label names shown ("Committee Review", "Prog Director") are the configured `stage_role_label` values, not hardcoded strings.

### 5.2 Gated Review Detail

**Route:** `/gated-reviews/{id}`

```
┌────────────────────────────────────────────────────────────┐
│  ← Reviews   Dissertation — Chan Siu Ming                  │
│              Version 2 · ● IN REVIEW                       │
├─────────────────────────────────────────────────────────────┤
│  STAGES                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ① Committee Review                     ✓ PASSED     │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │ Dr. Lee Wai Man    ✓ Approved                │    │  │
│  │  │ "Strong methodology..."                      │    │  │
│  │  │ Prof. Chan         ✓ Approved                │    │  │
│  │  │ "Minor revision suggestions in section 3..." │    │  │
│  │  │ Dr. Wong           ✓ Approved                │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │  [Request Re-check]                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ② Program Director Review              ✓ PASSED     │  │
│  │  Prof. Au Yeung    ✓ Approved                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  RELEASE DECISION (enabled when all stages passed)        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Decision *                                          │  │
│  │  ● Accepted   ○ Conditionally Accepted               │  │
│  │  ○ Revision Required   ○ Rejected                    │  │
│  │                                                      │  │
│  │  Feedback to Student *                               │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ Textarea                                     │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  [Issue Formal Decision]                             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

- "Request Re-check" opens a dialog to select a stage and enter reason
- Release Decision panel only shows when `all_stages_complete = true`
- "Issue Formal Decision" shows confirmation dialog before submitting

---

## 6. Admin / Coordinator Portal

### 6.1 All Submissions

**Route:** `/admin/submissions`

Full-featured data table:
- Columns: Title, Type, Submitter, Program, Status, Version, Stage, Last Updated
- Filters: Status, Type, Program, Reviewer, Date range
- Sort on all columns
- Export to CSV button (admin only)
- Row click → Submission Detail (admin view — all data visible)

### 6.2 Submission Detail (Admin View)

Same as student view but with additional panels:
- Full stage decisions (no visibility stripping)
- Audit Log tab
- Assign Reviewers panel
- Admin Actions: Skip Stage, Cancel, Extend Deadline, Download All Files

### 6.3 Assign Reviewers

**Route:** `/admin/submissions/{id}/assign` (or slide-over panel from detail)

```
┌──────────────────────────────────────────────────────────┐
│  Assign Reviewers                           [×]          │
│  Submission: Dissertation — Chan Siu Ming                │
├──────────────────────────────────────────────────────────┤
│  Stage: ② Committee Review   (ACTIVE)                   │
│                                                          │
│  Currently assigned:                                     │
│  Dr. Lee Wai Man        [Remove]                         │
│  Prof. Chan             [Remove]                         │
│                                                          │
│  Add reviewer:                                           │
│  🔍 Search users...                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Dr. Wong Pak Lam  · Committee · 2 active reviews   │  │
│  │                                      [Add +]       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [Save Changes]                                          │
└──────────────────────────────────────────────────────────┘
```

Shows current workload for each potential reviewer to help with load balancing.

### 6.4 Workflow Builder

**Route:** `/admin/workflows/{id}/edit`

```
┌────────────────────────────────────────────────────────────┐
│  Workflow Builder: Dissertation Proposal                   │
│  Submission Type: Dissertation · Gated Review: ON         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  [+ Add Stage]                                            │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ≡  ① Gatekeeper Review                        [⋮] │     │
│  │     Role: gatekeeper · Parallel · Strategy: ALL  │     │
│  │     Due: 7 days · Escalate after: 2 days         │     │
│  │     [Edit]                                       │     │
│  └─────────────────────────────────────────────────┘     │
│         ↕ (drag to reorder)                               │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ≡  ② Committee Review                         [⋮] │     │
│  │     Role: committee · Parallel · Strategy: ALL   │     │
│  │     Due: 14 days · Escalate after: 3 days        │     │
│  │     [Edit]                                       │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  [Save Workflow]   [Discard Changes]                      │
│                                                           │
│  ⚠ Changing a workflow only affects new submissions.      │
│    Existing submissions continue on the current version.  │
└────────────────────────────────────────────────────────────┘
```

Clicking Edit on a stage opens a slide-over panel:

```
Stage Configuration
─────────────────────────────
Name               [Committee Review       ]
Role               [committee            ▾]
Execution Type     ● Parallel  ○ Sequential
Approval Strategy  ○ All  ● Any  ○ Majority
Min Approvals      [1  ]  (only shown for Majority)
Due Days           [14 ]
Is Anonymous       □ Hide reviewer names from each other

Visibility Rules
  Decisions visible to:     [admin,coordinator,gatekeeper ▾]
  Feedback visible to:      [admin,coordinator,gatekeeper ▾]
  Reviewer names visible to:[admin,coordinator ▾]
  Stage progress visible to:[admin,coordinator,submitter ▾]

Escalation
  □ Enable escalation
  Escalate after [3] days
  Action: ○ Notify Only  ● Reassign  ○ Add Approver
  Escalate to role: [coordinator ▾]

[Save Stage]
```

### 6.5 User Management

**Route:** `/admin/users`

Table columns: Name, Email, Roles (chips), Groups (chips), Active status, Last login, Actions  
Filters: Role, Group, Active/inactive, SSO-linked, No coordinator groups (warning filter)

**Warning badge:** Coordinators with zero group assignments get an orange ⚠ badge. A banner at the top of the page shows "N coordinator(s) have no group assignments" if any exist.

Actions:
- **Invite user** → opens invite dialog (name, email, roles, groups)
- **Create user** → opens create dialog (name, email, password, roles, groups)
- **Edit** → inline drawer: name, roles (multi-select chips), program
- **Manage groups** → popover showing group membership checkboxes
- **Manage coordinator scope** → shown only when user has coordinator role; popover with group checkboxes for `coordinator_group_assignments`
- **Deactivate / Reactivate** → toggle with confirmation
- **Reset password** → admin-sets new password (with show/hide toggle)
- **Resend invite** → shown only for `is_active = false` users
- **Unlock** → shown only for locked accounts (indicated by lock icon)

```
┌──────────────────────────────────────────────────────────────────┐
│  Users                    [Invite User]  [Create User]  🔍        │
├──────────────────────────────────────────────────────────────────┤
│  Filters: [All Roles ▾] [All Groups ▾] [Active ▾] [⚠ Issues ▾]  │
├──────────────────────────────────────────────────────────────────┤
│  ⚠ 2 coordinators have no group assignments — they see 0 submissions │
├──────────────────────────────────────────────────────────────────┤
│  Name            Email               Roles        Groups  Status  │
│  ─────────────────────────────────────────────────────────────── │
│  John Doe        john@uni.edu        [student]    [CS]    ● Active │
│  Jane Smith  ⚠  jane@uni.edu        [coordinator]  —     ● Active │
│  Bob Chen        bob@uni.edu         [reviewer]   [EE]   ● Active │
└──────────────────────────────────────────────────────────────────┘
```

**Invite / Create Dialog:**
```
Name    [                    ]
Email   [                    ]
Roles   [student ×] [+ Add Role]
Groups  [CS Dept ×] [+ Add Group]
Program [None ▾]

[ Cancel ]  [ Send Invite / Create User ]
```

**Coordinator Scope Dialog** (shown when editing a coordinator):
```
Coordinator Group Scope
──────────────────────────────────
These groups determine which submissions this coordinator can see and manage.

☑ Computer Science Department
☐ Electrical Engineering
☑ Business School

[ Save Scope ]
```

---

### 6.6 Group Management

**Route:** `/admin/groups`

Table: Name, Description, Member count, Active status, Actions

Actions:
- **Create group** → name + description
- **Edit** → inline name/description edit
- **View members** → side drawer listing users in this group with their roles; search within members
- **Deactivate** → sets `is_active = false`; coordinators scoped to this group lose visibility to its submissions

```
┌──────────────────────────────────────────────────────────┐
│  Groups                                    [+ New Group]  │
├──────────────────────────────────────────────────────────┤
│  Name                    Members   Active   Actions       │
│  ─────────────────────────────────────────────────────── │
│  Computer Science Dept   47        ● Yes    [Edit] [⋮]   │
│  Electrical Engineering  23        ● Yes    [Edit] [⋮]   │
│  Business School         31        ● Yes    [Edit] [⋮]   │
└──────────────────────────────────────────────────────────┘
```

### 6.6 Analytics Dashboard

**Route:** `/admin/analytics`

Grid of cards:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Total        │ │ In Review    │ │ Avg Review   │ │ Overdue      │
│ 142          │ │ 23           │ │ 8.3 days     │ │ 4 stages     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

[Bar chart: Submissions by month (current year)]
[Pie chart: By status distribution]
[Table: Reviewer workload — Name, Active, Completed 30d, Avg days]
```

Filters: Submission type, Program, Date range

### 6.7 Audit Log Viewer

**Route:** `/admin/audit-logs`

Table: Timestamp, Actor, Action (colored label), Submission, Details (expandable JSON)
- Filter by action, actor, date range, submission
- Cannot delete or modify (read-only UI)

---

## 7. System Configuration (Admin)

### 7.1 Organization Settings

**Route:** `/admin/system/organization`

```
┌────────────────────────────────────────────────────────────────┐
│  Organization Settings                                     │
├────────────────────────────────────────────────────────────────┤
│  Branding                                                  │
│  Organization Name *     [City University Research Portal  ] │
│  Short Name              [CityU Research                  ] │
│  Support Email           [research-support@cityu.edu.hk  ] │
│  Logo                    [🖼️ current-logo.png] [Upload New]   │
│  Favicon                 [🖼️ favicon.ico     ] [Upload New]   │
│  Primary Color           [#1E40AF] ███  [Pick Color]       │
│  Footer Text             [Textarea                       ] │
│                                                           │
│  Regional Settings                                        │
│  Timezone    [Asia/Hong_Kong ▾]                           │
│  Locale      [English (en) ▾]                             │
│  Date Format [DD/MM/YYYY ▾]                               │
│                                                           │
│  Public Registration                                      │
│  Default Group for public registrants  [Public Submitters ▾]  │
│  Default Role for public registrants   [student ▾]        │
│  (Required before enabling Public Registration feature flag)  │
│                                                           │
│  Data Retention                                           │
│  Archive accepted/rejected submissions after [365] days   │
│  Maximum file size (system cap): [10] MB                  │
│                                                           │
│  [Save Changes]                                           │
└────────────────────────────────────────────────────────────────┘
```

Logo preview shown in top bar immediately on save (no reload required). Color picker updates preview in top bar.

### 7.2 SSO Configuration

**Route:** `/admin/system/sso`

```
┌────────────────────────────────────────────────────────────────┐
│  Single Sign-On (SSO)                      [+ Add Provider] │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✔ ENABLED · DEFAULT                                   │   │
│  │ CityU Single Sign-On     SAML2                         │   │
│  │ Button: "Sign in with CityU Account"                  │   │
│  │ [Test Connection] [Edit] [Disable]                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                           │
│  ⚠ When SSO is enabled, local password login is still     │
│    available unless disabled via feature flags.           │
└────────────────────────────────────────────────────────────────┘
```

**Add/Edit SSO Provider Dialog** (tabbed by protocol):

- **SAML2 tab:** Entity ID, IdP SSO URL, IdP SLO URL (optional), IdP Certificate (PEM paste), Attribute Mapping (email field, name field, roles field), Want assertions signed toggle
- **OIDC tab:** Issuer URL (auto-discover toggle), Client ID, Client Secret, Scopes (multi-select), Claim Mapping
- **Common:** Provider name, Button label, Button icon upload, Auto-provision users toggle, Default role for new users

**SP Metadata Panel** (SAML2 only): shows the generated SP metadata XML with copy button and download link to provide to the IdP admin.

### 7.3 Email Configuration

**Route:** `/admin/system/email`

```
┌────────────────────────────────────────────────────────────────┐
│  Email Configuration                                       │
│  Status: ✔ Verified (test sent 2026-04-10)                 │
├────────────────────────────────────────────────────────────────┤
│  Driver    ● SMTP  ○ Amazon SES  ○ Mailgun  ○ Postmark     │
│                                                           │
│  Host      [smtp.office365.com                          ] │
│  Port      [587]  Encryption  ● TLS  ○ SSL  ○ None        │
│  Username  [noreply@university.edu                      ] │
│  Password  [••••••••••••                              ] │
│                                                           │
│  From Address [noreply@university.edu                   ] │
│  From Name    [University Research Portal               ] │
│  Reply-To     [research-support@university.edu          ] │
│                                                           │
│  [Save]   [Send Test Email → admin@university.edu]        │
└────────────────────────────────────────────────────────────────┘
```

### 7.4 Notification Templates

**Route:** `/admin/system/notification-templates`

List of all event types with status (enabled/disabled). Click to edit:

- Subject line with variable insertion helper (`{{variable}}` autocomplete)
- HTML body editor (rich text or raw HTML toggle)
- Plain text body
- Preview pane (renders with sample data)
- Test send button (sends to admin's email with sample data)

### 7.5 Security & Password Policy

**Route:** `/admin/system/security`

```
┌────────────────────────────────────────────────────────────────┐
│  Security & Password Policy                               │
├────────────────────────────────────────────────────────────────┤
│  Password Requirements                                    │
│  Minimum length          [12]                             │
│  ☑ Require uppercase letter                               │
│  ☑ Require number                                         │
│  ☑ Require special character                              │
│  Password expiry (days)  [__] leave blank = never         │
│  Password history        [5]  (cannot reuse last N)       │
│                                                           │
│  Account Lockout                                          │
│  Max failed attempts     [5]                              │
│  Lockout duration        [15] minutes                     │
│                                                           │
│  Sessions                                                 │
│  Session timeout         [480] minutes (0 = never)        │
│                                                           │
│  Two-Factor Authentication                                │
│  ▢ Require 2FA for all users  (TOTP / authenticator app)  │
│  ▢ Require 2FA for admin only                             │
│                                                           │
│  [Save Policy]                                            │
└────────────────────────────────────────────────────────────────┘
```

### 7.6 Feature Flags

**Route:** `/admin/system/features`

Toggle table:

| Feature | Status | Description |
|---|---|---|
| Appeals | ☑ Enabled | Allow students to appeal rejected submissions |
| Meetings | ☑ Enabled | Meeting scheduling per submission |
| SSO | ▢ Disabled | Single Sign-On login (configure in SSO tab first) |
| Two-Factor Auth | ▢ Disabled | TOTP 2FA for all users |
| Dark Mode | ☑ Enabled | Users can toggle dark mode |
| CSV Export | ☑ Enabled | Admin can export submissions to CSV |
| Reviewer Self-Assign | ▢ Disabled | Reviewers can pick up unassigned reviews |
| Co-Authors | ☑ Enabled | Submitters can add co-authors; feedback sent to all authors |
| Public Registration | ▢ Disabled | Anyone can self-register; requires default group to be configured in Organization settings first |

When **Public Registration** is toggled on without a default group configured, a warning banner appears:
```
⚠ You must set a Default Group for public registrants in Organization Settings before enabling this feature.
```

### 7.7 Backup & Archive

**Route:** `/admin/system/backup`

```
┌────────────────────────────────────────────────────────────────┐
│  Backup & Archive                                         │
├────────────────────────────────────────────────────────────────┤
│  Manual Backup                                            │
│  [Create Backup Now]                                      │
│  Last backup: 2026-04-15 02:00:00 UTC   ✔ Success         │
│                                                           │
│  Scheduled Backups (configured via server cron)           │
│  Daily database dump: 02:00 UTC                           │
│  Weekly full archive (DB + files): Sunday 03:00 UTC       │
│  Retention: [90] days                                     │
│                                                           │
│  Archive Policy                                           │
│  Auto-archive submissions with status ACCEPTED/REJECTED   │
│  after [365] days (configurable in Organization Settings) │
│  Archived submissions are read-only; files retained.      │
│                                                           │
│  Storage Usage                                            │
│  Database: 1.2 GB   Uploaded files: 8.4 GB   Total: 9.6 GB │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Shared Components

### 9.1 Stage Timeline

Reusable component used on Submission Detail, Gated Review Detail.

Props:
```typescript
stages: Array<{
  id: string;
  name: string;
  order: number;
  status: 'PENDING' | 'ACTIVE' | 'PASSED' | 'FAILED' | 'REVISION_REQUIRED' | 'SKIPPED';
  due_at?: string;
  started_at?: string;
  completed_at?: string;
}>
orientation: 'vertical' | 'horizontal'  // vertical=default, horizontal=mobile
```

### 9.2 Decision Badge

```typescript
<DecisionBadge status="IN_REVIEW" />
<DecisionBadge status="ACCEPTED" size="sm" />
```

Returns a pill-shaped badge with appropriate color (see §1.1).

### 9.3 Notification Dropdown

Triggered from bell icon in top bar. Shows last 10 notifications. Unread count badge on bell icon. "Mark all read" button. Link to full notifications page.

### 9.4 Confirmation Dialog

Used before irreversible actions (submit, withdraw, issue release, etc.)

```typescript
<ConfirmDialog
  title="Issue Formal Decision"
  description="This will notify the student and cannot be undone."
  confirmLabel="Issue Decision"
  variant="destructive"
  onConfirm={...}
/>
```

### 9.5 File Dropzone

```typescript
<FileDropzone
  accept={submissionType.allowed_extensions}
  maxSize={submissionType.max_file_size_mb * 1024 * 1024}
  maxFiles={submissionType.max_files}
  onUpload={(files) => ...}
/>
```

Shows progress bars. Validates extension + size client-side before upload.

---

## 10. Error States

| Scenario | UI Behavior |
|---|---|
| API 401 | Redirect to login, preserve intended URL |
| API 403 | Show "Not authorized" inline message |
| API 404 | Show 404 page with back button |
| API 422 | Show field-level validation errors inline |
| API 5xx | Show toast "Something went wrong. Please try again." |
| File upload fails | Per-file error indicator + retry button |
| WebSocket disconnected | Show "Live updates paused — reconnecting..." banner |

---

## 11. Mobile Considerations

- Sidebar collapses to bottom tab bar on mobile (5 tabs max)
- Stage timeline switches to horizontal scrollable on < 640px
- Tables become card lists on mobile
- Decision panel stacks below document on mobile
- All modals become full-screen sheets on mobile
