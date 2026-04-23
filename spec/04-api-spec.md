# v2 — API Specification

Base URL: `/api/v2`  
Auth: All endpoints require `Authorization: Bearer <token>` unless marked `[PUBLIC]`  
Content-Type: `application/json`  
Error format: `{ "message": "...", "errors": { "field": ["msg"] } }`

---

## Role Abbreviations

| Abbrev | Role |
|---|---|
| ADM | admin |
| CRD | coordinator |
| RVW | reviewer — any user with an active `stage_assignment` for the relevant stage |
| STU | student / submitter |
| OWN | the submitter of that specific submission |

> Stage-level labels (Chair, Committee Member, Program Director, etc.) are configured
> per workflow stage and are **not** global roles. Authorization for stage-specific
> actions (submit decision, issue gated release) is enforced via `stage_assignments`.

---

## 1. Authentication

### `POST /auth/login` [PUBLIC]
```json
Request:  { "email": "string", "password": "string" }
Response: {
  "token": "string",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "roles": ["student"],
    "program_id": "uuid|null"
  }
}
```
Errors: `401` invalid credentials, `429` rate limited (10/min)

### `POST /auth/register` [PUBLIC — only when `enable_public_registration` flag is on]

```json
Request: {
  "name": "string",
  "email": "string",
  "password": "string",
  "password_confirmation": "string",
  "invite_token": "string|null"
  // When invite_token is provided, the new account is linked to the pending co-author
  // invitation in submission_authors. Token must not be expired.
}
Response: 201 {
  "token": "string",
  "user": { "id": "uuid", "name": "string", "email": "string", "roles": ["student"] }
}
```
Errors: `422` validation, `409` email already registered, `429` rate limited (5/IP/15min), `403` public registration disabled.

---

### `POST /auth/logout`
Revokes current token.
```json
Response: { "message": "Logged out" }
```

### `GET /auth/me`
```json
Response: {
  "id": "uuid", "name": "string", "email": "string",
  "roles": ["string"],
  "program": { "id": "uuid", "name": "string" } | null,
  "unread_notification_count": 5
}
```

### `PATCH /auth/password`
```json
Request:  { "current_password": "string", "password": "string", "password_confirmation": "string" }
Response: { "message": "Password updated" }
```

---

## 2. Submissions

### `GET /submissions`

Roles: ALL (filtered by role)
- STU: own submissions only
- CMT: submissions they are assigned to review
- CHR: all submissions for their gated submission types
- ADM/CRD: all submissions

Query params:
- `status` — filter by status value
- `submission_type_id` — filter by type
- `program_id` — filter by program
- `search` — title search (ILIKE)
- `per_page` — default 20, max 100
- `page`
- `sort` — `created_at` | `updated_at` | `title` | `status` (prefix `-` for DESC)

```json
Response: {
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "status": "IN_REVIEW",
      "submission_type": { "id": "uuid", "slug": "string", "label": "string" },
      "current_version": 2,
      "submitter": { "id": "uuid", "name": "string" },
      "program": { "id": "uuid", "name": "string" } | null,
      "current_stage": {
        "name": "string",
        "order": 2,
        "status": "ACTIVE",
        "due_at": "2026-03-01T00:00:00Z"
      } | null,
      "created_at": "iso8601",
      "updated_at": "iso8601"
    }
  ],
  "meta": { "total": 42, "page": 1, "per_page": 20, "last_page": 3 }
}
```

### `POST /submissions`

Roles: STU
```json
Request: {
  "submission_type_id": "uuid",
  "program_id": "uuid",
  "title": "string",
  "abstract": "string",
  "metadata": {}
}
Response: 201 { "data": <Submission> }
```

### `GET /submissions/{id}`

Roles: ALL (response filtered by VisibilityService)

