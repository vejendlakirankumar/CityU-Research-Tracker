# v2 — Data Model

All tables use PostgreSQL 16. UUIDs for primary keys (no sequential ID enumeration). `created_at` / `updated_at` on every table via Laravel timestamps.

---

## Entity Relationship Summary

```
users
 └─▶ submissions (submitter_id)
 └─▶ submission_authors (user_id)   ← co-authors
 └─▶ review_decisions (reviewer_id)
 └─▶ gated_releases (released_by)
 └─▶ user_groups (user_id)                         ← group membership
 └─▶ coordinator_group_assignments (coordinator_id) ← coordinator scope
 └─▶ sso_identities (user_id)                      ← linked SSO accounts

programs
 └─▶ submissions (program_id)

submission_types
 └─▶ workflow_definitions (submission_type_id)
 └─▶ submissions (submission_type_id)

workflow_definitions
 └─▶ stage_definitions (workflow_id)

submissions
 └─▶ submission_authors (submission_id)  ← co-authors join table
 └─▶ submission_versions (submission_id)
 └─▶ workflow_runs (submission_id)
 └─▶ gated_releases (submission_id)
 └─▶ audit_logs (submission_id)
 └─▶ notifications (via submission_id in data JSON)

workflow_runs
 └─▶ stage_instances (workflow_run_id)

stage_definitions
 └─▶ stage_instances (stage_definition_id)

stage_instances
 └─▶ stage_assignments (stage_instance_id)
 └─▶ review_decisions (stage_instance_id)
 └─▶ escalation_logs (stage_instance_id)

users ──▶ stage_assignments ◀── stage_instances

groups
 └─▶ organization_settings (public_submission_default_group_id)  ← public registration default
 └─▶ user_groups (group_id)
 └─▶ coordinator_group_assignments (group_id)
 └─▶ sso_providers (default_group_id)             ← auto-provision default

sso_providers
 └─▶ sso_identities (provider_id)
```

---

## Table Definitions

---

### `users`

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    name          VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),           -- NULL for SSO-only users
    roles         TEXT[] NOT NULL DEFAULT '{}',
    -- Core global roles: 'admin' | 'coordinator' | 'reviewer' | 'student'
    -- Stage-level labels (Chair, Committee Member, Program Director, IRB Reviewer, etc.)
    -- are configured in stage_definitions.stage_role_label — they are NOT global roles.
    -- A user with role 'reviewer' may be assigned to any stage regardless of its label.
    program_id    UUID REFERENCES programs(id) ON DELETE SET NULL,
    sso_only      BOOLEAN NOT NULL DEFAULT false, -- true = no local password login allowed
    invite_token             VARCHAR(128) UNIQUE,
    invite_token_expires_at  TIMESTAMPTZ,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_roles  ON users USING GIN(roles);
```

Notes:
- Roles are global defaults; a user's effective role on a submission is computed from `stage_assignments`.
- A coordinator might also be a student — multiple roles allowed.
- `password_hash` is nullable — SSO-only users have no local password.

---

### `sso_identities`

Links a local user account to an external SSO identity. One user may be linked to multiple providers.

```sql
CREATE TABLE sso_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id     UUID NOT NULL REFERENCES sso_providers(id),
    external_id     VARCHAR(512) NOT NULL,  -- subject/nameID from IdP
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ,
    UNIQUE (provider_id, external_id)
);

