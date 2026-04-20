<?php

namespace App\Http\Controllers;

use App\Models\AppealRequest;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\SubmissionType;
use App\Models\SubmissionVersion;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SubmissionController extends Controller
{
    // ── Submissions ───────────────────────────────────────────────────────────

    /**
     * GET /api/submissions/my-reviews
     * Returns all submissions where the current user is an assigned reviewer,
     * enriched with the reviewer's own assignment record.
     */
    public function myReviews(Request $request): JsonResponse
    {
        $user = $request->user();

        $assignments = SubmissionReviewer::with([
            'submission' => fn($q) => $q->with([
                'submitter:id,name,email',
                'submissionType:id,slug,label',
                'program:id,name',
            ]),
            'stage:id,name,stage_role_label,order',
        ])
        ->where('user_id', $user->id)
        ->where('status', '!=', 'declined')
        ->orderBy('due_at')
        ->get();

        $data = $assignments->map(function ($a) {
            $s = $a->submission;
            if (!$s) return null;

            $today = now()->toDateString();
            $isOverdue = $a->due_at && $a->due_at->toDateString() < $today && $a->decision === null;
            $isDueSoon = $a->due_at && !$isOverdue && $a->due_at->toDateString() <= now()->addDays(3)->toDateString() && $a->decision === null;

            return [
                'assignment_id'   => $a->id,
                'assignment_status' => $a->status,
                'due_at'          => $a->due_at?->toDateString(),
                'decision'        => $a->decision,
                'decision_at'     => $a->decision_at?->toIso8601String(),
                'is_overdue'      => $isOverdue,
                'is_due_soon'     => $isDueSoon,
                'stage'           => $a->stage ? [
                    'id'    => $a->stage->id,
                    'name'  => $a->stage->name,
                    'role'  => $a->stage->stage_role_label,
                ] : null,
                'submission' => [
                    'id'              => $s->id,
                    'title'           => $s->title,
                    'status'          => $s->status,
                    'current_version' => $s->current_version,
                    'submission_type' => $s->submissionType ? [
                        'id'    => $s->submissionType->id,
                        'slug'  => $s->submissionType->slug,
                        'label' => $s->submissionType->label,
                    ] : null,
                    'submitter'       => [
                        'id'    => $s->submitter->id,
                        'name'  => $s->submitter->name,
                        'email' => $s->submitter->email,
                    ],
                    'created_at'      => $s->created_at,
                ],
            ];
        })->filter()->values();

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/submissions
     */
    public function index(Request $request): JsonResponse
    {        $user = $request->user();

        $query = Submission::with(['submitter:id,name,email', 'submissionType:id,slug,label', 'program:id,name'])
            ->visibleTo($user);

        // Filters
        if ($request->filled('status')) {
            $query->where('status', strtoupper($request->status));
        }

        if ($request->filled('type')) {
            $query->whereHas('submissionType', fn($q) => $q->where('slug', $request->type));
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(fn($q) => $q->where('title', 'ilike', $term)
                ->orWhere('abstract', 'ilike', $term));
        }

        $perPage = min((int) $request->get('per_page', 20), 100);
        $submissions = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $submissions->map(fn($s) => $this->toListItem($s)),
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'last_page'    => $submissions->lastPage(),
                'per_page'     => $submissions->perPage(),
                'total'        => $submissions->total(),
            ],
        ]);
    }

    /**
     * POST /api/submissions
     * Creates a new DRAFT submission.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'submission_type_id' => ['required', 'uuid', 'exists:submission_types,id'],
            'program_id'         => ['nullable', 'uuid', 'exists:programs,id'],
            'title'              => ['required', 'string', 'max:500'],
            'abstract'           => ['nullable', 'string', 'max:10000'],
            'metadata'           => ['nullable', 'array'],
        ]);

        $submission = Submission::create([
            ...$data,
            'submitter_id'    => $request->user()->id,
            'status'          => Submission::STATUS_DRAFT,
            'current_version' => 0,
            'metadata'        => $data['metadata'] ?? [],
        ]);

        $submission->load(['submitter:id,name,email', 'submissionType:id,slug,label', 'program:id,name']);

        return response()->json(['data' => $this->toDetail($submission)], 201);
    }

    /**
     * GET /api/submissions/{id}
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $submission = Submission::with([
            'submitter:id,name,email',
            'submissionType:id,slug,label,allowed_extensions,max_file_size_mb,max_files',
            'program:id,name',
            'versions',
        ])->findOrFail($id);

        $this->authorize('view', $submission);

        return response()->json(['data' => $this->toDetail($submission)]);
    }

    /**
     * PATCH /api/submissions/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('update', $submission);

        $data = $request->validate([
            'title'    => ['sometimes', 'string', 'max:500'],
            'abstract' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'metadata' => ['sometimes', 'array'],
            'program_id' => ['sometimes', 'nullable', 'uuid', 'exists:programs,id'],
        ]);

        $submission->update($data);
        $submission->load(['submitter:id,name,email', 'submissionType:id,slug,label', 'program:id,name']);

        return response()->json(['data' => $this->toDetail($submission)]);
    }

    /**
     * DELETE /api/submissions/{id}
     * Admin only — soft-cancels.
     */
    public function destroy(string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('delete', $submission);

        $submission->update(['status' => Submission::STATUS_CANCELLED]);

        return response()->json(null, 204);
    }

    /**
     * POST /api/submissions/{id}/submit
     * Moves a DRAFT submission to SUBMITTED.
     */
    public function submit(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('update', $submission);

        if ($submission->status !== Submission::STATUS_DRAFT
            && $submission->status !== Submission::STATUS_REVISION_REQUIRED) {
            return response()->json(['message' => 'Only DRAFT or REVISION_REQUIRED submissions can be submitted.'], 422);
        }

        if ($submission->versions()->count() === 0) {
            return response()->json(['message' => 'Upload at least one file before submitting.'], 422);
        }

        $submission->update([
            'status' => Submission::STATUS_SUBMITTED,
        ]);

        // Notify admins and coordinators of the new submission
        $coordinators = User::whereJsonContains('roles', 'admin')
            ->orWhereJsonContains('roles', 'coordinator')
            ->get();
        if ($coordinators->isNotEmpty()) {
            app(NotificationService::class)->notify($coordinators->all(), Notification::TYPE_SUBMISSION_SUBMITTED, [
                'submission_id'    => $submission->id,
                'submission_title' => $submission->title,
            ]);
        }

        return response()->json(['data' => $this->toDetail($submission->fresh(['submitter', 'submissionType', 'program', 'versions']))]);
    }

    /**
     * POST /api/submissions/{id}/withdraw
     */
    public function withdraw(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('withdraw', $submission);

        $submission->update(['status' => Submission::STATUS_WITHDRAWN]);

        return response()->json(['data' => $this->toDetail($submission->fresh(['submitter', 'submissionType', 'program', 'versions']))]);
    }

    // ── File versions ─────────────────────────────────────────────────────────

    /**
     * GET /api/submissions/{id}/versions
     */
    public function listVersions(string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('view', $submission);

        return response()->json(['data' => $submission->versions]);
    }

    /**
     * POST /api/submissions/{id}/versions
     * Uploads one or more files and creates a new SubmissionVersion.
     */
    public function uploadVersion(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('uploadVersion', $submission);

        // Load the submission type constraints
        $type = $submission->submissionType;
        $maxMb         = $type ? $type->max_file_size_mb : 8;
        $allowedExts   = $type ? $type->allowed_extensions : ['pdf', 'docx'];
        $maxFiles      = $type ? $type->max_files : 5;

        $request->validate([
            'files'          => ['required', 'array', 'min:1', "max:{$maxFiles}"],
            'files.*'        => [
                'file',
                'max:' . ($maxMb * 1024),
                function ($attr, $value, $fail) use ($allowedExts) {
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (! in_array($ext, $allowedExts)) {
                        $fail("File extension '.{$ext}' is not allowed. Allowed: " . implode(', ', $allowedExts));
                    }
                },
            ],
            'change_summary' => ['nullable', 'string', 'max:2000'],
        ]);

        $nextVersion = $submission->versions()->max('version_number') + 1;
        $storedPaths = [];

        foreach ($request->file('files') as $file) {
            $path = $file->store("uploads/{$submission->id}/v{$nextVersion}");
            $storedPaths[] = $path;
        }

        $version = SubmissionVersion::create([
            'submission_id'  => $submission->id,
            'version_number' => $nextVersion,
            'document_paths' => $storedPaths,
            'change_summary' => $request->change_summary,
            'submitted_at'   => now(),
            'created_by'     => $request->user()->id,
        ]);

        // Update submission's current version number
        $submission->update(['current_version' => $nextVersion]);

        return response()->json(['data' => $version], 201);
    }

    /**
     * GET /api/submissions/{id}/files/{version}/{filename}
     * Secure file download with authorization.
     */
    public function downloadFile(Request $request, string $id, int $version, string $filename): mixed
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('downloadFile', $submission);

        $path = "uploads/{$submission->id}/v{$version}/{$filename}";

        if (! Storage::exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::download($path, $filename);
    }

    // ── Student-facing endpoints ─────────────────────────────────────────────

    /**
     * GET /api/submissions/{id}/activity
     * Synthesised timeline of all events for this submission.
     */
    public function activityLog(string $id): JsonResponse
    {
        $submission = Submission::with([
            'submitter:id,name',
            'versions',
            'submissionType:id,is_blind_review',
            'reviewers' => function ($q) {
                $q->with(['user:id,name', 'stage:id,name'])->whereNotNull('decision_at');
            },
        ])->findOrFail($id);

        $this->authorize('view', $submission);

        $events = collect();

        // Submission created
        $events->push([
            'id'    => 'created',
            'type'  => 'created',
            'label' => 'Submission created',
            'date'  => $submission->created_at,
            'actor' => $submission->submitter->name ?? null,
        ]);

        // Version uploads
        foreach ($submission->versions as $v) {
            $events->push([
                'id'    => 'v_' . $v->id,
                'type'  => 'version_uploaded',
                'label' => 'Version ' . $v->version_number . ' uploaded',
                'date'  => $v->submitted_at,
                'note'  => $v->change_summary,
            ]);
        }

        // Reviewer decisions
        $isBlind = $submission->submissionType?->is_blind_review ?? false;
        foreach ($submission->reviewers as $r) {
            $decisionLabels = [
                'approve' => 'Approved by reviewer',
                'reject'  => 'Rejected by reviewer',
                'revise'  => 'Revision requested',
            ];
            $events->push([
                'id'       => 'review_' . $r->id,
                'type'     => 'review_decision',
                'label'    => $decisionLabels[$r->decision] ?? 'Reviewer decision made',
                'date'     => $r->decision_at,
                'actor'    => $isBlind ? null : $r->user?->name,
                'stage'    => $r->stage?->name,
                'decision' => $r->decision,
            ]);
        }

        // Audit logs specific to this submission
        $skip = ['AUTH_LOGIN', 'AUTH_LOGOUT'];
        $auditLogs = AuditLog::where('submission_id', $id)
            ->whereNotIn('action', $skip)
            ->orderBy('created_at')
            ->get();
        foreach ($auditLogs as $log) {
            $events->push([
                'id'    => 'audit_' . $log->id,
                'type'  => 'system',
                'label' => ucwords(strtolower(str_replace('_', ' ', $log->action))),
                'date'  => $log->created_at,
            ]);
        }

        return response()->json([
            'data' => $events->sortBy('date')->values(),
        ]);
    }

    /**
     * GET /api/submissions/{id}/feedback
     * Reviewer decisions + comments visible to the submitter.
     */
    public function feedback(string $id): JsonResponse
    {
        $submission = Submission::with('submissionType:id,is_blind_review')->findOrFail($id);
        $this->authorize('view', $submission);

        $isBlind = $submission->submissionType?->is_blind_review ?? false;

        $reviewers = $submission->reviewers()
            ->with(['user:id,name', 'stage:id,name,stage_role_label'])
            ->whereNotNull('decision')
            ->orderBy('decision_at')
            ->get();

        $feedbackItems = $reviewers->map(fn ($r) => [
            'id'          => $r->id,
            'stage'       => $r->stage ? [
                'id'   => $r->stage->id,
                'name' => $r->stage->name,
                'role' => $r->stage->stage_role_label,
            ] : null,
            'decision'    => $r->decision,
            'decision_at' => $r->decision_at,
            'comments'    => $r->comments,
            'reviewer'    => $isBlind ? null : ($r->user ? ['name' => $r->user->name] : null),
        ]);

        $appeal = AppealRequest::where('submission_id', $id)->latest()->first();

        return response()->json([
            'data'   => $feedbackItems->values(),
            'appeal' => $appeal ? [
                'id'              => $appeal->id,
                'status'          => $appeal->status,
                'grounds'         => $appeal->grounds,
                'resolution_note' => $appeal->resolution_note,
                'created_at'      => $appeal->created_at,
            ] : null,
        ]);
    }

    /**
     * POST /api/submissions/{id}/appeal
     * Submit an appeal for a rejected submission.
     */
    public function submitAppeal(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('view', $submission);

        if ($submission->status !== Submission::STATUS_REJECTED) {
            return response()->json(['message' => 'Only rejected submissions can be appealed.'], 422);
        }

        $existing = AppealRequest::where('submission_id', $id)
            ->whereIn('status', [AppealRequest::STATUS_PENDING, AppealRequest::STATUS_UNDER_REVIEW])
            ->exists();
        if ($existing) {
            return response()->json(['message' => 'An appeal is already pending.'], 422);
        }

        $data = $request->validate([
            'grounds' => ['required', 'string', 'min:20', 'max:5000'],
        ]);

        $appeal = AppealRequest::create([
            'submission_id' => $id,
            'submitter_id'  => Auth::id(),
            'grounds'       => $data['grounds'],
            'status'        => AppealRequest::STATUS_PENDING,
        ]);

        // Mark submission as appeal-pending so it surfaces in appeals queue
        $submission->update(['status' => Submission::STATUS_APPEAL_PENDING]);

        return response()->json([
            'data' => [
                'id'         => $appeal->id,
                'status'     => $appeal->status,
                'grounds'    => $appeal->grounds,
                'created_at' => $appeal->created_at,
            ],
        ], 201);
    }

    /**
     * GET /api/submissions/{id}/review-progress
     * Returns workflow stage progress with reviewer assignment status.
     */
    public function reviewProgress(string $id): JsonResponse
    {
        $submission = Submission::with([
            'submissionType.workflow.stages',
            'reviewers.user',
        ])->findOrFail($id);

        $this->authorize('view', $submission);

        $stages = $submission->submissionType?->workflow?->stages ?? collect();

        $isBlind       = $submission->submissionType?->is_blind_review ?? false;
        $allowMeetings = $submission->submissionType?->allow_meetings ?? false;

        if ($stages->isEmpty()) {
            return response()->json(['data' => [], 'is_blind' => $isBlind, 'allow_meetings' => $allowMeetings]);
        }

        // Admins/coordinators always see reviewer names even in blind reviews
        $requestingUser = request()->user();
        $isAdminOrCoord = $requestingUser->hasAnyRole(['admin', 'coordinator']);
        $showReviewers  = !$isBlind || $isAdminOrCoord;

        $reviewers = $submission->reviewers;

        $isActive = in_array($submission->status, [
            Submission::STATUS_AWAITING_REVIEWERS,
            Submission::STATUS_IN_REVIEW,
            Submission::STATUS_REVISION_REQUIRED,
        ]);

        $isComplete = in_array($submission->status, [
            Submission::STATUS_ACCEPTED,
            Submission::STATUS_CONDITIONALLY_ACCEPTED,
            Submission::STATUS_REJECTED,
        ]);

        $stageData = $stages->map(function ($stage) use ($reviewers, $isActive, $isComplete, $showReviewers) {
            $stageReviewers = $reviewers->where('stage_id', $stage->id);
            $total     = $stageReviewers->count();
            $completed = $stageReviewers->filter(fn($r) => $r->decision !== null)->count();

            if ($isComplete) {
                $status = 'completed';
            } elseif ($total === 0) {
                $status = $isActive ? 'needs_assignment' : 'pending';
            } elseif ($completed === $total) {
                $status = 'completed';
            } elseif ($completed > 0) {
                $status = 'in_progress';
            } else {
                $status = 'assigned';
            }

            $decisions = $stageReviewers->filter(fn($r) => $r->decision !== null)->pluck('decision');
            $outcome = null;
            if ($decisions->isNotEmpty()) {
                if ($decisions->contains('reject')) {
                    $outcome = 'rejected';
                } elseif ($decisions->contains('revise')) {
                    $outcome = 'revision';
                } elseif ($decisions->every(fn($d) => $d === 'approve')) {
                    $outcome = 'approved';
                }
            }

            return [
                'id'              => $stage->id,
                'name'            => $stage->name,
                'order'           => $stage->order,
                'role_label'      => $stage->stage_role_label,
                'reviewers_count' => $total,
                'completed_count' => $completed,
                'status'          => $status,
                'outcome'         => $outcome,
                'min_approvals'   => $stage->min_approvals,
                'due_days'        => $stage->due_days ?: null,
                'reviewers'       => $showReviewers
                    ? $stageReviewers->map(fn($r) => [
                        'id'     => $r->id,
                        'name'   => $r->user?->name,
                        'status' => $r->status,
                        'due_at' => $r->due_at?->toDateString(),
                    ])->values()
                    : null,
            ];
        });

        return response()->json([
            'data'          => $stageData->values(),
            'is_blind'      => $isBlind,
            'allow_meetings' => $allowMeetings,
        ]);
    }

    /**
     * POST /api/submissions/{id}/advance-review
     * Admin/coordinator: SUBMITTED → AWAITING_REVIEWERS, or AWAITING_REVIEWERS → IN_REVIEW.
     */
    public function advanceReview(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $roles = $request->user()->roles ?? [];

        if (!in_array('admin', $roles) && !in_array('coordinator', $roles)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($submission->status === Submission::STATUS_SUBMITTED) {
            $submission->update(['status' => Submission::STATUS_AWAITING_REVIEWERS]);
        } elseif ($submission->status === Submission::STATUS_AWAITING_REVIEWERS) {
            if (!$submission->reviewers()->exists()) {
                return response()->json([
                    'message' => 'Assign at least one reviewer before starting the review.',
                ], 422);
            }
            $submission->update(['status' => Submission::STATUS_IN_REVIEW]);
        } else {
            return response()->json([
                'message' => 'Submission cannot be advanced from its current status.',
            ], 422);
        }

        return response()->json([
            'data' => $this->toDetail($submission->fresh(['submitter', 'submissionType', 'program', 'versions'])),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function toListItem(Submission $s): array
    {
        return [
            'id'              => $s->id,
            'title'           => $s->title,
            'status'          => $s->status,
            'current_version' => $s->current_version,
            'submission_type' => $s->submissionType ? [
                'id'    => $s->submissionType->id,
                'slug'  => $s->submissionType->slug,
                'label' => $s->submissionType->label,
            ] : null,
            'program'         => $s->program ? [
                'id'   => $s->program->id,
                'name' => $s->program->name,
            ] : null,
            'submitter'       => [
                'id'    => $s->submitter->id,
                'name'  => $s->submitter->name,
                'email' => $s->submitter->email,
            ],
            'created_at'      => $s->created_at,
            'updated_at'      => $s->updated_at,
        ];
    }

    private function toDetail(Submission $s): array
    {
        $base = $this->toListItem($s);
        $base['abstract']  = $s->abstract;
        $base['metadata']  = $s->metadata;
        $base['is_locked'] = $s->is_locked;
        $base['versions']  = $s->relationLoaded('versions')
            ? $s->versions->map(fn($v) => [
                'id'             => $v->id,
                'version_number' => $v->version_number,
                'document_paths' => $v->document_paths,
                'change_summary' => $v->change_summary,
                'submitted_at'   => $v->submitted_at,
                'file_count'     => count($v->document_paths),
            ])->values()
            : [];

        return $base;
    }
}