```json
Response: {
  "data": {
    "id": "uuid",
    "title": "string",
    "abstract": "string",
    "status": "IN_REVIEW",
    "submission_type": { ... },
    "current_version": 2,
    "submitter": { "id": "uuid", "name": "string" },
    "program": { ... } | null,
    "metadata": {},

    "versions": [
      {
        "version_number": 2,
        "document_paths": ["uploads/uuid/file.pdf"],
        "change_summary": "Revised methodology section",
        "submitted_at": "iso8601"
      }
    ],

    "workflow_run": {
      "id": "uuid",
      "status": "ACTIVE",
      "version_number": 2,
      "stages": [
        {
          "id": "uuid",
          "name": "Gatekeeper Review",
          "order": 1,
          "status": "PASSED",
          "started_at": "iso8601",
          "completed_at": "iso8601",
          "due_at": "iso8601",
          "decisions": [ ... ],       // null if viewer lacks visibility
          "reviewers": [ ... ],        // anonymized if viewer lacks visibility
          "pending_release": false
        },
        {
          "id": "uuid",
          "name": "Committee Review",
          "order": 2,
          "status": "ACTIVE",
          "due_at": "iso8601",
          "decisions": null,           // STU cannot see committee decisions
          "reviewers": null,
          "my_decision": null          // only present for assigned reviewer
        }
      ]
    },

    "gated_releases": [
      {
        "version_number": 1,
        "decision": "REVISION_REQUIRED",
        "feedback": "string",
        "released_by": { "name": "string" },
        "released_at": "iso8601"
      }
    ],

    "authors": [
      {
        "id": "uuid",
        "role": "submitter",
        "user": { "id": "uuid", "name": "string", "email": "string" },
        "added_at": "iso8601"
      },
      {
        "id": "uuid",
        "role": "co_author",
        "user": { "id": "uuid", "name": "string", "email": "string" } | null,
        "invited_email": "string|null",   // shown when invite pending (not yet registered)
        "invite_pending": true,
        "added_at": "iso8601"
      }
    ],
    // authors[] is only returned to: submitter, co-authors, admin, coordinator
    // not returned to reviewers (blind review integrity)

    "meetings": [ { "id": "uuid", "title": "string", "scheduled_at": "iso8601" } ],

    "can": {
      "submit_version": true,
      "withdraw": true,
      "appeal": false,
      "issue_release": false,
      "assign_reviewers": false
    }
  }
}
```

### `PATCH /submissions/{id}`

Roles: OWN (DRAFT only) | ADM | CRD
```json
Request: { "title": "string", "abstract": "string", "metadata": {} }
Response: { "data": <Submission> }
```

### `POST /submissions/{id}/versions`

Roles: OWN (status must be REVISION_REQUIRED or DRAFT)

Multipart form:
```
files[]      — uploaded file(s)
change_summary — string
```
```json
Response: 201 {
  "data": {
    "submission": <Submission>,
    "version": { "version_number": 3, "document_paths": [...], "submitted_at": "..." }
  }
}
```
Triggers `WorkflowEngine::handleRevisionSubmitted()` if resubmitting (status = REVISION_REQUIRED).

### `POST /submissions/{id}/withdraw`

Roles: OWN (status must be DRAFT | SUBMITTED | REVISION_REQUIRED)
```json
Request: { "reason": "string" }
Response: { "data": <Submission> }
```

### `POST /submissions/{id}/cancel`

Roles: ADM | CRD
```json
Request: { "reason": "string" }
Response: { "data": <Submission> }
```

---

### `GET /submissions/{id}/authors`

Roles: OWN (submitter) | co-authors of this submission | ADM | CRD

Returns the full authors list for the submission.

```json
Response: {
  "data": [
    {
      "id": "uuid",
      "role": "submitter",
      "user": { "id": "uuid", "name": "string", "email": "string" },
      "invite_pending": false,
      "added_at": "iso8601"
    },
    {
      "id": "uuid",
      "role": "co_author",
      "user": { "id": "uuid", "name": "string", "email": "string" },
      "invite_pending": false,
      "added_at": "iso8601"
    },
    {
      "id": "uuid",
      "role": "co_author",
      "user": null,
      "invited_email": "pending@example.com",
      "invite_pending": true,
      "invite_expires_at": "iso8601",
      "added_at": "iso8601"
    }
  ]
}
```