CREATE INDEX idx_sso_identities_user ON sso_identities(user_id);
```

---

### `user_groups`

Group membership for regular users (students/researchers/reviewers). Managed by admin only.

```sql
CREATE TABLE user_groups (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_user_groups_group ON user_groups(group_id);
```

---

### `coordinator_group_assignments`

Defines which groups each coordinator is **responsible for** (their visibility scope). Entirely separate from group membership (`user_groups`). Managed by admin only.

```sql
CREATE TABLE coordinator_group_assignments (
    coordinator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (coordinator_id, group_id)
);

CREATE INDEX idx_cga_group ON coordinator_group_assignments(group_id);
```

A coordinator with zero rows in this table sees **no submissions** — this is intentional safe-fail behaviour.

---

### `programs`

```sql
CREATE TABLE programs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    school            VARCHAR(255) NOT NULL,
    program_director_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id          UUID REFERENCES groups(id) ON DELETE SET NULL,
    -- Optional: link program to a department/faculty group
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `submission_types`

```sql
CREATE TABLE submission_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) UNIQUE NOT NULL,  -- 'dissertation-proposal', 'capstone', etc.
    label           VARCHAR(255) NOT NULL,
    description     TEXT,
    is_gated_review BOOLEAN NOT NULL DEFAULT false,
    is_blind_review BOOLEAN NOT NULL DEFAULT false,
    allow_meetings  BOOLEAN NOT NULL DEFAULT false,
    max_file_size_mb INT NOT NULL DEFAULT 8,
    allowed_extensions TEXT[] NOT NULL DEFAULT '{pdf,docx}',
    max_files       INT NOT NULL DEFAULT 5,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `workflow_definitions`

```sql
CREATE TABLE workflow_definitions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type_id       UUID NOT NULL REFERENCES submission_types(id),
    name                     VARCHAR(255) NOT NULL,
    revision_restart_policy  VARCHAR(50) NOT NULL DEFAULT 'FULL_RESTART',
    -- FULL_RESTART: restart from stage order = 1 on revision (gated workflows)
    -- FAILED_STAGE_RESTART: restart from the stage that issued REVISION_REQUIRED
    final_status_on_pass     VARCHAR(100) NOT NULL DEFAULT 'ACCEPTED',
    -- For non-gated workflows. Overridable: 'PUBLISHED', 'ACCEPTED', etc.
    -- For gated workflows, final status is set by the GatedRelease decision.
    is_active                BOOLEAN NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_workflow_per_type UNIQUE (submission_type_id, is_active)
    -- Only one active workflow per submission type
);
```

---

### `stage_definitions`

```sql
CREATE TABLE stage_definitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id       UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    "order"           INT NOT NULL,          -- 1-indexed, determines execution sequence
    stage_role_label  VARCHAR(255) NOT NULL, -- Free text display name configured by admin:
                                             -- 'Chair', 'Committee Member', 'Program Director',
                                             -- 'IRB Reviewer', 'External Examiner', etc.
                                             -- This is a display label only; any 'reviewer' user
                                             -- may be assigned to any stage.
    template_id       UUID REFERENCES stage_templates(id) ON DELETE SET NULL,
    -- Optional: records which template this stage was instantiated from
    is_gatekeeper     BOOLEAN NOT NULL DEFAULT false,
    -- true = this is the stage whose assigned users see the Gated Review interface
    -- and are responsible for issuing the formal GatedRelease. Only one stage per
    -- workflow may have is_gatekeeper = true.
    execution_type    VARCHAR(20) NOT NULL DEFAULT 'PARALLEL',
    -- PARALLEL: all assigned reviewers active simultaneously
    -- SEQUENTIAL: activate next reviewer only after previous completes
    approval_strategy VARCHAR(20) NOT NULL DEFAULT 'ALL',
    -- ALL: every reviewer must approve
    -- ANY: at least one approval sufficient
    -- MAJORITY: at least min_approvals must approve
    min_approvals     INT NOT NULL DEFAULT 1,  -- used when strategy = MAJORITY
    is_anonymous      BOOLEAN NOT NULL DEFAULT false,  -- reviewers hidden from each other
    due_days          INT NOT NULL DEFAULT 7,
    visibility_config JSONB NOT NULL DEFAULT '{}',
    -- Shape: {
    --   "decisions_visible_to": ["admin","gatekeeper"],
    --   "feedback_visible_to": ["admin","gatekeeper"],
    --   "reviewer_names_visible_to": ["admin","gatekeeper","committee"],
    --   "stage_progress_visible_to": ["admin","gatekeeper","submitter","committee"]
    -- }
    escalation_config JSONB NOT NULL DEFAULT '{}',
    -- Shape: {
    --   "enabled": true,
    --   "escalate_after_days": 2,
    --   "action": "NOTIFY_ONLY" | "REASSIGN" | "ADD_PARALLEL_APPROVER",
    --   "escalate_to_role": "coordinator"
    -- }
    decision_options   JSONB NOT NULL DEFAULT '[
        {"value":"APPROVE","label":"Approve","outcome":"APPROVED"},
        {"value":"REQUEST_CHANGES","label":"Request Changes","outcome":"REVISION"},
        {"value":"REJECT","label":"Reject","outcome":"REJECTED"}
    ]',
    -- Each option: { value: string (internal key stored in review_decisions.decision),
    --               label: string (shown to reviewer in the UI),
    --               outcome: "APPROVED" | "REVISION" | "REJECTED" }
    -- StageEvaluator counts by outcome, not value — so multiple labels can map to
    -- the same outcome (e.g. "Pass" and "Pass with Minor Revisions" both → APPROVED).
    skip_condition     JSONB,
    -- null = stage is never auto-skipped.
    -- Evaluated at workflow run start against submission.metadata.
    -- { "field": "metadata.funding_type", "operator": "neq", "value": "external" }
    -- operators: "eq" | "neq" | "gt" | "lt" | "contains" | "exists" | "not_exists"
    auto_assignment    JSONB NOT NULL DEFAULT '{"strategy":"MANUAL"}',
    -- strategy: "MANUAL"           = coordinator manually assigns
    --           "POOL_RANDOM"       = pick randomly from reviewer_pool
    --           "POOL_ROUND_ROBIN"  = lowest current workload from pool
    -- { "strategy": "POOL_ROUND_ROBIN", "count": 3,
    --   "pool_filter": { "stage_role_label": "Committee Member" },
    --   "exclude_submitter_program": true }
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_stage_order_per_workflow UNIQUE (workflow_id, "order"),
    CONSTRAINT one_gatekeeper_per_workflow
        EXCLUDE USING btree (workflow_id WITH =) WHERE (is_gatekeeper = true)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_stage_def_workflow ON stage_definitions(workflow_id, "order");
```

---

### `stage_transitions`

DAG edges between stages within a workflow. Replaces the implicit linear ordering for routing decisions. The `"order"` on `stage_definitions` is now a **display order hint** only (for rendering the workflow builder); actual execution routing follows these edges.

```sql
CREATE TABLE stage_transitions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id   UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES stage_definitions(id) ON DELETE CASCADE,
    -- NULL = entry edge (workflow start → this stage)
    to_stage_id   UUID NOT NULL REFERENCES stage_definitions(id) ON DELETE CASCADE,
    condition     JSONB,
    -- null = unconditional (always followed when from_stage passes)
    -- { "field": "metadata.involves_human_subjects",
    --   "operator": "eq", "value": true }
    -- operators: "eq" | "neq" | "gt" | "lt" | "contains" | "exists" | "not_exists"
    priority      INT NOT NULL DEFAULT 0,
    -- When multiple outgoing conditional edges from same stage, higher priority evaluated first.
    -- First matching condition is taken; remaining edges are not evaluated.
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT no_self_loop CHECK (from_stage_id IS DISTINCT FROM to_stage_id)
);

