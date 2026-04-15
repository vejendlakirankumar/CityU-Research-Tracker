# Gated Review — Status Display Reference

Stages assumed throughout: **Chair Review** (stage 0 / gatekeeper) → **Committee Review** (stage 1) → **Program Director Approval** (stage 2, if configured).

---

## Part A — Submission Status String

The `status` field stored on the submission and shown as the dashboard badge.

| # | Workflow State | Status String |
|---|---|---|
| 1 | Submitted, no chair assigned yet | `Submitted` |
| 2 | Chair assigned, has not voted | `Chair Review: In Progress` |
| 3 | Chair voted **Needs Revision** (stage 0, not yet released) | `Revision Required` |
| 4 | Chair voted **Rejected** (stage 0) | `Rejected` |
| 5 | Student submitted revision → new round | `Chair Review: In Progress` *(decisions cleared, chair must re-review)* |
| 6 | Chair approved, committee not yet assigned | `Chair Review: Awaiting Higher Stage Review` |
| 7 | Committee assigned, reviewing (partial decisions) | `Committee Review: Under Review` |
| 8 | All committee decided, awaiting chair release | `Chair Review: Reviewing Committee Review Feedback` |
| 9 | Chair released **Approved** | `Approved` |
| 10 | Chair released **Conditionally Approved** | `Conditionally Approved` |
| 11 | Chair released **Revision Required** | `Revision Required` |
| 12 | Chair released **Rejected** | `Rejected` |
| 13 | Chair released Revision Required, student submitted revision | `Chair Review: In Progress` *(old release superseded)* |

---

## Part B — Student View

Decisions and feedback text are **always stripped** from the student's API response. Stage status is inferred from flags (`stageCompleted`, `gatekeeperNotifiedAt`) and `sub.status`.

| # | State | Student Dashboard Badge (colour) | Student — Inside Submission Stage Timeline | Decision Box shown? |
|---|---|---|---|---|
| 1 | No chair assigned | `Submitted` (grey) | Chair Review: **Pending** · Committee Review: **Pending** | No |
| 2 | Chair assigned, reviewing | `Chair Review: In Progress` (blue) | Chair Review: **Under Review** · Committee Review: **Pending** | No |
| 3 | Chair voted Needs Revision | `Revision Required` (amber) | Chair Review: **Revision Requested** · Committee Review: **Pending** | No — revision form shown |
| 4 | Chair voted Rejected | `Rejected` (red) | Chair Review: **Under Review** · Committee Review: **Pending** | No |
| 5 | Revision submitted | `Chair Review: In Progress` (blue) | Chair Review: **Under Review** · Committee Review: **Pending** | No |
| 6 | Chair approved, committee not assigned | `Chair Review: Awaiting Higher Stage Review` (blue) | Chair Review: **Forwarded to Higher Stage Review** · Committee Review: **Pending** | No |
| 7 | Committee reviewing | `Committee Review: Under Review` (blue) | Chair Review: **Forwarded to Higher Stage Review** · Committee Review: **Under Review** | No |
| 8 | All committee decided, awaiting release | `Chair Review: Reviewing Committee Review Feedback` (blue) | Chair Review: **Forwarded to Higher Stage Review** · Committee Review: **Review Complete — Awaiting Primary Reviewer** | No |
| 9 | Released: Approved | `Approved` (green) | Chair Review: **Forwarded to Higher Stage Review** · Committee Review: **Review Complete — Awaiting Primary Reviewer** | Yes — **Approved** (green) |
| 10 | Released: Conditionally Approved | `Conditionally Approved` (green) | same as row 9 | Yes — **Conditionally Approved** (green) |
| 11 | Released: Revision Required | `Revision Required` (amber) | same as row 9 | Yes — **Revision Required** (amber) + revision form shown |
| 12 | Released: Rejected | `Rejected` (red) | same as row 9 | Yes — **Rejected** (red) |
| 13 | Revision submitted after release | `Chair Review: In Progress` (blue) | Chair Review: **Under Review** · Committee Review: **Pending** *(decisions cleared)* | No |