---

### `POST /submissions/{id}/authors`

Roles: OWN (submitter only, not co-authors)  
Requires `enable_co_authors` flag to be `true`.

Add a registered user as co-author.

```json
Request:  { "email": "string" }
Response: 201 { "data": <AuthorRow> }
```
Errors: `404` user not found by email, `409` already an author on this submission, `422` submission status does not allow author changes (only allowed in DRAFT/SUBMITTED/IN_REVIEW/REVISION_REQUIRED).

---

### `POST /submissions/{id}/authors/invite`

Roles: OWN (submitter only)  
Requires `enable_co_authors` flag to be `true`.

Invite an unregistered user to register and become a co-author.

```json
Request:  { "email": "string", "name": "string" }
Response: 201 {
  "data": {
    "id": "uuid",
    "role": "co_author",
    "invited_email": "string",
    "invite_pending": true,
    "invite_expires_at": "iso8601"
  },
  "message": "Invitation email sent to pending@example.com"
}
```
Errors: `409` email already registered (use `POST /authors` instead), `409` already invited, `422` invalid email.

---

### `DELETE /submissions/{id}/authors/{author_id}`

Roles: OWN (submitter only)

Remove a co-author or cancel a pending invitation. Cannot remove `role = 'submitter'` row.

```json
Response: { "message": "Author removed" }
```
Errors: `403` attempt to remove submitter row, `404` not found.

---

### `POST /submissions/{id}/authors/invite/resend`

Roles: OWN

Resend the invitation email for a pending co-author invite. Resets the 72h expiry.

```json
Request:  { "author_id": "uuid" }
Response: { "message": "Invitation resent" }
```
Errors: `404` not found, `422` invite not pending.

---

## 3. Reviewer Assignment

### `GET /submissions/{id}/assignable-reviewers`

Roles: ADM | CRD | CHR

Returns users available to be assigned to a specific stage.
```
Query: stage_instance_id=uuid
```
```json
Response: {
  "data": [
    { "id": "uuid", "name": "string", "roles": [...], "current_workload": 3 }
  ]
}
```

### `POST /submissions/{id}/assign-reviewers`

Roles: ADM | CRD
```json
Request: {
  "stage_instance_id": "uuid",
  "user_ids": ["uuid", "uuid"]
}
Response: { "data": <StageInstance with assignments> }
```
Triggers stage activation + reviewer notifications if stage is PENDING.

### `DELETE /submissions/{id}/stage-assignments/{assignment_id}`

Roles: ADM | CRD
Removes a reviewer from a stage. Only allowed if they have not yet submitted a decision.
```json
Response: 204
```

---

## 4. Decisions

### `POST /decisions`

Roles: RVW (must have active `stage_assignment` for the `stage_instance_id`)
```json
Request: {
  "stage_instance_id": "uuid",
  "decision": "APPROVE | REQUEST_CHANGES | REJECT",
  "comments": "string"
}
Response: 201 {
  "data": {
    "id": "uuid",
    "stage_instance_id": "uuid",
    "decision": "APPROVE",
    "submitted_at": "iso8601"
  },
  "meta": {
    "evaluation_result": "PASSED | PENDING | REVISION_REQUIRED | FAILED",
    "stage_advanced": true
  }
}
```
After creation, triggers `StageEvaluator::evaluate()` and `WorkflowEngine::advanceStage()` if needed.

### `GET /decisions`

Roles: ADM | CRD
Query: `submission_id`, `stage_instance_id`, `reviewer_id`
```json
Response: { "data": [ <ReviewDecision> ] }
```

---

## 5. Gated Releases

### `GET /gated-reviews`