CREATE INDEX idx_transitions_from ON stage_transitions(workflow_id, from_stage_id);
CREATE INDEX idx_transitions_to   ON stage_transitions(workflow_id, to_stage_id);
```

**DAG invariants enforced at application layer:**
- No cycles (validated by `WorkflowDefinitionValidator` at save time via topological sort)
- Exactly one entry edge (`from_stage_id IS NULL`) per workflow
- Exit stages (no outgoing edges) are terminal — non-gated: triggers `ACCEPTED`; gated: triggers `pending_release`

---

### `stage_templates`

Reusable stage blueprints. Admins instantiate templates into `stage_definitions` when building a workflow. System-seeded templates are read-only (`is_system = true`).

```sql
CREATE TABLE stage_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,  -- 'Peer Review', 'Ethics Review', 'Editorial Review'
    description       TEXT,
    stage_role_label  VARCHAR(255) NOT NULL,
    execution_type    VARCHAR(20) NOT NULL DEFAULT 'PARALLEL',
    approval_strategy VARCHAR(20) NOT NULL DEFAULT 'ALL',
    min_approvals     INT NOT NULL DEFAULT 1,
    is_anonymous      BOOLEAN NOT NULL DEFAULT false,
    due_days          INT NOT NULL DEFAULT 7,
    decision_options  JSONB NOT NULL DEFAULT '[
        {"value":"APPROVE","label":"Approve","outcome":"APPROVED"},
        {"value":"REQUEST_CHANGES","label":"Request Changes","outcome":"REVISION"},
        {"value":"REJECT","label":"Reject","outcome":"REJECTED"}
    ]',
    visibility_config JSONB NOT NULL DEFAULT '{}',
    escalation_config JSONB NOT NULL DEFAULT '{}',
    is_system         BOOLEAN NOT NULL DEFAULT false,
    -- true = seeded at install; shown to all; UPDATE/DELETE blocked for non-superadmin
    -- false = admin-created; editable by admin
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- System-seeded templates (seeded via DatabaseSeeder):
-- 'Peer Review'     — PARALLEL / ALL / majority anonymous
-- 'Editorial Review'— PARALLEL / ANY / single approver
-- 'Ethics Review'   — SEQUENTIAL / ALL / custom IRB decision options
-- 'Program Director'— PARALLEL / ALL / single approver gate
```
```

---

### `submissions`

```sql
CREATE TABLE submissions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type_id   UUID NOT NULL REFERENCES submission_types(id),
    program_id           UUID REFERENCES programs(id) ON DELETE SET NULL,
    submitter_id         UUID NOT NULL REFERENCES users(id),
    title                VARCHAR(500) NOT NULL,
    abstract             TEXT,
    status               VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT | SUBMITTED | IN_REVIEW | REVISION_REQUIRED
    -- | ACCEPTED | CONDITIONALLY_ACCEPTED | REJECTED | WITHDRAWN | CANCELLED
    current_version      INT NOT NULL DEFAULT 0,  -- 0 = draft, 1 = first submission
    is_locked            BOOLEAN NOT NULL DEFAULT false,
    -- Locked when under appeal or admin hold
    metadata             JSONB NOT NULL DEFAULT '{}',
    -- Flexible extra fields per submission type (research area, affiliation, etc.)
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_submitter  ON submissions(submitter_id);
CREATE INDEX idx_submissions_type       ON submissions(submission_type_id);
CREATE INDEX idx_submissions_status     ON submissions(status);
CREATE INDEX idx_submissions_program    ON submissions(program_id);
```

---

### `submission_authors`

Join table tracking all authors (submitter + co-authors) of a submission. The submitter is always present as `role = 'submitter'`. Co-authors can be added before or after submission. Reviewer feedback (comments in `review_decisions` and `gated_releases`) is visible to all rows in this table — not just the submitter.

```sql
CREATE TABLE submission_authors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    -- NULL when author has been invited but has not yet registered
    invited_email   VARCHAR(255),
    -- NULL when author is already a registered user (user_id is set)
    -- When user registers via invite token, user_id is populated and invited_email cleared
    invite_token    VARCHAR(100) UNIQUE,
    -- Short-lived token (72h); used in registration invite link
    -- NULL after the user has registered
    invite_expires_at TIMESTAMPTZ,
    role            VARCHAR(20) NOT NULL DEFAULT 'co_author',
    -- 'submitter'  — the primary submitter (one per submission; mirrors submissions.submitter_id)
    -- 'co_author'  — additional author added by submitter
    added_by        UUID REFERENCES users(id),
    -- NULL for the submitter row (auto-created on submission creation)
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_author_per_submission UNIQUE (submission_id, user_id),
    CONSTRAINT author_has_user_or_email CHECK (
        (user_id IS NOT NULL) OR (invited_email IS NOT NULL)
    )
);

CREATE INDEX idx_submission_authors_submission ON submission_authors(submission_id);
CREATE INDEX idx_submission_authors_user       ON submission_authors(user_id);
CREATE INDEX idx_submission_authors_token      ON submission_authors(invite_token) WHERE invite_token IS NOT NULL;
```

