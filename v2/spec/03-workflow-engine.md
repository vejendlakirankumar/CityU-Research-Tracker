# v2 — Workflow Engine

---

## 1. State Machine

The submission status is always derived from the active workflow run's state — it is **stored** (not computed), updated transactionally after each workflow event.

```
                        ┌─────────────────────────────────────┐
                        ▼                                     │
DRAFT ──submit()──▶ SUBMITTED ──assign_reviewers()──▶ IN_REVIEW
                                                          │   │
                    ┌─────────────────────────────────────┘   │
                    ▼                                          │
            REVISION_REQUIRED                                  │
                    │                                          │
                    │ resubmit()                               │
                    └──────────────────────▶ IN_REVIEW         │
                                               │               │
                              all stages pass  │   REJECT      │
                                               ├──decision──▶ REJECTED
                            ┌──────────────────┘              │
                            ▼                                 │
              (non-gated) ACCEPTED                            │
              (gated) ──▶ [pending_release = true]           │
                            │                                  │
                  chair releases                               │
                    │ ACCEPTED                                 │
                    │ CONDITIONALLY_ACCEPTED                   │
                    │ REJECTED                                 │
                    └──▶ (set status accordingly)              │
                                                               │
WITHDRAWN ◀── withdraw() ─────────────────────────────────────┘
APPEAL_PENDING ◀── appeal()  ◀──  REJECTED
```

---

## 2. Core Services

### 2.1 `WorkflowEngine` (DAG-based)

The engine traverses a directed acyclic graph of stages rather than a simple ordered list. Parallel branches are activated simultaneously; conditional transitions enable dynamic routing.

```php
class DAGWorkflowEngine implements WorkflowEngineContract
{
    public function startWorkflow(Submission $submission): WorkflowRun;
    public function onStagePassed(WorkflowRun $run, StageInstance $passedStage): void;
    public function handleRevisionRequired(WorkflowRun $run, StageInstance $stage): void;
    public function handleRejection(WorkflowRun $run, StageInstance $stage): void;
    public function handleRevisionSubmitted(Submission $submission, int $newVersion): WorkflowRun;
    public function skipStage(StageInstance $stage, User $actor): void;
    public function reassignStage(StageInstance $stage, array $newUserIds, User $actor): void;
}
```

#### `startWorkflow()`

```
1. Load WorkflowDefinition and all StageDefinitions + StageTransitions
2. Validate DAG: topological sort — fail fast if cycle detected
3. Create WorkflowRun { status: ACTIVE, version_number: submission.current_version }
4. Create StageInstance for each StageDefinition (all PENDING)
5. Find entry stages: stages with no incoming edges (from_stage_id IS NULL in transitions)
   — For most workflows this is a single entry stage
   — Multiple entry stages = parallel start
6. For each entry stage:
   a. Evaluate skip_condition against submission.metadata
      — If skip: stage_instance.status = SKIPPED; follow its outgoing edges immediately
      — If no skip: Activate stage (status=ACTIVE, started_at=now(), due_at=now()+due_days)
7. Run AutoAssignmentService for each activated stage
8. Dispatch SendNotificationJob for each activated stage's reviewers
9. Write audit_log: 'workflow_started'
```

#### `onStagePassed()` (replaces `advanceStage()`)

Called by `StageEvaluator` when a stage reaches PASSED. Handles fan-out to multiple next stages.

```
Input: passedStage (the stage_instance just marked PASSED)

1. Mark passedStage.status = PASSED
2. Load outgoing transitions: stage_transitions WHERE from_stage_id = passedStage.stage_definition_id
   sorted by priority DESC

3. If no outgoing transitions (terminal stage):
   a. Check if ALL stage_instances in run are terminal (PASSED | SKIPPED | FAILED)
   b. If yes:
      — Non-gated: WorkflowRun.status = COMPLETED
                   Submission.status = workflow_definition.final_status_on_pass
                   Write audit_log: 'submission_accepted'
      — Gated: gatekeeper_stage_instance.pending_release = true
               Notify gatekeeper users
   c. If no (other branches still running): do nothing; wait for remaining branches
   return

4. For each outgoing transition (ordered by priority DESC):
   a. If transition.condition is not null:
      — Evaluate condition against submission.metadata
      — If condition FALSE: skip this transition
      — If condition TRUE: activate target stage; skip remaining lower-priority transitions
        from the same source (first-match routing)
   b. If transition.condition is null (unconditional):
      — Activate target stage (always followed)

5. Activating a stage:
   a. Evaluate stage's own skip_condition
      — If skip: mark SKIPPED, recurse: call onStagePassed with the skipped stage
      — If no skip:
           stage_instance.status = ACTIVE
           stage_instance.started_at = now()
           stage_instance.due_at = now() + ConfigResolver::get('due_days', submissionTypeId, stageId)
           Run AutoAssignmentService
           Dispatch SendNotificationJob
```