Roles: RVW (gatekeeper stage) | ADM | CRD
Returns submissions where the viewer has a `stage_assignment` on a stage with `is_gatekeeper = true` and `pending_release = true`, or all such submissions for ADM/CRD.
```json
Response: {
  "data": [
    {
      "submission": { "id": "uuid", "title": "string", "status": "IN_REVIEW" },
      "workflow_run": { "id": "uuid", "version_number": 2 },
      "gatekeeper_stage": { "id": "uuid", "status": "PASSED" },
      "higher_stages": [
        { "name": "Committee", "status": "PASSED", "decision_summary": { "approve": 2, "total": 3 } }
      ],
      "all_stages_complete": true
    }
  ]
}
```

### `GET /gated-reviews/{submission_id}`

Full view with all stage decisions visible to gatekeeper.
Response: same as `GET /submissions/{id}` but with gatekeeper-level visibility.

### `POST /gated-releases`

Roles: RVW (must have active `stage_assignment` on the `is_gatekeeper = true` stage for this run)
```json
Request: {
  "workflow_run_id": "uuid",
  "decision": "ACCEPTED | CONDITIONALLY_ACCEPTED | REVISION_REQUIRED | REJECTED",
  "feedback": "string"
}
Response: 201 {
  "data": {
    "id": "uuid",
    "decision": "ACCEPTED",
    "feedback": "string",
    "released_at": "iso8601",
    "submission_status": "ACCEPTED"
  }
}
```

### `POST /gated-reviews/{submission_id}/recheck`

Roles: RVW (gatekeeper stage assignment required)
Request a higher stage to be re-reviewed.
```json
Request: { "stage_instance_id": "uuid", "reason": "string" }
Response: { "data": <StageInstance> }
```

---

## 6. Stage Management (Admin)

### `POST /stage-instances/{id}/skip`

Roles: ADM | CRD
```json
Request: { "reason": "string" }
Response: { "data": <StageInstance> }
```

### `POST /stage-instances/{id}/extend-deadline`

Roles: ADM | CRD
```json
Request: { "new_due_at": "iso8601", "reason": "string" }
Response: { "data": <StageInstance> }
```

---

## 7. Workflow Definitions (Admin)

### `GET /workflow-definitions`

Roles: ADM | CRD
```json
Response: { "data": [ <WorkflowDefinition with stage_definitions> ] }
```

### `POST /workflow-definitions`

Roles: ADM
```json
Request: {
  "submission_type_id": "uuid",
  "name": "string",
  "gatekeeper_stage_order": 1,
  "revision_restart_policy": "FULL_RESTART | FAILED_STAGE_RESTART",
  "final_status_on_pass": "ACCEPTED",
  "stages": [
    {
      "name": "Gatekeeper Review",
      "order": 1,
      "role": "gatekeeper",
      "execution_type": "PARALLEL",
      "approval_strategy": "ALL",
      "min_approvals": 1,
      "is_anonymous": false,
      "due_days": 7,
      "visibility_config": {
        "decisions_visible_to": ["admin","coordinator","gatekeeper"],
        "feedback_visible_to": ["admin","coordinator","gatekeeper"],
        "reviewer_names_visible_to": ["admin","coordinator","gatekeeper"],
        "stage_progress_visible_to": ["admin","coordinator","gatekeeper","submitter"]
      },
      "escalation_config": {
        "enabled": true,
        "escalate_after_days": 2,
        "action": "NOTIFY_ONLY",
        "escalate_to_role": "coordinator"
      }
    }
  ]
}
Response: 201 { "data": <WorkflowDefinition> }
```

### `PUT /workflow-definitions/{id}`

Roles: ADM
Same body as POST. Returns 409 if the workflow has active runs (cannot modify live workflow).

### `GET /stage-definitions/{id}`
### `PATCH /stage-definitions/{id}`
Roles: ADM — update individual stage config

---

## 8. Submission Types (Admin)