Business rules:
- Created automatically with `role = 'submitter'` when a submission is created.
- Submitter may add co-authors at any time while the submission is in `DRAFT`, `SUBMITTED`, `IN_REVIEW`, or `REVISION_REQUIRED` status.
- If the co-author is a registered user (lookup by email) → `user_id` set immediately; invite email sent as notification.
- If the co-author is not registered → `invited_email` + `invite_token` set; invitation email sent with registration link; on registration the invite token links the new user to the submission.
- Reviewer feedback (`review_decisions.comments`, `gated_releases.feedback`) is delivered as notifications to **all** `submission_authors` where `user_id IS NOT NULL`.
- Submitter identity (`submitter_id`) is not shown to reviewers regardless; co-author list is similarly hidden from reviewers unless the submission type has `is_blind_review = false` AND visibility is explicitly configured.

---

### `submission_versions`

```sql
CREATE TABLE submission_versions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id    UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    version_number   INT NOT NULL,
    document_paths   TEXT[] NOT NULL DEFAULT '{}',  -- relative paths under storage/
    change_summary   TEXT,                          -- author-provided revision notes
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID NOT NULL REFERENCES users(id),

    CONSTRAINT uq_submission_version UNIQUE (submission_id, version_number)
);

CREATE INDEX idx_sub_versions_submission ON submission_versions(submission_id, version_number DESC);
```

---

### `workflow_runs`

One per submission per version. When a student submits a revision, the old run is SUPERSEDED and a new run starts.

```sql
CREATE TABLE workflow_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id       UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
    version_number      INT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | COMPLETED | SUPERSEDED | CANCELLED
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,

    CONSTRAINT uq_workflow_run_per_version UNIQUE (submission_id, version_number)
);

CREATE INDEX idx_workflow_runs_submission ON workflow_runs(submission_id);
CREATE INDEX idx_workflow_runs_status     ON workflow_runs(status);
```

---

### `stage_instances`

One per stage per workflow run. Created eagerly for all stages at run start; only the first becomes ACTIVE immediately.

```sql
CREATE TABLE stage_instances (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id      UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    stage_definition_id  UUID NOT NULL REFERENCES stage_definitions(id),
    "order"              INT NOT NULL,
    status               VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    -- PENDING: not yet started
    -- ACTIVE: reviewers notified, awaiting decisions
    -- PASSED: all conditions met
    -- FAILED: rejection decision (REJECT in stage outcome)
    -- REVISION_REQUIRED: REQUEST_CHANGES outcome
    -- SKIPPED: stage was bypassed by admin
    started_at           TIMESTAMPTZ,
    due_at               TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    sequential_position  INT NOT NULL DEFAULT 0,
    -- For SEQUENTIAL stages: which reviewer position is currently active (0-indexed)
    pending_release      BOOLEAN NOT NULL DEFAULT false,
    -- True when this is the gatekeeper stage and all higher stages are done
    -- but no GatedRelease has been recorded yet for this run
    recheck_count        INT NOT NULL DEFAULT 0,

    CONSTRAINT uq_stage_instance_per_run UNIQUE (workflow_run_id, "order")
);

CREATE INDEX idx_stage_instances_run    ON stage_instances(workflow_run_id, "order");
CREATE INDEX idx_stage_instances_status ON stage_instances(status);
```

---

### `stage_assignments`

Which users are assigned to review a specific stage instance.

```sql
CREATE TABLE stage_assignments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_instance_id UUID NOT NULL REFERENCES stage_instances(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id),
    assigned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by       UUID NOT NULL REFERENCES users(id),
    notified_at       TIMESTAMPTZ,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    -- false when SEQUENTIAL and not yet their turn, or when reassigned away

    CONSTRAINT uq_assignment_per_stage UNIQUE (stage_instance_id, user_id)
);

CREATE INDEX idx_stage_assignments_stage  ON stage_assignments(stage_instance_id);
CREATE INDEX idx_stage_assignments_user   ON stage_assignments(user_id, is_active);
```

---

### `review_decisions`

Immutable. Never UPDATE or DELETE. Each row is a single reviewer's decision on a single stage instance.

```sql
CREATE TABLE review_decisions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_instance_id UUID NOT NULL REFERENCES stage_instances(id),
    submission_id     UUID NOT NULL REFERENCES submissions(id),
    version_number    INT NOT NULL,
    reviewer_id       UUID NOT NULL REFERENCES users(id),
    decision          VARCHAR(100) NOT NULL,
    -- Must match a decision_options.value in the stage's stage_definition.
    -- Default values: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'
    -- Custom examples: 'PASS' | 'PASS_MINOR' | 'MAJOR_REVISION' | 'FAIL'
    comments          TEXT,
    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One decision per reviewer per stage instance (last-write-wins is NOT allowed;
    -- if a reviewer needs to change their mind, admin must reset the stage)
    CONSTRAINT uq_decision_per_reviewer UNIQUE (stage_instance_id, reviewer_id)
);

CREATE INDEX idx_decisions_stage      ON review_decisions(stage_instance_id);
CREATE INDEX idx_decisions_submission ON review_decisions(submission_id, version_number);
CREATE INDEX idx_decisions_reviewer   ON review_decisions(reviewer_id);
```