**Parallel fan-out example:**

```
Stage: Initial Review
  Outgoing transitions (unconditional):
    → Ethics Review
    → Technical Review

  Both activated simultaneously when Initial Review passes.
  WorkflowRun only completes when BOTH Ethics Review AND Technical Review are PASSED.
```

**Conditional routing example:**

```
Stage: Screening
  Outgoing transitions (priority order):
    1. condition: metadata.involves_human_subjects = true  → Ethics Review (priority 10)
    2. unconditional                                       → Technical Review (priority 0)

  If condition TRUE:  Ethics Review activated; Technical Review NOT activated
  If condition FALSE: Technical Review activated directly
```

#### `handleRevisionRequired()`

```
1. Mark current stage REVISION_REQUIRED
2. WorkflowRun.status = SUPERSEDED
3. Submission.status = REVISION_REQUIRED
4. Write audit_log: 'revision_requested'
5. Notify submitter
```

#### `handleRevisionSubmitted()`

```
1. Increment submission.current_version
2. Create new SubmissionVersion record
3. Determine restart point (based on revision_restart_policy):
   a. FULL_RESTART: start from stage order = 1
   b. FAILED_STAGE_RESTART: start from stage whose last status was REVISION_REQUIRED
4. Create new WorkflowRun for new version
5. Create StageInstances (all PENDING); activate first stage per restart policy
6. Submission.status = IN_REVIEW
7. Write audit_log: 'revision_submitted'
8. Notify relevant reviewers
```

#### `skipStage()`

```
1. Validate: actor must be admin or coordinator
2. Mark StageInstance.status = SKIPPED
3. Call advanceStage() to continue
4. Write audit_log: 'stage_skipped'
```

---

### 2.2 `StageEvaluator`

Pure function — no side effects. Called after every decision is submitted.

```php
enum EvaluationResult
{
    case PENDING;             // Not enough decisions yet
    case PASSED;              // Approval condition met
    case REVISION_REQUIRED;   // At least one REQUEST_CHANGES, no REJECT
    case FAILED;              // At least one REJECT (outcome is final)
}

class StageEvaluator
{
    public function evaluate(StageInstance $stage): EvaluationResult;
}
```

#### Evaluation Algorithm

```
Input:
  decisions[]       – all review_decisions for this stage_instance
  assignees[]       – all active stage_assignments for this stage_instance
  stage_def         – the stage_definition (contains decision_options)
  execution_type    – PARALLEL | SEQUENTIAL
  approval_strategy – ALL | ANY | MAJORITY
  min_approvals     – int (used only when strategy = MAJORITY)

Step 1 – Resolve outcome for each decision
  For each decision, look up its value in stage_def.decision_options[].value
  Map to the corresponding outcome: "APPROVED" | "REVISION" | "REJECTED"
  If value not found in options: reject decision as invalid (should not happen post-validation)

Step 2 – Determine effective decisions
  For SEQUENTIAL: only consider decisions from reviewers up to sequential_position
  For PARALLEL: consider all decisions

Step 3 – Check for early termination
  If any decision's outcome = 'REJECTED':
      return FAILED    ← immediate; no further evaluation needed

Step 4 – Count by outcome
  approved_count  = count(decisions where outcome = 'APPROVED')
  revision_count  = count(decisions where outcome = 'REVISION')
  pending_count   = count(assignees) - count(decisions)

Step 5 – Check approval condition
  ALL:      approved_count == count(active_assignees)  → PASSED
  ANY:      approved_count >= 1                        → PASSED
  MAJORITY: approved_count >= min_approvals            → PASSED

Step 6 – If approval condition not met:
  If pending_count > 0:
      return PENDING    ← still waiting for more decisions
  Else (all decided, none approved):
      return REVISION_REQUIRED
```

---

### 2.3 `GatedReleaseService`