### `GET /submission-types`
### `POST /submission-types`
### `PATCH /submission-types/{id}`

Roles: ADM

```json
Request (POST/PATCH): {
  "slug": "dissertation-proposal",
  "label": "Dissertation Proposal",
  "description": "string",
  "is_gated_review": true,
  "is_blind_review": false,
  "allow_meetings": true,
  "max_file_size_mb": 8,
  "allowed_extensions": ["pdf","docx"],
  "max_files": 5
}
```

---

## 9. Users (Admin)

> Full permission matrix and lifecycle flows: [08-user-management.md](08-user-management.md)
>
> **Coordinator restriction:** Coordinators (CRD) do NOT have access to any endpoint in this section. CRD may call `GET /groups/{id}/members` (§10) to look up users within their assigned groups for reviewer-pool purposes only.

### `GET /users`

Roles: ADM  
Query: `role`, `group_id`, `search`, `is_active`, `has_sso`, `no_coordinator_groups`, `per_page` (max 100), `sort`, `order`

```json
Response: {
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "roles": ["coordinator"],
      "is_active": true,
      "last_login_at": "iso8601|null",
      "groups": [{ "id": "uuid", "name": "string" }],
      "coordinator_groups": [{ "id": "uuid", "name": "string" }],
      "sso_linked": false,
      "is_sso_only": false
    }
  ],
  "meta": { "total": 120, "per_page": 25, "current_page": 1 }
}
```

### `POST /users`

Roles: ADM
```json
Request: {
  "email": "string",
  "name": "string",
  "password": "string",
  "roles": ["student"],
  "group_ids": ["uuid"],
  "program_id": "uuid|null",
  "send_welcome_email": true
}
Response: 201 { "data": <User> }
```

### `POST /users/invite`

Roles: ADM
```json
Request: {
  "email": "string",
  "name": "string",
  "roles": ["reviewer"],
  "group_ids": [],
  "program_id": "uuid|null"
}
Response: 201 { "data": <User>, "message": "Invite sent" }
```
User is created with `is_active = false`. Invite link expires in 72 hours.

### `PATCH /users/{id}`

Roles: ADM  
Editable: `name`, `roles[]`, `program_id`, `is_active`

### `DELETE /users/{id}` → soft delete (`is_active = false`)

Roles: ADM

### `POST /users/{id}/reset-password`

Roles: ADM
```json
Request: { "new_password": "string" }
Response: { "success": true }
```
Invalidates all existing Sanctum tokens for the user.

### `POST /users/{id}/unlock`

Roles: ADM  
Clears Redis login-attempt lockout for the user. No request body.

### `POST /users/{id}/resend-invite`

Roles: ADM  
Regenerates invite token (+72h). Only valid for `is_active = false` users.

### `POST /users/{id}/link-sso`

Roles: ADM
```json
Request: { "provider_id": "uuid", "external_id": "string" }
Response: { "success": true }
```

### `GET /users/{id}/groups`
### `POST /users/{id}/groups`

Roles: ADM
```json
POST Request: { "group_ids": ["uuid"] }
Response: 200 { "data": <User with updated groups> }
```

### `DELETE /users/{id}/groups/{group_id}`

Roles: ADM

### `GET /users/{id}/coordinator-groups`
### `POST /users/{id}/coordinator-groups`

Roles: ADM  
Returns 422 if user does not have `coordinator` role.
```json
POST Request: { "group_ids": ["uuid"] }
Response: 200 { "data": { "coordinator_groups": [{ "id": "uuid", "name": "string" }] } }
```

### `DELETE /users/{id}/coordinator-groups/{group_id}`

Roles: ADM

---

## 10. Groups (Admin)

### `GET /groups`

Roles: ADM  
Query: `search`, `is_active`

```json
Response: {
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string|null",
      "is_active": true,
      "member_count": 14
    }
  ]
}
```

### `POST /groups`

