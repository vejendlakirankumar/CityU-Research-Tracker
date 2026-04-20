<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\GatedRelease;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GatedReleaseController extends Controller
{
    // ── List ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/gated-reviews
     * Returns submissions that need a gated release decision (PENDING_RELEASE)
     * plus recently decided ones (ACCEPTED / CONDITIONALLY_ACCEPTED / REJECTED
     * with a gated_release record).
     */
    public function index(Request $request): JsonResponse
    {
        $pending = Submission::with([
            'submitter:id,name,email',
            'submissionType:id,slug,label,is_gated_review',
            'program:id,name',
        ])
        ->whereHas('submissionType', fn ($q) => $q->where('is_gated_review', true))
        ->where('status', Submission::STATUS_PENDING_RELEASE)
        ->orderBy('updated_at', 'desc')
        ->get();

        $decided = Submission::with([
            'submitter:id,name,email',
            'submissionType:id,slug,label,is_gated_review',
            'program:id,name',
        ])
        ->whereHas('submissionType', fn ($q) => $q->where('is_gated_review', true))
        ->whereIn('status', [
            Submission::STATUS_ACCEPTED,
            Submission::STATUS_CONDITIONALLY_ACCEPTED,
            Submission::STATUS_REJECTED,
        ])
        ->whereHas('gatedReleases')
        ->orderBy('updated_at', 'desc')
        ->limit(20)
        ->get();

        $format = fn (Submission $s) => [
            'id'              => $s->id,
            'title'           => $s->title,
            'status'          => $s->status,
            'submitter_name'  => $s->submitter?->name,
            'submission_type' => $s->submissionType?->label,
            'program'         => $s->program?->name,
            'current_version' => $s->current_version,
            'updated_at'      => $s->updated_at,
        ];

        return response()->json([
            'pending'        => $pending->map($format)->values(),
            'recently_decided' => $decided->map($format)->values(),
        ]);
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    /**
     * GET /api/gated-reviews/{submissionId}
     * Full submission detail with reviewer decisions and any gated release record.
     */
    public function show(string $submissionId): JsonResponse
    {
        $submission = Submission::with([
            'submitter:id,name,email,organization',
            'submissionType:id,slug,label,is_gated_review',
            'program:id,name',
            'versions',
            'authors.user:id,name,email',
            'reviewers.user:id,name,email',
            'reviewers.stage:id,name,stage_role_label,order',
        ])
        ->whereHas('submissionType', fn ($q) => $q->where('is_gated_review', true))
        ->findOrFail($submissionId);

        $latestRelease = GatedRelease::with('releasedBy:id,name,email')
            ->where('submission_id', $submissionId)
            ->latest('released_at')
            ->first();

        // Group reviewer decisions by stage
        $stages = $submission->reviewers
            ->groupBy('stage_id')
            ->map(function ($stageReviewers) {
                $first = $stageReviewers->first();
                return [
                    'stage_id'     => $first->stage_id,
                    'stage_name'   => $first->stage?->name,
                    'stage_role'   => $first->stage?->stage_role_label,
                    'order'        => $first->stage?->order,
                    'reviewers'    => $stageReviewers->map(fn ($r) => [
                        'reviewer_id'   => $r->user_id,
                        'reviewer_name' => $r->user?->name,
                        'decision'      => $r->decision,
                        'decision_at'   => $r->decision_at,
                        'comments'      => $r->comments,
                        'status'        => $r->status,
                    ])->values(),
                ];
            })
            ->sortBy('order')
            ->values();

        return response()->json([
            'id'              => $submission->id,
            'title'           => $submission->title,
            'abstract'        => $submission->abstract,
            'status'          => $submission->status,
            'current_version' => $submission->current_version,
            'submitter'       => $submission->submitter ? [
                'id'           => $submission->submitter->id,
                'name'         => $submission->submitter->name,
                'email'        => $submission->submitter->email,
                'organization' => $submission->submitter->organization,
            ] : null,
            'submission_type' => $submission->submissionType ? [
                'id'              => $submission->submissionType->id,
                'label'           => $submission->submissionType->label,
                'is_gated_review' => $submission->submissionType->is_gated_review,
            ] : null,
            'program'         => $submission->program ? [
                'id'   => $submission->program->id,
                'name' => $submission->program->name,
            ] : null,
            'versions'        => $submission->versions->map(fn ($v) => [
                'version_number' => $v->version_number,
                'filename'       => $v->filename,
                'submitted_at'   => $v->submitted_at,
            ])->values(),
            'review_stages'   => $stages,
            'gated_release'   => $latestRelease ? [
                'id'          => $latestRelease->id,
                'decision'    => $latestRelease->decision,
                'feedback'    => $latestRelease->feedback,
                'released_by' => $latestRelease->releasedBy?->name,
                'released_at' => $latestRelease->released_at,
            ] : null,
            'updated_at'      => $submission->updated_at,
        ]);
    }

    // ── Issue release ─────────────────────────────────────────────────────────

    /**
     * POST /api/gated-reviews
     * Issue a gated release decision. Body: { submission_id, decision, feedback? }
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'submission_id' => ['required', 'uuid'],
            'decision'      => ['required', 'in:ACCEPTED,CONDITIONALLY_ACCEPTED,REVISION_REQUIRED,REJECTED'],
            'feedback'      => ['nullable', 'string', 'max:5000'],
        ]);

        $submission = Submission::whereHas('submissionType', fn ($q) => $q->where('is_gated_review', true))
            ->where('status', Submission::STATUS_PENDING_RELEASE)
            ->findOrFail($data['submission_id']);

        // Map gated decision → submission status
        $statusMap = [
            GatedRelease::DECISION_ACCEPTED               => Submission::STATUS_ACCEPTED,
            GatedRelease::DECISION_CONDITIONALLY_ACCEPTED => Submission::STATUS_CONDITIONALLY_ACCEPTED,
            GatedRelease::DECISION_REVISION_REQUIRED      => Submission::STATUS_REVISION_REQUIRED,
            GatedRelease::DECISION_REJECTED               => Submission::STATUS_REJECTED,
        ];
        $newStatus = $statusMap[$data['decision']];

        $release = GatedRelease::create([
            'submission_id'   => $submission->id,
            'workflow_run_id' => $submission->id, // simplified — reuse submission id as placeholder
            'version_number'  => $submission->current_version,
            'decision'        => $data['decision'],
            'feedback'        => $data['feedback'] ?? null,
            'released_by'     => $request->user()->id,
            'released_at'     => now(),
        ]);

        $oldStatus = $submission->status;
        $submission->update(['status' => $newStatus]);

        AuditLog::create([
            'submission_id' => $submission->id,
            'actor_id'      => $request->user()->id,
            'action'        => 'GATED_RELEASE_ISSUED',
            'before_state'  => ['status' => $oldStatus],
            'after_state'   => ['status' => $newStatus, 'decision' => $data['decision']],
        ]);

        app(NotificationService::class)->notifyStatusChange($submission->fresh(), $newStatus);

        return response()->json([
            'message'    => 'Release decision issued successfully.',
            'submission' => ['id' => $submission->id, 'status' => $newStatus],
            'release'    => [
                'id'          => $release->id,
                'decision'    => $release->decision,
                'feedback'    => $release->feedback,
                'released_at' => $release->released_at,
            ],
        ], 201);
    }

    // ── Recheck ───────────────────────────────────────────────────────────────

    /**
     * POST /api/gated-reviews/{submissionId}/recheck
     * Request re-check — resets back to IN_REVIEW so reviewers can reconsider.
     * Body: { reason }
     */
    public function recheck(Request $request, string $submissionId): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $submission = Submission::whereHas('submissionType', fn ($q) => $q->where('is_gated_review', true))
            ->where('status', Submission::STATUS_PENDING_RELEASE)
            ->findOrFail($submissionId);

        $oldStatus = $submission->status;
        $submission->update(['status' => Submission::STATUS_IN_REVIEW]);

        AuditLog::create([
            'submission_id' => $submission->id,
            'actor_id'      => $request->user()->id,
            'action'        => 'GATED_RECHECK_REQUESTED',
            'before_state'  => ['status' => $oldStatus],
            'after_state'   => ['status' => Submission::STATUS_IN_REVIEW, 'reason' => $data['reason']],
        ]);

        app(NotificationService::class)->notifyStatusChange($submission->fresh(), Submission::STATUS_IN_REVIEW);

        return response()->json(['message' => 'Recheck requested. Submission returned to in-review.']);
    }
}