---

### `gated_releases`

Formal student-visible decision from the gatekeeper. Immutable. One per workflow run (old one is superseded by new run when student re-submits).

```sql
CREATE TABLE gated_releases (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id      UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    workflow_run_id    UUID NOT NULL REFERENCES workflow_runs(id),
    version_number     INT NOT NULL,
    decision           VARCHAR(50) NOT NULL,
    -- ACCEPTED | CONDITIONALLY_ACCEPTED | REVISION_REQUIRED | REJECTED
    feedback           TEXT,
    released_by        UUID NOT NULL REFERENCES users(id),
    released_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_gated_release_per_run UNIQUE (workflow_run_id)
    -- Only one release per workflow run; a new run means a new release
);

CREATE INDEX idx_gated_releases_submission ON gated_releases(submission_id);
```

---

### `appeal_requests`

```sql
CREATE TABLE appeal_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id),
    submitter_id    UUID NOT NULL REFERENCES users(id),
    grounds         TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | UNDER_REVIEW | UPHELD | DISMISSED
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `meetings`

```sql
CREATE TABLE meetings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    scheduled_at    TIMESTAMPTZ NOT NULL,
    duration_min    INT NOT NULL DEFAULT 60,
    location        VARCHAR(500),  -- URL or physical location
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    attendees       UUID[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_submission ON meetings(submission_id);
```

---

### `notifications`

```sql
CREATE TABLE notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         VARCHAR(100) NOT NULL,
    -- 'decision_submitted' | 'stage_completed' | 'release_issued' |
    -- 'revision_requested' | 'reviewer_assigned' | 'escalation_triggered' | 'meeting_scheduled' |
    -- 'co_author_invited' | 'co_author_added' | 'co_author_registered'
    data         JSONB NOT NULL DEFAULT '{}',
    -- {submission_id, submission_title, stage_name, decision, actor_name, ...}
    read_at      TIMESTAMPTZ,
    emailed_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user    ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

---

### `notification_preferences`

```sql
CREATE TABLE notification_preferences (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences   JSONB NOT NULL DEFAULT '{}',
    -- {
    --   "email": {
    --     "reviewer_assigned": true,
    --     "decision_submitted": true,
    --     "stage_completed": true,
    --     "release_issued": true,
    --     "escalation_triggered": true,
    --     "meeting_scheduled": true
    --   },
    --   "in_app": { same keys }
    -- }
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `escalation_logs`

```sql
CREATE TABLE escalation_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_instance_id UUID NOT NULL REFERENCES stage_instances(id),
    escalated_to      UUID[] NOT NULL,
    action_taken      VARCHAR(50) NOT NULL,  -- NOTIFY_ONLY | REASSIGN | ADD_PARALLEL_APPROVER
    reason            TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `audit_logs`

Immutable. No UPDATE or DELETE permitted (enforced via PostgreSQL row security or application-level constraint).

```sql
CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES submissions(id),  -- nullable for non-submission events
    actor_id      UUID REFERENCES users(id),
    action        VARCHAR(100) NOT NULL,
    -- 'submission_created' | 'version_submitted' | 'reviewer_assigned' |
    -- 'decision_recorded' | 'stage_passed' | 'stage_failed' | 'gated_release_issued' |
    -- 'revision_started' | 'submission_accepted' | 'submission_rejected' |
    -- 'user_created' | 'workflow_updated' | 'escalation_triggered' |
    -- 'webhook_delivered' | 'config_changed' | 'sso_login' | 'login_failed'
    before_state  JSONB,           -- snapshot of relevant fields before the action
    after_state   JSONB,           -- snapshot of relevant fields after the action
    data          JSONB NOT NULL DEFAULT '{}',  -- additional context (stage_name, reason, etc.)
    ip_address    INET,
    user_agent    VARCHAR(500),    -- e.g. 'Mozilla/5.0 ... Chrome/124'
    request_id    VARCHAR(100),    -- correlates with web server access log
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_submission ON audit_logs(submission_id, created_at DESC);
CREATE INDEX idx_audit_actor      ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action     ON audit_logs(action, created_at DESC);
```

---

### `reviewer_pools`

Pre-defined pools of available reviewers per submission type, for admin use during reviewer assignment.

```sql
CREATE TABLE reviewer_pools (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type_id UUID NOT NULL REFERENCES submission_types(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_role_label   VARCHAR(255),  -- null = available for any stage
                                       -- matches stage_definitions.stage_role_label for filtering
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_pool_entry UNIQUE (submission_type_id, user_id, stage_role_label)
);
```

---

### `webhook_subscriptions`

```sql
CREATE TABLE webhook_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url         VARCHAR(2000) NOT NULL,
    events      TEXT[] NOT NULL,
    -- 'submission.created' | 'decision.submitted' | 'stage.passed' |
    -- 'submission.accepted' | 'submission.rejected' | 'revision.requested' |
    -- 'gated_release.issued' | 'escalation.triggered'
    secret_enc  VARCHAR(1000),
    -- HMAC-SHA256 signing secret stored encrypted with Crypt::encryptString().
    -- Signature header sent on each delivery: X-RRP-Signature: sha256=<hex>
    description VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `webhook_deliveries`

```sql
CREATE TABLE webhook_deliveries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type              VARCHAR(100) NOT NULL,
    payload                 JSONB NOT NULL,
    attempt                 INT NOT NULL DEFAULT 1,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | DELIVERED | FAILED | RETRYING
    response_code           INT,
    response_body           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at            TIMESTAMPTZ
);