Roles: ADM
```json
Request: { "name": "string", "description": "string|null" }
Response: 201 { "data": <Group> }
```

### `PATCH /groups/{id}`

Roles: ADM  
Editable: `name`, `description`, `is_active`

### `GET /groups/{id}/members`

Roles: ADM  
Returns users whose `user_groups` membership includes this group. Used by admins and (read-only) for reviewer lookup.

### `GET /reviewer-pools`
### `POST /reviewer-pools`
### `DELETE /reviewer-pools/{id}`

Roles: ADM | CRD  
Manage reviewer pool membership per submission type.

---

## 11. Programs

---

## 11. Notifications

### `GET /notifications`

```json
Query: read=true|false, per_page=20
Response: {
  "data": [
    {
      "id": "uuid",
      "type": "stage_completed",
      "data": { "submission_id": "uuid", "submission_title": "string", "stage_name": "string" },
      "read_at": null,
      "created_at": "iso8601"
    }
  ],
  "meta": { "unread_count": 5 }
}
```

### `POST /notifications/mark-read`

```json
Request: { "ids": ["uuid"] }  // empty array = mark all read
Response: { "data": { "marked": 5 } }
```

### `GET /notification-preferences`
### `PATCH /notification-preferences`

```json
Request: {
  "email": { "reviewer_assigned": true, "stage_completed": true, ... },
  "in_app": { "reviewer_assigned": true, "stage_completed": true, ... }
}
```

---

## 12. Meetings

### `GET /submissions/{id}/meetings`
### `POST /submissions/{id}/meetings`
```json
Request: {
  "title": "string",
  "scheduled_at": "iso8601",
  "duration_min": 60,
  "location": "string",
  "attendees": ["uuid"]
}
```
### `PATCH /submissions/{id}/meetings/{meetingId}`
### `DELETE /submissions/{id}/meetings/{meetingId}`

---

## 13. Appeals

### `POST /submissions/{id}/appeals`

Roles: OWN (status must be REJECTED | APPEAL_PENDING)
```json
Request: { "grounds": "string" }
Response: 201 { "data": <AppealRequest> }
```

### `GET /appeals`

Roles: ADM | CRD
```json
Response: { "data": [ <AppealRequest with submission summary> ] }
```

### `PATCH /appeals/{id}`

Roles: ADM
```json
Request: {
  "status": "UPHELD | DISMISSED",
  "resolution_note": "string"
}
```

---

## 14. File Downloads

### `GET /files/{path}`

Roles: assigned reviewer or submitter or admin (enforced by middleware)
Streams file from storage. `path` is relative path stored in `submission_versions.document_paths`.

---

## 15. Analytics (Admin)

### `GET /analytics/overview`
```json
Response: {
  "submissions_by_status": { "IN_REVIEW": 12, "ACCEPTED": 45, ... },
  "avg_review_days": 8.3,
  "overdue_stages_count": 4,
  "submissions_this_month": 7
}
```

### `GET /analytics/turnaround`
```json
Query: from=date, to=date, submission_type_id=uuid
Response: { "data": [ { "month": "2026-01", "avg_days": 12.5, "count": 8 } ] }
```

### `GET /analytics/reviewer-load`
```json
Response: { "data": [ { "user": { ... }, "active_reviews": 3, "completed_30d": 8, "avg_days": 5.2 } ] }
```

---

## 16. Audit Logs (Admin)

### `GET /audit-logs`

Roles: ADM
```json
Query: submission_id, actor_id, action, from, to, per_page
Response: { "data": [ { "id": "uuid", "action": "string", "actor": { ... }, "data": {}, "created_at": "iso8601" } ] }
```

---

## 17. System Configuration (Admin)

### `GET /system/organization`

Roles: ADM | CRD (read) — returns org_settings row
```json
Response: {
  "data": {
    "org_name": "string",
    "org_short_name": "string",
    "logo_url": "string",
    "primary_color": "#1E40AF",
    "timezone": "Asia/Hong_Kong",
    "locale": "en",
    "support_email": "string",
    "archive_after_days": 365
  }
}
```

