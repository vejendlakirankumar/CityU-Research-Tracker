<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\ReviewerPool;
use App\Models\StageDefinition;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Services\NotificationService;
use App\Services\WorkflowAdvancer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubmissionReviewerController extends Controller
{
    /**
     * GET /api/submissions/{submissionId}/reviewers
     *
     * Returns all reviewer assignments grouped by stage_id.
     * Also returns the reviewer pool suggestions for each stage
     * so the coordinator can see who is in the default pool.
     *
     * Query param: ?stage_id=X to filter to a single stage.
     */
    public function index(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::with('submissionType:id')->findOrFail($submissionId);
        $this->authorize('view', $submission);

        $query = SubmissionReviewer::with([
            'user:id,name,email,first_name,last_name,org_role',
            'assignedBy:id,name',
            'stage:id,name,stage_role_label,order',
        ])->where('submission_id', $submissionId);

        if ($request->filled('stage_id')) {
            $query->where('stage_id', $request->stage_id);
        }

        $reviewers = $query->orderBy('assigned_at')->get();

        return response()->json(['data' => $reviewers->map(fn($r) => $this->toResource($r))]);
    }

    /**
     * POST /api/submissions/{submissionId}/reviewers
     *
     * Assign a reviewer to a specific stage of this submission.
     * Only admin or coordinator can do this.
     */
    public function store(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::findOrFail($submissionId);

        $data = $request->validate([
            'stage_id' => ['required', 'uuid', 'exists:stage_definitions,id'],
            'user_id'  => ['required', 'uuid', 'exists:users,id'],
            'due_at'   => ['nullable', 'date'],
        ]);

        // Prevent duplicate
        if (SubmissionReviewer::where('submission_id', $submissionId)
            ->where('stage_id', $data['stage_id'])
            ->where('user_id', $data['user_id'])
            ->exists()) {
            return response()->json(['message' => 'This reviewer is already assigned to this stage.'], 422);
        }

        // Prevent assigning authors as reviewers (conflict of interest guard)
        $isAuthor = $submission->authors()
            ->where('user_id', $data['user_id'])
            ->exists();

        if ($isAuthor) {
            return response()->json([
                'message' => 'Cannot assign an author of this submission as a reviewer.',
            ], 422);
        }

        // Auto-calculate due_at from stage's due_days if not explicitly provided
        $stage = StageDefinition::find($data['stage_id']);
        $dueAt = $data['due_at'] ?? ($stage && $stage->due_days ? now()->addDays($stage->due_days)->toDateString() : null);

        $reviewer = SubmissionReviewer::create([
            'id'            => Str::uuid()->toString(),
            'submission_id' => $submissionId,
            'stage_id'      => $data['stage_id'],
            'user_id'       => $data['user_id'],
            'assigned_by'   => $request->user()->id,
            'status'        => 'pending',
            'due_at'        => $dueAt,
        ]);

        $reviewer->load([
            'user:id,name,email,first_name,last_name,org_role',
            'assignedBy:id,name',
            'stage:id,name,stage_role_label,order',
        ]);

        // Notify the assigned reviewer
        $reviewerUser = $reviewer->user;
        if ($reviewerUser) {
            app(NotificationService::class)->notify($reviewerUser, Notification::TYPE_REVIEWER_ASSIGNED, [
                'submission_id'    => $submissionId,
                'submission_title' => $submission->title,
                'stage_name'       => $reviewer->stage?->name,
            ]);
        }

        return response()->json(['data' => $this->toResource($reviewer)], 201);
    }

    /**
     * PATCH /api/submissions/{submissionId}/reviewers/{reviewerId}
     *
     * Reviewer accepts/declines. Coordinator can also update due_at.
     * When a reviewer submits their decision (decision + comments), status → completed.
     */
    public function update(Request $request, string $submissionId, string $reviewerId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        $user = $request->user();
        $isCoordinator = $user->hasAnyRole(['admin', 'coordinator']);
        $isReviewer    = $reviewer->user_id === $user->id;

        if (!$isCoordinator && !$isReviewer) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'status'   => ['sometimes', 'in:accepted,declined'],
            'due_at'   => ['sometimes', 'nullable', 'date'],
            'decision' => ['sometimes', 'nullable', 'in:approve,reject,revise,APPROVE,REJECT,REQUEST_CHANGES'],
            'comments' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);

        // Normalise decision values to lowercase canonical form
        if (isset($data['decision'])) {
            $data['decision'] = match(strtoupper($data['decision'])) {
                'APPROVE', 'APPROVED' => 'approve',
                'REJECT', 'REJECTED'  => 'reject',
                'REQUEST_CHANGES', 'REVISION', 'REVISE' => 'revise',
                default => $data['decision'],
            };
        }

        // Only the assigned reviewer can accept/decline
        if (isset($data['status']) && !$isReviewer) {
            return response()->json(['message' => 'Only the reviewer can accept or decline.'], 403);
        }

        // Submitting a decision → auto-complete
        if (isset($data['decision'])) {
            $data['status'] = 'completed';
            $data['decision_at'] = now();
        }

        $reviewer->update($data);

        // If a decision was submitted, evaluate the stage and auto-advance submission
        if (isset($data['decision'])) {
            $submission = Submission::findOrFail($submissionId);
            $advancer = app(WorkflowAdvancer::class);
            $advancer->evaluateAndAdvance($submission);

            // Notify admins/coordinators that a decision was submitted
            $reviewer->load('stage:id,name');
            $coordinators = \App\Models\User::whereJsonContains('roles', 'admin')
                ->orWhereJsonContains('roles', 'coordinator')
                ->get();
            if ($coordinators->isNotEmpty()) {
                app(NotificationService::class)->notify($coordinators->all(), Notification::TYPE_DECISION_SUBMITTED, [
                    'submission_id'    => $submissionId,
                    'submission_title' => $submission->title,
                    'stage_name'       => $reviewer->stage?->name,
                    'reviewer_name'    => $request->user()->name,
                    'decision'         => $data['decision'],
                ]);
            }

            // Write audit log for the decision
            AuditLog::create([
                'submission_id' => $submissionId,
                'actor_id'      => $request->user()->id,
                'action'        => 'REVIEWER_DECISION',
                'before_state'  => null,
                'after_state'   => [
                    'reviewer_id' => $reviewer->user_id,
                    'decision'    => $data['decision'],
                    'stage_id'    => $reviewer->stage_id,
                ],
            ]);
        }

        $reviewer->load([
            'user:id,name,email,first_name,last_name,org_role',
            'assignedBy:id,name',
            'stage:id,name,stage_role_label,order',
        ]);

        return response()->json(['data' => $this->toResource($reviewer)]);
    }

    /**
     * DELETE /api/submissions/{submissionId}/reviewers/{reviewerId}
     *
     * Remove a reviewer assignment. Admin/coordinator only.
     */
    public function destroy(string $submissionId, string $reviewerId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        $reviewer->delete();

        return response()->json(null, 204);
    }

    /**
     * GET /api/submissions/{submissionId}/reviewer-pool-suggestions?stage_id=X
     *
     * Returns the default reviewer pool for the submission's type + stage,
     * filtered to exclude already-assigned reviewers and the submission's authors.
     */
    public function poolSuggestions(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::findOrFail($submissionId);
        $this->authorize('view', $submission);

        $request->validate([
            'stage_id' => ['required', 'uuid'],
        ]);

        $stageId = $request->stage_id;

        // Already assigned reviewer user IDs for this stage
        $alreadyAssigned = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('stage_id', $stageId)
            ->pluck('user_id')
            ->toArray();

        // Author user IDs (conflict of interest)
        $authorUserIds = $submission->authors()
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->toArray();

        $exclude = array_unique(array_merge($alreadyAssigned, $authorUserIds));

        $pool = ReviewerPool::with('user:id,name,email,first_name,last_name,org_role')
            ->where('submission_type_id', $submission->submission_type_id)
            ->where('stage_id', $stageId)
            ->when(!empty($exclude), fn($q) => $q->whereNotIn('user_id', $exclude))
            ->orderBy('added_at')
            ->get();

        return response()->json([
            'data' => $pool->map(fn($p) => [
                'user_id' => $p->user_id,
                'user'    => [
                    'id'        => $p->user->id,
                    'name'      => $p->user->name,
                    'email'     => $p->user->email,
                    'org_role'  => $p->user->org_role,
                ],
            ]),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function toResource(SubmissionReviewer $r): array
    {
        return [
            'id'            => $r->id,
            'submission_id' => $r->submission_id,
            'stage_id'      => $r->stage_id,
            'stage'         => $r->relationLoaded('stage') ? [
                'id'               => $r->stage->id,
                'name'             => $r->stage->name,
                'stage_role_label' => $r->stage->stage_role_label,
                'order'            => $r->stage->order,
            ] : null,
            'user_id'       => $r->user_id,
            'user'          => $r->relationLoaded('user') ? [
                'id'        => $r->user->id,
                'name'      => $r->user->name,
                'email'     => $r->user->email,
                'org_role'  => $r->user->org_role,
            ] : null,
            'assigned_by'   => $r->assignedBy?->name,
            'assigned_at'   => $r->assigned_at,
            'status'        => $r->status,
            'due_at'        => $r->due_at,
            'decision'      => $r->decision,
            'decision_at'   => $r->decision_at?->toIso8601String(),
            'comments'      => $r->comments,
        ];
    }
}