```php
class GatedReleaseService
{
    public function canRelease(WorkflowRun $run): bool;
    public function validateRelease(WorkflowRun $run, User $gatekeeper): void;
    public function issue(WorkflowRun $run, User $gatekeeper, string $decision, string $feedback): GatedRelease;
    public function requestRecheck(StageInstance $stage, User $gatekeeper): void;
}
```

#### `canRelease()` Preconditions

```
1. All stage_instances for run WHERE order > gatekeeper_stage_order have status = PASSED
2. No stage_instance for run has status IN (ACTIVE, PENDING)  
   (except the gatekeeper stage itself which may be ACTIVE/PASSED)
3. No existing GatedRelease for this workflow_run (one per run)
4. GatekeeperStage.pending_release = true
```

#### `issue()`

```
1. validateRelease() – throws if preconditions not met
2. Create GatedRelease record { decision, feedback, released_by, released_at }
3. Map release decision → submission status:
   ACCEPTED              → submission.status = ACCEPTED
   CONDITIONALLY_ACCEPTED → submission.status = CONDITIONALLY_ACCEPTED
   REVISION_REQUIRED     → submission.status = REVISION_REQUIRED, keep run ACTIVE
   REJECTED              → submission.status = REJECTED
4. If ACCEPTED or CONDITIONALLY_ACCEPTED or REJECTED:
   WorkflowRun.status = COMPLETED
5. Write audit_log: 'gated_release_issued'
6. Notify submitter
```

#### `requestRecheck()`

```
Called when gatekeeper wants a higher stage re-reviewed.
1. Validate: gatekeeper user is assigned to gatekeeper stage
2. Find the stage_instance to recheck (by order, must currently be PASSED)
3. Mark that stage_instance.status = ACTIVE (reopen it)
4. Increment stage_instance.recheck_count
5. stage_instance.due_at = now() + stage_definition.due_days
6. Write audit_log: 'stage_recheck_requested'
7. Notify stage reviewers
```

---

### 2.4 `VisibilityService`

Applied in API Resources before sending to client — never modify the raw models.

```php
class VisibilityService
{
    public function buildSubmissionView(Submission $s, User $viewer): SubmissionView;
    public function buildStageView(StageInstance $stage, User $viewer): StageView;
    public function buildDecisionView(ReviewDecision $d, User $viewer): ?DecisionView;
}
```

#### Visibility Rule Evaluation

For each stage, read `stage_definition.visibility_config`:

```json
{
  "decisions_visible_to": ["admin", "coordinator", "gatekeeper"],
  "feedback_visible_to": ["admin", "coordinator", "gatekeeper"],
  "reviewer_names_visible_to": ["admin", "coordinator", "gatekeeper", "committee"],
  "stage_progress_visible_to": ["admin", "coordinator", "gatekeeper", "submitter", "committee"]
}
```

Viewer's effective role for a submission is computed as:
1. If viewer is submitter → `submitter`
2. If viewer has `stage_assignments` entry for this stage → role from `stage_definition.role`
3. If viewer.roles contains `gatekeeper` and this is gatekeeper stage → `gatekeeper`
4. If viewer.roles contains `admin` → `admin`
5. If viewer.roles contains `coordinator` → `coordinator`
6. If viewer.roles contains `program_director` and submission.program_id matches → `program_director`

**Stripping rules:**
- If viewer's effective role NOT in `decisions_visible_to`: omit `decision` field from all `review_decisions` for that stage
- If viewer's effective role NOT in `feedback_visible_to`: omit `comments` field
- If viewer's effective role NOT in `reviewer_names_visible_to`: replace `reviewer_id` with anonymous token
- If viewer's effective role NOT in `stage_progress_visible_to`: omit the entire stage from response

---

### 2.5 `EscalationCheckJob` (Scheduled)

Runs every 15 minutes via Laravel scheduler.

```
For each StageInstance WHERE status = ACTIVE AND due_at < now():
    stage_def = stage_instance.stage_definition
    config    = stage_def.escalation_config

    if config.enabled = false: skip

    days_overdue = (now() - stage_instance.due_at) / 86400
    if days_overdue < config.escalate_after_days: skip

    already_escalated = exists escalation_log for this stage_instance within last 24h
    if already_escalated: skip

    action = config.action
    match action:
        NOTIFY_ONLY:
            Notify assigned reviewers + config.escalate_to_role users
        REASSIGN:
            Find available reviewer in reviewer_pool
            Update stage_assignment.is_active = false for current reviewer
            Create new stage_assignment for replacement
            Notify new reviewer
        ADD_PARALLEL_APPROVER:
            Find available reviewer in reviewer_pool
            Add new stage_assignment (now runs in parallel)
            Notify new reviewer

    Create escalation_log record
    Write audit_log: 'escalation_triggered'
```

