<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\ReviewerPool;
use App\Models\StageDefinition;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\SubmissionReviewerDocument;
use App\Services\NotificationService;
use App\Services\WorkflowAdvancer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            'stage:id,name,stage_role_label,order,is_gatekeeper,allows_finalize',
            'documents',
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

        // Auto-calculate due_at for the currently-active stage. Base the due date on
        // when the submission entered that stage (current_stage_entered_at), falling
        // back to now() if it has no recorded entry time yet.
        // Future stages are left null — their due date is populated when the stage
        // activates (see WorkflowAdvancer::notifyStageReviewers) or when the
        // coordinator finalizes assignments (see notify()).
        $stage = StageDefinition::find($data['stage_id']);
        $dueAt = $data['due_at'] ?? null;
        if ($dueAt === null && $stage && $stage->due_days) {
            if ($submission->current_stage_id === $stage->id) {
                $base = $submission->current_stage_entered_at ?? now();
                $dueAt = $base->copy()->addDays($stage->due_days)->toDateString();
            }
            // Future stage: leave null; populated when stage activates
        }

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

        // NOTE: the reviewer is NOT emailed here. Assignment emails are deferred until
        // the coordinator finalizes the panel (POST .../reviewers/notify, triggered by
        // the "Done" button), so reviewers are notified once — with a populated due
        // date — rather than on every individual selection.

        // ── DO NOT advance submission's current stage on assignment ─────────
        // current_stage_id is advanced only when a reviewer ACCEPTS (in update()),
        // not when they are merely assigned. This prevents the stage pointer from
        // jumping ahead before anyone has actually started reviewing.

        return response()->json(['data' => $this->toResource($reviewer)], 201);
    }

    /**
     * POST /api/submissions/{submissionId}/reviewers/notify
     *
     * Send the "you have been assigned" email to reviewers of the submission's
     * currently-active stage who have not been notified yet. Triggered when the
     * coordinator clicks "Done" in the Reviewer Assignments panel so reviewers are
     * emailed once assignments are finalized — with a populated due date — instead
     * of on every individual selection.
     *
     * Reviewers on future stages are intentionally not emailed here; they are
     * notified automatically when the workflow advances into their stage
     * (see WorkflowAdvancer::notifyStageReviewers).
     */
    public function notify(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::findOrFail($submissionId);

        if (!$submission->current_stage_id) {
            return response()->json([
                'notified' => 0,
                'message'  => 'No active stage yet — reviewers will be notified when the submission enters their stage.',
            ]);
        }

        $reviewers = SubmissionReviewer::with([
            'user:id,name,email,first_name,last_name',
            'stage:id,name,due_days',
        ])
            ->where('submission_id', $submissionId)
            ->where('stage_id', $submission->current_stage_id)
            ->where('status', 'pending')
            ->whereNull('assignment_notified_at')
            ->get();

        $svc   = app(NotificationService::class);
        $count = 0;

        foreach ($reviewers as $reviewer) {
            if (!$reviewer->user) {
                continue;
            }

            // Populate the due date before the email goes out so it is never blank.
            if ($reviewer->due_at === null && $reviewer->stage?->due_days) {
                $base = $submission->current_stage_entered_at ?? now();
                $reviewer->due_at = $base->copy()->addDays($reviewer->stage->due_days);
            }
            $reviewer->assignment_notified_at = now();
            $reviewer->save();

            $svc->notify($reviewer->user, Notification::TYPE_REVIEWER_ASSIGNED, [
                'submission_id'    => $submissionId,
                'submission_title' => $submission->title,
                'stage_name'       => $reviewer->stage?->name,
                'due_at'           => $reviewer->due_at?->toDateString(),
            ]);
            $count++;
        }

        return response()->json(['notified' => $count]);
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
            'finalize_workflow' => ['sometimes', 'boolean'],
            'comments' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'annotated_document' => [
                'sometimes',
                'nullable',
                'file',
                'max:25600', // 25 MB
                function ($attr, $value, $fail) {
                    $allowedExts = ['pdf', 'doc', 'docx'];
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (! in_array($ext, $allowedExts, true)) {
                        $fail("File extension '.{$ext}' is not allowed. Allowed: " . implode(', ', $allowedExts));
                        return;
                    }
                    $blockedMimes = [
                        'application/x-php', 'text/x-php', 'application/php',
                        'application/x-httpd-php', 'application/x-httpd-php-source',
                        'text/html', 'application/javascript', 'text/javascript',
                        'application/x-sh', 'application/x-executable',
                    ];
                    if (in_array($value->getMimeType() ?? '', $blockedMimes, true)) {
                        $fail('This file type is not permitted.');
                    }
                },
            ],
            'annotated_documents'   => ['sometimes', 'array', 'max:10'],
            'annotated_documents.*' => [
                'file',
                'max:25600', // 25 MB each
                function ($attr, $value, $fail) {
                    $allowedExts = ['pdf', 'doc', 'docx'];
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (! in_array($ext, $allowedExts, true)) {
                        $fail("File extension '.{$ext}' is not allowed. Allowed: " . implode(', ', $allowedExts));
                        return;
                    }
                    $blockedMimes = [
                        'application/x-php', 'text/x-php', 'application/php',
                        'application/x-httpd-php', 'application/x-httpd-php-source',
                        'text/html', 'application/javascript', 'text/javascript',
                        'application/x-sh', 'application/x-executable',
                    ];
                    if (in_array($value->getMimeType() ?? '', $blockedMimes, true)) {
                        $fail('This file type is not permitted.');
                    }
                },
            ],
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

        // Coordinators/admins may reassign reviewers and adjust due dates, but must NOT
        // submit approve/reject/revise decisions on a reviewer's behalf — doing so left
        // the workflow in an inconsistent, hung state. Only the assigned reviewer decides.
        // A coordinator who is themselves the assigned reviewer may still decide their own review.
        if (isset($data['decision']) && $isCoordinator && !$isReviewer) {
            return response()->json([
                'message' => 'Coordinators cannot approve or reject reviews. Please reassign the review to a reviewer instead.',
            ], 403);
        }

        // Once the submission has reached a terminal / finalized state, its reviewer
        // decisions are locked and can no longer be accepted, declined, or changed.
        if (isset($data['decision']) || isset($data['status'])) {
            $submissionForGuard = Submission::findOrFail($submissionId);
            $terminalStatuses = [
                Submission::STATUS_ACCEPTED,
                Submission::STATUS_CONDITIONALLY_ACCEPTED,
                Submission::STATUS_REJECTED,
                Submission::STATUS_WITHDRAWN,
                Submission::STATUS_CANCELLED,
                Submission::STATUS_APPEAL_PENDING,
            ];
            if (in_array($submissionForGuard->status, $terminalStatuses, true)) {
                return response()->json([
                    'message' => 'This submission has been finalized; reviewer decisions can no longer be changed.',
                ], 422);
            }
        }

        // Submitting a decision → auto-complete
        if (isset($data['decision'])) {
            $data['status'] = 'completed';
            $data['decision_at'] = now();
            // Finalizing clears any saved draft for this reviewer.
            $data['draft_comments'] = null;
            $data['draft_decision'] = null;
            $data['draft_saved_at'] = null;
            // Honor the finalize-vs-continue choice only on a decision-gate stage approval.
            $stageAllowsFinalize = (bool) optional(StageDefinition::find($reviewer->stage_id))->allows_finalize;
            $data['finalize_workflow'] = $stageAllowsFinalize
                && $data['decision'] === 'approve'
                && $request->boolean('finalize_workflow');
        }

        // Handle an optional annotated document uploaded by the reviewer.
        // Only the assigned reviewer may attach one, and only alongside their decision.
        if ($request->hasFile('annotated_document')) {
            if (!$isReviewer) {
                return response()->json(['message' => 'Only the assigned reviewer can upload an annotated document.'], 403);
            }

            $file = $request->file('annotated_document');
            $originalName = basename($file->getClientOriginalName());
            $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName) ?: '';
            $extension = strtolower($file->getClientOriginalExtension());
            if ($safeName === '' || ! str_contains($safeName, '.')) {
                $safeName = (string) Str::uuid() . ($extension ? ".{$extension}" : '');
            }

            // Remove any previously uploaded annotated document for this reviewer
            if ($reviewer->annotated_document_path && Storage::exists($reviewer->annotated_document_path)) {
                Storage::delete($reviewer->annotated_document_path);
            }

            $path = $file->storeAs("uploads/{$submissionId}/reviews/{$reviewer->id}", $safeName);
            $data['annotated_document_path'] = $path;
            $data['annotated_document_name'] = $originalName;
            $data['annotated_document_uploaded_at'] = now();
        }
        unset($data['annotated_document']);

        // Handle multiple reviewer feedback documents (annotations, handbook, examples…).
        // Only the assigned reviewer may attach files; each is appended to any already
        // uploaded so several files can be sent back to the chair.
        $uploadedDocs = $request->file('annotated_documents', []);
        if (!empty($uploadedDocs)) {
            if (!$isReviewer) {
                return response()->json(['message' => 'Only the assigned reviewer can upload feedback documents.'], 403);
            }
            foreach ($uploadedDocs as $file) {
                $originalName = basename($file->getClientOriginalName());
                $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName) ?: '';
                $extension = strtolower($file->getClientOriginalExtension());
                if ($safeName === '' || ! str_contains($safeName, '.')) {
                    $safeName = (string) Str::uuid() . ($extension ? ".{$extension}" : '');
                }
                $path = $file->storeAs(
                    "uploads/{$submissionId}/reviews/{$reviewer->id}",
                    Str::uuid() . '_' . $safeName,
                );
                SubmissionReviewerDocument::create([
                    'submission_reviewer_id' => $reviewer->id,
                    'path'        => $path,
                    'name'        => $originalName,
                    'size'        => $file->getSize(),
                    'uploaded_at' => now(),
                ]);
            }
        }

        $reviewer->update($data);

        // When a reviewer ACCEPTS, advance submission's current_stage_id if this stage
        // is more advanced than the current pointer. This is the correct place to do it
        // (not on assignment) so the stage only shows as active once someone accepts.
        if (isset($data['status']) && $data['status'] === 'accepted') {
            $submission = Submission::findOrFail($submissionId);
            $stageObj   = StageDefinition::find($reviewer->stage_id);
            if ($stageObj) {
                $currentStageOrder = $submission->current_stage_id
                    ? (StageDefinition::find($submission->current_stage_id)?->order ?? -1)
                    : -1;
                if ($stageObj->order > $currentStageOrder || $submission->current_stage_id === null) {
                    $stageEnteredAt = now();
                    $submission->update([
                        'current_stage_id'         => $stageObj->id,
                        'current_stage_entered_at' => $stageEnteredAt,
                    ]);

                    // Now that the stage is active, backfill due_at for any reviewers in
                    // this stage that were assigned before the stage started (due_at = null).
                    if ($stageObj->due_days) {
                        $newDueDate = $stageEnteredAt->copy()->addDays($stageObj->due_days)->toDateString();
                        SubmissionReviewer::where('submission_id', $submissionId)
                            ->where('stage_id', $stageObj->id)
                            ->whereNull('due_at')
                            ->update(['due_at' => $newDueDate]);
                    }
                }
            }
        }

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
     * GET /api/submissions/{submissionId}/reviewers/{reviewerId}/annotated-document
     *
     * Securely download the annotated document a reviewer attached to their decision.
     * Visibility mirrors reviewer-comment visibility: admins/coordinators, the uploading
     * reviewer, and the gatekeeper may always download it; the submitter (and other
     * viewers) may download it once it is releasable to them.
     */
    public function downloadAnnotatedDocument(Request $request, string $submissionId, string $reviewerId): mixed
    {
        $submission = Submission::with('submissionType:id,is_gated_review')->findOrFail($submissionId);
        $this->authorize('view', $submission);

        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        if (empty($reviewer->annotated_document_path)) {
            return response()->json(['message' => 'No annotated document found.'], 404);
        }

        if (!$this->canViewReviewerArtifacts($submission, $reviewer, $request->user())) {
            return response()->json(['message' => 'This annotated document is not available to you yet.'], 403);
        }

        if (! Storage::exists($reviewer->annotated_document_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::download(
            $reviewer->annotated_document_path,
            $reviewer->annotated_document_name ?: basename($reviewer->annotated_document_path),
        );
    }

    /**
     * POST /api/submissions/{submissionId}/reviewers/{reviewerId}/draft
     *
     * Persist the assigned reviewer's in-progress decision + comments so they
     * survive navigating away before submitting. Does not submit or advance.
     */
    public function saveDraft(Request $request, string $submissionId, string $reviewerId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        if ($reviewer->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the assigned reviewer can save a draft.'], 403);
        }

        $data = $request->validate([
            'draft_comments' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'draft_decision' => ['sometimes', 'nullable', 'in:approve,reject,revise,APPROVE,REJECT,REQUEST_CHANGES'],
        ]);

        $decision = $data['draft_decision'] ?? null;
        if ($decision !== null) {
            $decision = match (strtoupper($decision)) {
                'APPROVE', 'APPROVED' => 'approve',
                'REJECT', 'REJECTED'  => 'reject',
                'REQUEST_CHANGES', 'REVISION', 'REVISE' => 'revise',
                default => $decision,
            };
        }

        $reviewer->update([
            'draft_comments' => $data['draft_comments'] ?? null,
            'draft_decision' => $decision,
            'draft_saved_at' => now(),
        ]);

        $reviewer->load([
            'user:id,name,email,first_name,last_name,org_role',
            'assignedBy:id,name',
            'stage:id,name,stage_role_label,order',
            'documents',
        ]);

        return response()->json(['data' => $this->toResource($reviewer)]);
    }

    /**
     * GET /api/submissions/{submissionId}/reviewers/{reviewerId}/documents/{documentId}
     *
     * Download one of a reviewer's uploaded feedback documents. Visibility mirrors
     * the annotated-document rules (admins/coordinators, the uploading reviewer, the
     * gatekeeper, and the submitter once releasable).
     */
    public function downloadDocument(Request $request, string $submissionId, string $reviewerId, string $documentId): mixed
    {
        $submission = Submission::with('submissionType:id,is_gated_review')->findOrFail($submissionId);
        $this->authorize('view', $submission);

        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        if (!$this->canViewReviewerArtifacts($submission, $reviewer, $request->user())) {
            return response()->json(['message' => 'This document is not available to you yet.'], 403);
        }

        $doc = SubmissionReviewerDocument::where('submission_reviewer_id', $reviewer->id)
            ->where('id', $documentId)
            ->firstOrFail();

        if (! Storage::exists($doc->path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::download($doc->path, $doc->name ?: basename($doc->path));
    }

    /**
     * DELETE /api/submissions/{submissionId}/reviewers/{reviewerId}/documents/{documentId}
     *
     * Remove one of the reviewer's own uploaded feedback documents.
     */
    public function deleteDocument(Request $request, string $submissionId, string $reviewerId, string $documentId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        if ($reviewer->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the assigned reviewer can remove their uploaded documents.'], 403);
        }

        $doc = SubmissionReviewerDocument::where('submission_reviewer_id', $reviewer->id)
            ->where('id', $documentId)
            ->firstOrFail();

        if ($doc->path && Storage::exists($doc->path)) {
            Storage::delete($doc->path);
        }
        $doc->delete();

        return response()->json(['message' => 'Document removed.']);
    }

    /**
     * Whether $user is allowed to see a reviewer's artifacts (comments / annotated
     * document) for this submission. Mirrors the gated-review visibility rules.
     */
    private function canViewReviewerArtifacts(Submission $submission, SubmissionReviewer $reviewer, $user): bool
    {
        $roles = (array) ($user->roles ?? []);
        if (count(array_intersect($roles, ['admin', 'coordinator'])) > 0) {
            return true;
        }

        // The reviewer who uploaded it can always retrieve their own document.
        if ($reviewer->user_id === $user->id) {
            return true;
        }

        $isGated = $submission->submissionType?->is_gated_review ?? false;
        if (!$isGated) {
            // Non-gated: reviewer artifacts are visible as soon as they exist.
            return true;
        }

        // Gated review: the assigned gatekeeper can always see reviewer artifacts.
        $isGatekeeper = SubmissionReviewer::where('submission_id', $submission->id)
            ->where('user_id', $user->id)
            ->whereHas('stage', fn ($q) => $q->where('is_gatekeeper', true))
            ->exists();
        if ($isGatekeeper) {
            return true;
        }

        // Submitter / other viewers: only once the decision has been released.
        $finalized = in_array($submission->status, [
            Submission::STATUS_ACCEPTED,
            Submission::STATUS_CONDITIONALLY_ACCEPTED,
            Submission::STATUS_REJECTED,
            Submission::STATUS_REVISION_REQUIRED,
        ], true);

        return $finalized;
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

    // ── Extension request ─────────────────────────────────────────────────────

    /**
     * POST /api/submissions/{submissionId}/reviewers/{reviewerId}/request-extension
     * Reviewer requests more time; coordinator/admin approves/rejects.
     */
    public function requestExtension(Request $request, string $submissionId, string $reviewerId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        $user = $request->user();

        // Reviewer can only submit their own request; coord/admin can approve/reject
        $isCoordinator = $user->hasAnyRole(['admin', 'coordinator']);
        $isReviewer    = $reviewer->user_id === $user->id;

        if (!$isCoordinator && !$isReviewer) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($isReviewer && !$isCoordinator) {
            // Reviewer: submit new extension request
            $data = $request->validate([
                'reason'          => ['required', 'string', 'max:2000'],
                'requested_days'  => ['required', 'integer', 'min:1', 'max:90'],
            ]);

            // Enforce max_extension_requests
            $maxRequests = \App\Models\OrganizationSetting::current()->max_extension_requests ?? 3;
            if ($reviewer->extension_request_count >= $maxRequests) {
                return response()->json(['message' => "Maximum of {$maxRequests} extension request(s) allowed."], 422);
            }

            $reviewer->update([
                'extension_reason'          => $data['reason'],
                'extension_requested_days'  => $data['requested_days'],
                'extension_status'          => 'pending',
                'extension_requested_at'    => now(),
                'extension_resolved_at'     => null,
                'extension_request_count'   => $reviewer->extension_request_count + 1,
            ]);

            $submission = Submission::with('submitter')->find($submissionId);

            // Notify coordinators/admins
            $admins = \App\Models\User::whereJsonContains('roles', 'admin')
                ->orWhereJsonContains('roles', 'coordinator')
                ->get();
            if ($admins->isNotEmpty() && $submission) {
                app(NotificationService::class)->notify($admins->all(), Notification::TYPE_EXTENSION_REQUESTED, [
                    'submission_id'         => $submissionId,
                    'submission_title'      => $submission->title,
                    'reviewer_name'         => $user->name,
                    'requested_days'        => $data['requested_days'],
                    'reason'                => $data['reason'],
                ]);
            }

            // Notify the submitter that their review timeline may change
            if ($submission && $submission->submitter) {
                app(NotificationService::class)->notify($submission->submitter, Notification::TYPE_EXTENSION_REQUESTED, [
                    'submission_id'         => $submissionId,
                    'submission_title'      => $submission->title,
                    'requested_days'        => $data['requested_days'],
                    'message'               => 'A reviewer has requested a deadline extension of ' . $data['requested_days'] . ' additional days for your submission.',
                ]);
            }
        } else {
            // Coordinator/admin: approve or reject
            $data = $request->validate([
                'action' => ['required', 'in:approved,rejected'],
            ]);

            $reviewer->update([
                'extension_status'      => $data['action'],
                'extension_resolved_at' => now(),
            ]);

            if ($data['action'] === 'approved' && $reviewer->extension_requested_days) {
                $newDue = ($reviewer->due_at ? $reviewer->due_at->copy() : now())
                    ->addDays($reviewer->extension_requested_days);
                $reviewer->update(['due_at' => $newDue]);
                // Note: due_at is stored on submission_reviewers only; no separate stage_instances table exists.
            }

            $submission = Submission::with('submitter')->find($submissionId);

            // Notify the reviewer of the decision
            $reviewerUser = $reviewer->user()->first();
            if ($reviewerUser) {
                app(NotificationService::class)->notify($reviewerUser, Notification::TYPE_EXTENSION_RESOLVED, [
                    'submission_id'    => $submissionId,
                    'submission_title' => $submission?->title,
                    'action'           => $data['action'],
                    'message'          => 'Your deadline extension request was ' . $data['action'] . '.',
                ]);
            }

            // Notify the submitter about the outcome
            if ($submission && $submission->submitter) {
                app(NotificationService::class)->notify($submission->submitter, Notification::TYPE_EXTENSION_RESOLVED, [
                    'submission_id'    => $submissionId,
                    'submission_title' => $submission->title,
                    'action'           => $data['action'],
                    'message'          => 'The reviewer extension request for your submission was ' . $data['action'] . '.',
                ]);
            }
        }

        $reviewer->load(['user:id,name,email,first_name,last_name,org_role', 'assignedBy:id,name', 'stage:id,name,stage_role_label,order']);
        return response()->json(['data' => $this->toResource($reviewer)]);
    }

    // ── Conflict of interest ─────────────────────────────────────────────────

    /**
     * POST /api/submissions/{submissionId}/reviewers/{reviewerId}/flag-conflict
     * Reviewer flags a conflict of interest; coordinator/admin resolves by reassigning.
     */
    public function flagConflict(Request $request, string $submissionId, string $reviewerId): JsonResponse
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
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $reviewer->update([
            'conflict_flagged'    => true,
            'conflict_reason'     => $data['reason'],
            'conflict_flagged_at' => now(),
        ]);

        // Notify coordinators/admins
        $submission = Submission::find($submissionId);
        $admins = \App\Models\User::whereJsonContains('roles', 'admin')
            ->orWhereJsonContains('roles', 'coordinator')
            ->get();
        if ($admins->isNotEmpty() && $submission) {
            app(NotificationService::class)->notify($admins->all(), Notification::TYPE_CONFLICT_FLAGGED, [
                'submission_id'    => $submissionId,
                'submission_title' => $submission->title,
                'reviewer_name'    => $user->name,
                'reason'           => $data['reason'],
            ]);
        }

        AuditLog::create([
            'submission_id' => $submissionId,
            'actor_id'      => $user->id,
            'action'        => 'REVIEWER_CONFLICT_FLAGGED',
            'after_state'   => ['reviewer_id' => $reviewer->user_id, 'reason' => $data['reason']],
        ]);

        $reviewer->load(['user:id,name,email,first_name,last_name,org_role', 'assignedBy:id,name', 'stage:id,name,stage_role_label,order']);
        return response()->json(['data' => $this->toResource($reviewer)]);
    }

    // ── Resolve conflict of interest ──────────────────────────────────────────

    /**
     * POST /api/submissions/{submissionId}/reviewers/{reviewerId}/resolve-conflict
     * Coordinator/admin decides to let the reviewer continue or reassign.
     * action = 'continue' | 'reassign'
     */
    public function resolveConflict(Request $request, string $submissionId, string $reviewerId): JsonResponse
    {
        $reviewer = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('id', $reviewerId)
            ->firstOrFail();

        $this->authorize('viewAny', Submission::class); // admin/coordinator guard

        $data = $request->validate([
            'action' => ['required', 'in:continue,reassign'],
        ]);

        $submission = Submission::with('submitter')->find($submissionId);
        $reviewerUser = $reviewer->user()->first();

        if ($data['action'] === 'continue') {
            // Clear the conflict flag — reviewer may continue
            $reviewer->update([
                'conflict_flagged'    => false,
                'conflict_reason'     => null,
                'conflict_flagged_at' => null,
            ]);

            // Notify reviewer
            if ($reviewerUser) {
                app(NotificationService::class)->notify($reviewerUser, Notification::TYPE_CONFLICT_RESOLVED, [
                    'submission_id'    => $submissionId,
                    'submission_title' => $submission?->title,
                    'action'           => 'continue',
                    'message'          => 'The coordinator has reviewed your conflict declaration and confirmed you may continue as reviewer.',
                ]);
            }
        } else {
            // Remove the reviewer assignment so coordinator can assign someone else
            $reviewer->delete();

            // Notify the removed reviewer
            if ($reviewerUser) {
                app(NotificationService::class)->notify($reviewerUser, Notification::TYPE_CONFLICT_RESOLVED, [
                    'submission_id'    => $submissionId,
                    'submission_title' => $submission?->title,
                    'action'           => 'reassign',
                    'message'          => 'The coordinator has accepted your conflict declaration and removed you from this review. A new reviewer will be assigned.',
                ]);
            }

            AuditLog::create([
                'submission_id' => $submissionId,
                'actor_id'      => $request->user()->id,
                'action'        => 'REVIEWER_REMOVED_CONFLICT',
                'after_state'   => ['removed_reviewer_id' => $reviewer->user_id, 'reason' => $reviewer->conflict_reason],
            ]);

            return response()->json(['message' => 'Reviewer removed. You may now assign a replacement.'], 200);
        }

        $reviewer->load(['user:id,name,email,first_name,last_name,org_role', 'assignedBy:id,name', 'stage:id,name,stage_role_label,order']);
        return response()->json(['data' => $this->toResource($reviewer)]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * GET /api/admin/reviewer-pending-actions
     * Returns all pending extension requests, conflict declarations, and
     * incoming (unassigned) submissions — for coordinator/admin review.
     */
    public function pendingActions(Request $request): JsonResponse
    {
        // Pending extension requests
        $extensions = SubmissionReviewer::with([
            'user:id,name,email',
            'submission:id,title,submission_type_id',
            'submission.submissionType:id,label',
            'stage:id,name',
        ])
        ->where('extension_status', 'pending')
        ->orderBy('extension_requested_at', 'desc')
        ->get();

        // Conflict declarations (all flagged, coordinator must resolve by reassigning)
        $conflicts = SubmissionReviewer::with([
            'user:id,name,email',
            'submission:id,title,submission_type_id',
            'submission.submissionType:id,label',
            'stage:id,name',
        ])
        ->where('conflict_flagged', true)
        ->orderBy('conflict_flagged_at', 'desc')
        ->get();

        // Incoming / public submissions: submitted but awaiting reviewer assignment
        $unassigned = Submission::with([
            'submitter:id,name,email',
            'submissionType:id,label',
        ])
        ->whereIn('status', [
            Submission::STATUS_SUBMITTED,
            Submission::STATUS_AWAITING_REVIEWERS,
        ])
        ->orderBy('created_at', 'desc')
        ->limit(50)
        ->get();

        return response()->json([
            'extensions' => $extensions->map(fn($r) => [
                'id'                       => $r->id,
                'submission_id'            => $r->submission_id,
                'submission_title'         => $r->submission?->title,
                'submission_type'          => $r->submission?->submissionType?->label,
                'stage_name'               => $r->stage?->name,
                'reviewer_name'            => $r->user?->name,
                'reviewer_email'           => $r->user?->email,
                'extension_reason'         => $r->extension_reason,
                'extension_requested_days' => $r->extension_requested_days,
                'extension_requested_at'   => $r->extension_requested_at?->toIso8601String(),
                'due_at'                   => $r->due_at?->format('Y-m-d'),
            ]),
            'conflicts' => $conflicts->map(fn($r) => [
                'id'                  => $r->id,
                'submission_id'       => $r->submission_id,
                'submission_title'    => $r->submission?->title,
                'submission_type'     => $r->submission?->submissionType?->label,
                'stage_name'          => $r->stage?->name,
                'reviewer_name'       => $r->user?->name,
                'reviewer_email'      => $r->user?->email,
                'conflict_reason'     => $r->conflict_reason,
                'conflict_flagged_at' => $r->conflict_flagged_at?->toIso8601String(),
            ]),
            'unassigned' => $unassigned->map(fn($s) => [
                'id'         => $s->id,
                'title'      => $s->title,
                'type'       => $s->submissionType?->label,
                'submitter'  => $s->submitter?->name,
                'status'     => $s->status,
                'created_at' => $s->created_at->toIso8601String(),
            ]),
        ]);
    }

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
                'is_gatekeeper'    => $r->stage->is_gatekeeper ?? false,
                'allows_finalize'  => $r->stage->allows_finalize ?? false,
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
            // Reviewer's saved (unsubmitted) draft
            'draft_comments' => $r->draft_comments,
            'draft_decision' => $r->draft_decision,
            'draft_saved_at' => $r->draft_saved_at?->toIso8601String(),
            // Reviewer-uploaded annotated document (legacy single-file field)
            'annotated_document_name'        => $r->annotated_document_name,
            'annotated_document_uploaded_at' => $r->annotated_document_uploaded_at?->toIso8601String(),
            'has_annotated_document'         => !empty($r->annotated_document_path),
            // Reviewer feedback documents (multi-file)
            'documents' => $r->documents->map(fn ($d) => [
                'id'          => $d->id,
                'name'        => $d->name,
                'size'        => $d->size,
                'uploaded_at' => $d->uploaded_at?->toIso8601String(),
            ])->values(),
            // Extension request
            'extension_status'          => $r->extension_status,
            'extension_reason'          => $r->extension_reason,
            'extension_requested_days'  => $r->extension_requested_days,
            'extension_requested_at'    => $r->extension_requested_at?->toIso8601String(),
            'extension_resolved_at'     => $r->extension_resolved_at?->toIso8601String(),
            'extension_request_count'   => $r->extension_request_count ?? 0,
            // Conflict
            'conflict_flagged'          => $r->conflict_flagged ?? false,
            'conflict_reason'           => $r->conflict_reason,
            'conflict_flagged_at'       => $r->conflict_flagged_at?->toIso8601String(),
        ];
    }
}