---

## Part C — Chair (Gatekeeper) View

The chair sees **all stages** with real reviewer names, decisions, and feedback. Stage 0 label is overridden to reflect the gated-review state.

| # | State | Chair Dashboard Badge (colour) | Chair — Inside Submission Stage Timeline |
|---|---|---|---|
| 1 | Not yet assigned | Not on their list | — |
| 2 | Assigned, has not voted | `Chair Review: In Progress` + ⚠ Action Required (amber) | Chair Review: **In Progress** · Committee Review: **Not Started** |
| 3 | Chair voted Needs Revision | `Needs Revision` — own decision (amber) | Chair Review: **Revision Requested** · Committee Review: **Not Started** |
| 4 | Chair voted Rejected | `Rejected` — own decision (red) | Chair Review: **In Progress** · Committee Review: **Not Started** |
| 5 | Revision submitted | `Chair Review: In Progress` + ⚠ Action Required | Chair Review: **In Progress** · Committee Review: **Not Started** |
| 6 | Chair approved, committee not assigned | `Approved` — own vote (green) | Chair Review: **✓ Forwarded to Higher Stage Review** · Committee Review: **Not Started** |
| 7 | Committee reviewing (partial decisions) | `Approved` — own vote (green) | Chair Review: **✓ Forwarded to Higher Stage Review** · Committee Review: **In Progress** |
| 8 | All committee decided | submission status (amber) + ⚠ Action Required | Chair Review: **⏳ Reviewing Higher Stage Feedback** · Committee Review: **✓ Approved** *(or **Revision Requested** if any voted Needs Revision)* |
| 9 | Released: Approved | `Approved` — own vote (green) | Chair Review: **✓ Decision Released** · Committee Review: **✓ Approved** |
| 10 | Released: Conditionally Approved | `Approved` — own vote (green) | Chair Review: **✓ Decision Released** · Committee Review: **✓ Approved** |
| 11 | Released: Revision Required | `Approved` — own vote (green) | Chair Review: **✓ Decision Released** · Committee Review: **✓ Approved** |
| 12 | Released: Rejected | `Approved` — own vote (green) | Chair Review: **✓ Decision Released** · Committee Review: **✓ Approved** |
| 13 | Revision submitted after release | `Chair Review: In Progress` + ⚠ Action Required | Chair Review: **In Progress** · Committee Review: **Not Started** |

> **Note:** The chair's dashboard badge always reflects their *own personal vote* (stage 0 decision). The submission status is shown separately as a secondary indicator / ⚠ Action Required badge when action is needed.

---

## Part D — Committee Reviewer View

Committee reviewers see **only their own stage**. Stage 0 reviewer names and decisions are hidden.

| # | State | Committee Dashboard Badge (colour) | Committee — Inside Submission |
|---|---|---|---|
| 1–5 | Not yet assigned (stage 0 still active) | Not on their list | — |
| 6 | Assigned, no decision recorded | submission status + ⚠ Action Required | Their stage: **In Progress** · decision form shown |
| 7 | Has voted, others still pending | Own decision (e.g. `Approved`, green) | Their stage: **In Progress** |
| 8 | All committee decided | Own decision (e.g. `Approved`) | Their stage: **In Progress** *(no change visible to them)* |
| 11 (re-check) | Re-check requested, decisions cleared | submission status + ⚠ Action Required | Their stage: **In Progress** · decision form re-enabled |

---

## Colour Key

| Badge class | Meaning | Colour |
|---|---|---|
| `rrp-dec-approved` | Approved / Conditionally Approved | Green |
| `rrp-dec-rejected` | Rejected | Red |
| `rrp-dec-revision` | Revision Required / Needs Revision / Action Required | Amber |
| `rrp-dec-inreview` | Any "In Progress" / "Under Review" state | Blue |
| `rrp-dec-submitted` | Submitted (initial) | Teal |
| `rrp-dec-pending` | Pending / not yet assessed | Grey |
| `rrp-dec-withdrawn` | Withdrawn / Cancelled | Light grey |