---

## 3. Gated vs. Non-Gated Execution Flow

### Non-Gated (simple sequential)

```
Stage 1 (ACTIVE) → decisions → evaluate()
    │ PASSED
    ▼
Stage 2 (ACTIVE) → decisions → evaluate()
    │ PASSED
    ▼
Stage N (ACTIVE) → decisions → evaluate()
    │ PASSED
    ▼
WorkflowRun.COMPLETED → Submission.ACCEPTED
```

### Gated (dissertation/capstone model)

```
Stage 1 = Gatekeeper (Chair) — entry stage (no incoming edges)
Stage 2 = Committee Review — transition: Stage 1 → Stage 2
Stage 3 = Program Director — transition: Stage 2 → Stage 3

  Stage 1 (Chair): ACTIVE
      Chair can see nothing from higher stages yet
      Chair approves → onStagePassed fires → Stage 2 activates

  Stage 2 (Committee): ACTIVE
      Committee submits decisions
      Stage 2 PASSED → onStagePassed → Stage 3 activates

  Stage 3 (Program Director): ACTIVE
      PD submits decision
      Stage 3 PASSED → onStagePassed → no outgoing edges
      All stages terminal → gatekeeper_stage_instance.pending_release = true

  Chair issues GatedRelease:
      All stage data (stripped by VisibilityService) presented to chair
      Chair picks decision + writes feedback
      GatedRelease created → Submission status updated
```

---

## 4. Sequential Stage Execution (within one stage)

When `execution_type = SEQUENTIAL`, reviewers are activated one at a time:

```
stage_instance.sequential_position = 0

Position 0 reviewer receives notification, can submit decision
    │ decision submitted
    ▼
sequential_position incremented to 1
Position 1 reviewer.stage_assignment.is_active = true
    │ decision submitted
    ▼
sequential_position = 2 → no more reviewers
→ Evaluate with all collected decisions
```

---

## 5. Revision Handling Matrix

| Submission Type | `revision_restart_policy` | On REVISION_REQUIRED | Restart Point |
|---|---|---|---|
| Gated (Dissertation) | `FULL_RESTART` | All stages superseded | Stage 1 (Gatekeeper) |
| Non-Gated (simple) | `FAILED_STAGE_RESTART` | Current stage superseded | The failed stage |
| Admin-configured | Either | As configured | As defined |

---

## 7. Dynamic Workflow Features

### 7.1 Custom Decision Options

Each stage can define its own decision vocabulary. The UI renders the configured labels; the engine works on outcomes.

```json
// Example: Dissertation committee stage
"decision_options": [
  { "value": "PASS",          "label": "Pass",                    "outcome": "APPROVED" },
  { "value": "PASS_MINOR",    "label": "Pass with Minor Revisions","outcome": "APPROVED" },
  { "value": "MAJOR_REVISION","label": "Major Revision Required",  "outcome": "REVISION" },
  { "value": "FAIL",          "label": "Fail",                    "outcome": "REJECTED" }
]

// Example: IRB ethics review
"decision_options": [
  { "value": "APPROVED",        "label": "Ethics Approved",         "outcome": "APPROVED" },
  { "value": "APPROVED_MINOR",  "label": "Approved with Conditions","outcome": "APPROVED" },
  { "value": "RESUBMIT",        "label": "Resubmit with Revisions", "outcome": "REVISION" },
  { "value": "NOT_APPROVED",    "label": "Not Approved",            "outcome": "REJECTED" }
]
```

### 7.2 Conditional Stage Skip

The `skip_condition` on a `StageDefinition` is evaluated at `WorkflowEngine::startWorkflow()` time.

```
For each StageInstance created:
    condition = stage_definition.skip_condition
    if condition is null: continue (no skip)

    field_value = resolve_field(submission, condition.field)
    // 'metadata.funding_type', 'submission_type.slug', 'program.school', etc.

    match condition.operator:
        'eq':       skip = (field_value == condition.value)
        'neq':      skip = (field_value != condition.value)
        'contains': skip = (field_value contains condition.value)
        'exists':   skip = (field_value is not null)
        'not_exists': skip = (field_value is null)

    if skip:
        stage_instance.status = SKIPPED
        write audit_log: 'stage_auto_skipped', data: { condition, field_value }
```