### `PATCH /system/organization`

Roles: ADM
```json
Request: { "org_name": "...", "primary_color": "#1E40AF", "timezone": "...", ... }
```
Logo/favicon upload via `POST /system/organization/logo` (multipart, image only).

### `GET /system/password-policy`
### `PATCH /system/password-policy`

Roles: ADM
```json
Request: {
  "min_length": 12,
  "require_uppercase": true,
  "require_number": true,
  "require_special": true,
  "expiry_days": null,
  "history_count": 5,
  "max_login_attempts": 5,
  "lockout_duration_minutes": 15,
  "session_timeout_minutes": 480,
  "require_2fa": false
}
```

### `GET /system/email`
### `PATCH /system/email`

Roles: ADM
```json
Request: {
  "driver": "smtp",
  "host": "smtp.office365.com",
  "port": 587,
  "encryption": "tls",
  "username": "noreply@university.edu",
  "password": "plaintext",   // stored encrypted in DB
  "from_address": "noreply@university.edu",
  "from_name": "Research Portal"
}
```

### `POST /system/email/test`

Roles: ADM
Sends a test email to the admin's address. Returns `is_verified: true` on success.

### `GET /system/sso`

Roles: ADM
Returns list of SSO providers (secrets masked).

### `POST /system/sso`

Roles: ADM
```json
Request: {
  "name": "CityU Single Sign-On",
  "protocol": "SAML2",
  "is_enabled": true,
  "is_default": true,
  "button_label": "Sign in with CityU Account",
  "config": {
    "entity_id": "https://research.university.edu/sso/saml",
    "sso_url": "https://sso.university.edu/saml2/idp",
    "idp_certificate": "-----BEGIN CERTIFICATE-----...",
    "attribute_mapping": {
      "email": "urn:oid:1.2.840.113549.1.9.1",
      "name": "urn:oid:2.5.4.3",
      "roles": "memberOf"
    }
  },
  "auto_provision_users": true,
  "default_role": "student"
}
```

### `PATCH /system/sso/{id}`
### `DELETE /system/sso/{id}`

Roles: ADM

### `POST /system/sso/{id}/test`

Roles: ADM — validates IdP connectivity and metadata parsing.

### `GET /system/notification-templates`
### `PATCH /system/notification-templates/{event_type}`

Roles: ADM
```json
Request: { "subject": "string", "body_html": "string", "body_text": "string", "is_active": true }
```

### `GET /system/feature-flags`
### `PATCH /system/feature-flags/{key}`

Roles: ADM
```json
Request: { "value": true }
```

### `POST /system/backup`

Roles: ADM
Triggers an on-demand database dump + file archive. Returns `{ "job_id": "uuid" }` for status polling.

### `GET /system/backup/status/{job_id}`

Roles: ADM

---

## HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | No content (DELETE) |
| `400` | Bad request / validation error |
| `401` | Not authenticated |
| `403` | Not authorized (role/policy check failed) |
| `404` | Resource not found |
| `409` | Conflict (e.g., workflow has active runs) |
| `422` | Unprocessable entity (business rule violation) |
| `429` | Rate limited |
| `500` | Server error |

---

## WebSocket Events (Laravel Reverb)

| Channel | Event | Payload |
|---|---|---|
| `private-submission.{id}` | `StageUpdated` | `{ stage_id, new_status, updated_at }` |
| `private-submission.{id}` | `DecisionSubmitted` | `{ stage_id, evaluation_result }` |
| `private-submission.{id}` | `GatedReleaseIssued` | `{ decision, submission_status }` |
| `private-user.{id}` | `NotificationReceived` | `{ id, type, data, created_at }` |
| `private-user.{id}` | `ReviewTaskAssigned` | `{ submission_id, submission_title, stage_name, due_at }` |