CREATE INDEX idx_webhook_deliveries_sub    ON webhook_deliveries(webhook_subscription_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('PENDING','RETRYING');
```

---

### `config_overrides`

Scope-specific overrides for configurable values. Resolved by `ConfigResolver` from most-specific (stage) to least-specific (global). See also §8.5 in [01-architecture.md](01-architecture.md).

```sql
CREATE TABLE config_overrides (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope        VARCHAR(20) NOT NULL,
    -- 'submission_type' | 'stage'
    -- Global values live in organization_settings directly.
    scope_id     UUID NOT NULL,
    -- submission_types.id  when scope = 'submission_type'
    -- stage_definitions.id when scope = 'stage'
    config_key   VARCHAR(100) NOT NULL,
    -- 'max_file_size_mb' | 'due_days' | 'allowed_extensions' | ...
    config_value JSONB NOT NULL,
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_config_override UNIQUE (scope, scope_id, config_key)
);

CREATE INDEX idx_config_overrides_scope ON config_overrides(scope, scope_id);
```

**Resolution order** (highest priority first):
1. `config_overrides` WHERE scope = `'stage'` AND scope_id = stage_definition_id
2. `config_overrides` WHERE scope = `'submission_type'` AND scope_id = submission_type_id
3. `organization_settings` global value
4. Application default (seeded constant)

---

## Status Enum Reference

### `submissions.status`

| Value | Meaning |
|---|---|
| `DRAFT` | Created but not yet submitted |
| `SUBMITTED` | Submitted, awaiting first reviewer assignment |
| `IN_REVIEW` | Active workflow run in progress |
| `REVISION_REQUIRED` | Reviewer(s) requested changes; awaiting student resubmission |
| `ACCEPTED` | Final approval granted (non-gated: all stages passed; gated: release = ACCEPTED) |
| `CONDITIONALLY_ACCEPTED` | Accepted with minor conditions (gated release only) |
| `REJECTED` | Final rejection (non-gated: REJECT decision; gated: release = REJECTED) |
| `WITHDRAWN` | Withdrawn by submitter |
| `CANCELLED` | Cancelled by admin |
| `APPEAL_PENDING` | Rejection being appealed |
| `APPEAL_UNDER_REVIEW` | Appeal accepted for formal review |

### `workflow_runs.status`

| Value | Meaning |
|---|---|
| `ACTIVE` | Currently processing |
| `COMPLETED` | All stages finished; gated release issued (if gated) |
| `SUPERSEDED` | Student submitted revision; replaced by new run |
| `CANCELLED` | Admin cancelled |

### `stage_instances.status`

| Value | Meaning |
|---|---|
| `PENDING` | Not yet started (future stage) |
| `ACTIVE` | Reviewers active, collecting decisions |
| `PASSED` | Stage evaluation returned PASSED |
| `FAILED` | Stage evaluation returned FAILED (REJECT outcome) |
| `REVISION_REQUIRED` | Stage evaluation returned REVISION_REQUIRED |
| `SKIPPED` | Admin bypassed this stage |

---

### `organization_settings`

Single-row table. Enforced by `CHECK (id = 1)`.

```sql
CREATE TABLE organization_settings (
    id                          INT PRIMARY KEY DEFAULT 1,
    org_name                    VARCHAR(255) NOT NULL DEFAULT 'Research Review Portal',
    org_short_name              VARCHAR(100),
    logo_path                   VARCHAR(500),     -- path to uploaded logo file
    favicon_path                VARCHAR(500),
    primary_color               VARCHAR(7),       -- hex, e.g. '#1E40AF'
    accent_color                VARCHAR(7),
    timezone                    VARCHAR(100) NOT NULL DEFAULT 'UTC',
    locale                      VARCHAR(10) NOT NULL DEFAULT 'en',
    date_format                 VARCHAR(50) NOT NULL DEFAULT 'YYYY-MM-DD',
    footer_text                 TEXT,
    support_email               VARCHAR(255),
    allow_public_registration   BOOLEAN NOT NULL DEFAULT false,
    -- When true and feature flag 'enable_public_registration' is on:
    -- the /auth/register endpoint is open; new users are auto-assigned
    -- to public_submission_default_group_id and public_submission_default_role
    public_submission_default_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    -- Group that public self-registered users are automatically added to
    -- Must be set before enabling public registration
    public_submission_default_role  VARCHAR(50) NOT NULL DEFAULT 'student',
    -- Role assigned to publicly self-registered users ('student' by default)
    archive_after_days          INT DEFAULT 365,  -- auto-archive accepted/rejected submissions
    max_file_size_mb_global     INT NOT NULL DEFAULT 10,  -- system-wide cap; type overrides limited to ≤ this
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_org_row CHECK (id = 1)
);
```

---

### `sso_providers`

Multiple SSO providers may be configured. Only one may be `is_default = true`.

```sql
CREATE TABLE sso_providers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 VARCHAR(255) NOT NULL,  -- Display name: 'University SSO', 'Google Workspace'
    protocol             VARCHAR(10) NOT NULL,   -- 'SAML2' | 'OIDC' | 'OAUTH2'
    is_enabled           BOOLEAN NOT NULL DEFAULT false,
    is_default           BOOLEAN NOT NULL DEFAULT false,  -- auto-redirect on login page
    button_label         VARCHAR(255),           -- 'Sign in with CityU Account'
    button_icon_url      VARCHAR(500),
    config               JSONB NOT NULL DEFAULT '{}',
    -- SAML2: {
    --   "entity_id": "...",        -- our SP entity ID
    --   "sso_url": "...",          -- IdP SSO endpoint
    --   "slo_url": "...",          -- IdP SLO endpoint (optional)
    --   "idp_certificate": "...",  -- IdP signing certificate (PEM)
    --   "want_assertions_signed": true,
    --   "attribute_mapping": { "email": "urn:...", "name": "...", "roles": "..." }
    -- }
    -- OIDC: {
    --   "issuer": "https://...",
    --   "client_id": "...",
    --   "client_secret_enc": "...",  -- AES-256-CBC via Laravel Crypt::encryptString()
    --   "scopes": ["openid","email","profile"],
    --   "claim_mapping": { "email": "email", "name": "name", "roles": "groups" }
    -- }
    auto_provision_users BOOLEAN NOT NULL DEFAULT true,
    -- true = create user account on first SSO login if not found by email
    default_role         VARCHAR(50) NOT NULL DEFAULT 'student',
    -- role assigned to auto-provisioned users
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_one_default_sso ON sso_providers(is_default) WHERE is_default = true;
```

---

### `groups`

Departments, faculties, custom groupings. Programs can be linked to a group. Users can belong to multiple groups.

```sql
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    type        VARCHAR(50) NOT NULL DEFAULT 'department',
    -- 'department' | 'faculty' | 'school' | 'custom'
    parent_id   UUID REFERENCES groups(id) ON DELETE SET NULL,
    -- Supports hierarchy: Faculty → Department
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `user_groups`

```sql
CREATE TABLE user_groups (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role       VARCHAR(50) NOT NULL DEFAULT 'member',
    -- 'member' | 'lead' | 'manager'
    -- Used for group-scoped display and assignment filtering
    -- Does NOT create new global roles; authorization still via stage_assignments
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_user_groups_group ON user_groups(group_id);
CREATE INDEX idx_user_groups_user  ON user_groups(user_id);
```

---

### `email_settings`

Single-row table. Sensitive credential stored encrypted.

```sql
CREATE TABLE email_settings (
    id              INT PRIMARY KEY DEFAULT 1,
    driver          VARCHAR(20) NOT NULL DEFAULT 'smtp',
    -- 'smtp' | 'ses' | 'mailgun' | 'postmark' | 'log' (dev only)
    host            VARCHAR(255),
    port            INT DEFAULT 587,
    encryption      VARCHAR(10) DEFAULT 'tls',   -- 'tls' | 'ssl' | null
    username        VARCHAR(255),
    password_enc    VARCHAR(1000),  -- encrypted with Laravel Crypt::encryptString() using APP_KEY
    from_address    VARCHAR(255) NOT NULL DEFAULT 'noreply@example.com',
    from_name       VARCHAR(255) NOT NULL DEFAULT 'Research Review Portal',
    reply_to        VARCHAR(255),
    is_verified     BOOLEAN NOT NULL DEFAULT false,  -- true after successful test send
    -- SES-specific:
    ses_key_enc     VARCHAR(1000),  -- encrypted access key
    ses_secret_enc  VARCHAR(1000),  -- encrypted secret
    ses_region      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_email_row CHECK (id = 1)
);
```

---

### `notification_templates`

Admin-editable email templates. Seeded with defaults at install.

```sql
CREATE TABLE notification_templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(100) NOT NULL UNIQUE,
    -- 'reviewer_assigned' | 'decision_submitted' | 'stage_completed' |
    -- 'gated_release_issued' | 'revision_requested' | 'escalation_triggered' |
    -- 'meeting_scheduled' | 'appeal_received' | 'welcome' |
    -- 'co_author_invited'     — sent to the invited email address with registration link
    -- 'co_author_added'       — sent to a registered user added as co-author
    -- 'co_author_registered'  — sent to submitter when an invited co-author completes registration
    -- 'public_registration'   — welcome email sent to self-registered users
    subject       VARCHAR(500) NOT NULL,
    body_html     TEXT NOT NULL,
    body_text     TEXT NOT NULL,
    -- Supported template variables:
    -- {{submitter_name}}, {{submission_title}}, {{submission_type}},
    -- {{stage_name}}, {{decision}}, {{feedback}}, {{due_date}},
    -- {{reviewer_name}}, {{portal_url}}, {{org_name}}
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `password_policy`

```sql
CREATE TABLE password_policy (
    id                         INT PRIMARY KEY DEFAULT 1,
    min_length                 INT NOT NULL DEFAULT 12,
    require_uppercase          BOOLEAN NOT NULL DEFAULT true,
    require_number             BOOLEAN NOT NULL DEFAULT true,
    require_special            BOOLEAN NOT NULL DEFAULT true,
    expiry_days                INT,            -- null = no expiry
    history_count              INT DEFAULT 5,  -- cannot reuse last N passwords
    max_login_attempts         INT NOT NULL DEFAULT 5,
    lockout_duration_minutes   INT NOT NULL DEFAULT 15,
    session_timeout_minutes    INT NOT NULL DEFAULT 480,  -- 8 hours
    require_2fa                BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT single_policy_row CHECK (id = 1)
);
```

---

### `feature_flags`

```sql
CREATE TABLE feature_flags (
    key           VARCHAR(100) PRIMARY KEY,
    value         BOOLEAN NOT NULL DEFAULT false,
    description   TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seeded defaults:
-- 'enable_appeals'              → true
-- 'enable_meetings'             → true
-- 'enable_sso'                  → false
-- 'enable_2fa'                  → false
-- 'enable_dark_mode'            → true
-- 'enable_analytics'            → true
-- 'enable_csv_export'           → true
-- 'enable_reviewer_self_assign' → false
```

---

## Security & Encryption Reference

### Encryption Algorithms

| Data | Algorithm | Key Source |
|---|---|---|
| User passwords | bcrypt (cost factor 12, Laravel default) | Per-hash salt |
| Sanctum API tokens | SHA-256 hash stored; plaintext shown once | — |
| `email_settings.password_enc` | AES-256-CBC via `Crypt::encryptString()` | `APP_KEY` (env var) |
| `sso_providers.config.*_enc` fields | AES-256-CBC via `Crypt::encryptString()` | `APP_KEY` (env var) |
| `webhook_subscriptions.secret_enc` | AES-256-CBC via `Crypt::encryptString()` | `APP_KEY` (env var) |
| `APP_KEY` | 32-byte random base64 key | Generated at install via `php artisan key:generate` |
| Database connection | TLS/SSL enforced in production (`sslmode=require`) | Server certificate |
| File storage | Filesystem permissions 640; outside webroot; private ACL on cloud blob | — |
| HTTPS | TLS 1.2+ minimum; TLS 1.3 preferred | Let's Encrypt / platform managed cert |

**Rules:**
- `APP_KEY` is never stored in the database. It is injected via environment variable at runtime.
- Rotating `APP_KEY` re-encrypts all `*_enc` fields; use `php artisan settings:rekey`.
- Password hashes are never logged or returned in any API response.
- Audit log entries are append-only; no UPDATE or DELETE is permitted.

---

### PostgreSQL Database Roles

Two PostgreSQL roles are created at install. The application uses `rrp_app`; reporting tools use `rrp_readonly`.

```sql
-- Application role (used by Laravel)
CREATE ROLE rrp_app LOGIN;        -- password set from environment, never hardcoded
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rrp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rrp_app;

-- Immutable tables: app may INSERT but not UPDATE or DELETE
REVOKE UPDATE, DELETE ON audit_logs       FROM rrp_app;
REVOKE UPDATE, DELETE ON review_decisions FROM rrp_app;
REVOKE UPDATE, DELETE ON gated_releases   FROM rrp_app;

-- Read-only role (used for reporting, analytics, monitoring queries)
CREATE ROLE rrp_readonly LOGIN;   -- password set separately; never share with app
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rrp_readonly;

-- Revoke default public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rrp_app, rrp_readonly;
```

The Laravel `.env` (or equivalent env var) uses `rrp_app` credentials. Direct DB access for analytics uses `rrp_readonly` credentials stored separately.

---

### Row-Level Security (Defense-in-Depth)

RLS is applied to `audit_logs`, `review_decisions`, and `gated_releases` to enforce immutability even if a future query bug in the application layer issues an UPDATE or DELETE.

```sql
-- Enable RLS on immutable tables
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gated_releases   ENABLE ROW LEVEL SECURITY;

-- Allow INSERT and SELECT; deny UPDATE and DELETE for rrp_app
CREATE POLICY audit_insert_only
    ON audit_logs
    FOR ALL TO rrp_app
    USING (true)          -- SELECT: see all rows
    WITH CHECK (true);    -- INSERT: allow all
-- UPDATE/DELETE are implicitly denied because no WITH CHECK clause covers them

-- Same pattern for review_decisions and gated_releases
CREATE POLICY decisions_insert_only
    ON review_decisions FOR ALL TO rrp_app
    USING (true) WITH CHECK (true);

CREATE POLICY releases_insert_only
    ON gated_releases FOR ALL TO rrp_app
    USING (true) WITH CHECK (true);
```

Note: `FORCE ROW LEVEL SECURITY` is not set for the superuser role, which is used only for migrations and maintenance.

---

## Key Constraints (Business Rules as Database Constraints)

```sql
-- A submission can only have one ACTIVE workflow run at a time
CREATE UNIQUE INDEX uq_one_active_run
    ON workflow_runs(submission_id)
    WHERE status = 'ACTIVE';

-- review_decisions are immutable: enforce at DB level via RLS (see Security section)
-- and application-level RULE as belt-and-suspenders
CREATE RULE no_update_decisions AS ON UPDATE TO review_decisions DO INSTEAD NOTHING;
CREATE RULE no_delete_decisions AS ON DELETE TO review_decisions DO INSTEAD NOTHING;

-- audit_logs are immutable
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit  AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- gated_releases are immutable
CREATE RULE no_update_releases AS ON UPDATE TO gated_releases DO INSTEAD NOTHING;
CREATE RULE no_delete_releases AS ON DELETE TO gated_releases DO INSTEAD NOTHING;

-- stage_transitions: no cycles (enforced at application layer via topological sort before save)
-- stage_templates: system templates cannot be deleted (enforced in application Policy)
-- config_overrides: scope values must reference valid scope_id (enforced at application layer)
```