Example use case: skip the IRB stage when `metadata.involves_human_subjects = false`.

### 7.3 Automatic Reviewer Assignment

When `auto_assignment.strategy != 'MANUAL'`, `WorkflowEngine::activateStage()` calls `AutoAssignmentService`.

```
AutoAssignmentService::assign(StageInstance $stage, StageDefinition $def):

    config = def.auto_assignment
    pool = reviewer_pools WHERE submission_type_id = submission.submission_type_id
                           AND (stage_role_label = config.pool_filter.stage_role_label OR stage_role_label IS NULL)

    if config.exclude_submitter_program:
        pool = pool MINUS users WHERE program_id = submission.program_id

    if config.strategy = POOL_RANDOM:
        selected = random sample of count from pool

    if config.strategy = POOL_ROUND_ROBIN:
        // Sort by: active review count ASC, then last assigned date ASC
        selected = top count from pool ordered by workload

    For each selected user:
        Create stage_assignment
        Mark is_active = true
        Dispatch SendNotificationJob('reviewer_assigned')
```

### 7.4 Gatekeeper Stage Identification

The `is_gatekeeper = true` flag on `stage_definitions` replaces the old `gatekeeper_stage_order` integer on `workflow_definitions`. Exactly one stage per workflow may have this flag.

Any user with an active `stage_assignment` on a gatekeeper stage sees the **Gated Reviews** interface. There is no separate global "chair" role.

### 7.5 Parallel Stage Groups

Native to the DAG model — not a future extension. Any stage with multiple outgoing unconditional transitions creates a parallel fork. The workflow completes only when all active branches are terminal.

```
Screening → Ethics Review  → \
          → Technical Review →  → Final Approval
          → Financial Review → /

All three branches run simultaneously.
Final Approval activates only when all three are PASSED.
```

`DAGWorkflowEngine::onStagePassed()` checks `allBranchesTerminal()` before activating downstream stages:

```
allBranchesTerminal(run):
    For each stage_instance in run:
        if status NOT IN (PASSED, SKIPPED, FAILED): return false
        BUT: stop at stages whose incoming edges are not yet all satisfied
             (i.e. if a stage has 2 incoming edges, both must be PASSED/SKIPPED)
    return true

// Convergence node (multiple incoming edges):
// Activated only when ALL incoming source stages are PASSED or SKIPPED
activateIfReady(toStage):
    incomingEdges = transitions WHERE to_stage_id = toStage.stage_definition_id
    For each edge in incomingEdges:
        sourceInstance = stage_instances WHERE stage_definition_id = edge.from_stage_id
        if sourceInstance.status NOT IN (PASSED, SKIPPED): return  // not ready yet
    activateStage(toStage)  // all prerequisites met
```

---

### 7.6 DAG Validation

`WorkflowDefinitionValidator` runs at workflow save time (not at execution time):

```
1. Build adjacency list from stage_transitions
2. Topological sort (Kahn's algorithm):
   a. Find all nodes with in-degree 0 (entry stages)
   b. BFS/iterative process
   c. If visited_count != total_stage_count: CYCLE DETECTED → reject save
3. Check: at least one entry stage exists (from_stage_id IS NULL transition)
4. Check: at least one terminal stage exists (no outgoing transitions)
5. Check: at most one stage per workflow has is_gatekeeper = true
```

A workflow fails validation and cannot be saved if any of these checks fail.

| Invariant | Enforcement |
|---|---|
| Only one ACTIVE WorkflowRun per submission | DB unique partial index on `workflow_runs(submission_id) WHERE status = 'ACTIVE'` |
| Decisions are never changed | DB rule prevents UPDATE on `review_decisions` |
| GatedRelease issued only once per run | DB unique index on `gated_releases(workflow_run_id)` |
| Stage can only be activated when all incoming edges are satisfied | `activateIfReady()` checks all source stages are PASSED/SKIPPED |
| Reviewer cannot submit decision for a stage they are not assigned to | Policy check in `DecisionController` |
| Submitter cannot see which reviewer voted which way (unless `reviewer_names_visible_to` includes 'submitter') | `VisibilityService` applied before every API response |
| An admin can skip a stage — but this is recorded in `audit_logs` | `skipStage()` writes audit entry |
