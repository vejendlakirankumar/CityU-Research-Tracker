<?php

namespace App\Http\Controllers;

use App\Models\AppealRequest;
use App\Models\AuditLog;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppealController extends Controller
{
    /**
     * GET /api/appeals
     * Admin list of all appeal requests.
     */
    public function index(Request $request): JsonResponse
    {
        $appeals = AppealRequest::with([
            'submission:id,title,status,submitter_id',
            'submitter:id,name,email',
            'resolver:id,name',
        ])
        ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
        ->orderBy('created_at', 'desc')
        ->paginate(25);

        return response()->json([
            'data' => $appeals->items(),
            'meta' => [
                'current_page' => $appeals->currentPage(),
                'last_page'    => $appeals->lastPage(),
                'total'        => $appeals->total(),
            ],
        ]);
    }

    /**
     * GET /api/appeals/{id}
     */
    public function show(string $id): JsonResponse
    {
        $appeal = AppealRequest::with([
            'submission:id,title,status,submitter_id',
            'submitter:id,name,email',
            'resolver:id,name',
        ])->findOrFail($id);

        return response()->json($appeal);
    }

    /**
     * PATCH /api/appeals/{id}
     * Coordinator/admin decision on an appeal:
     *   UNDER_REVIEW → the appeal is being considered (no change to the outcome yet)
     *   UPHELD       → the appeal succeeds; the submission is reopened for re-review
     *   DISMISSED    → the appeal fails; the original rejection stands
     *
     * Once an appeal is UPHELD or DISMISSED the decision is final and cannot change.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $appeal = AppealRequest::findOrFail($id);

        // A final decision has already been recorded — do not allow it to change.
        if (in_array($appeal->status, [AppealRequest::STATUS_UPHELD, AppealRequest::STATUS_DISMISSED], true)) {
            return response()->json([
                'message' => 'This appeal has already been resolved and can no longer be changed.',
            ], 422);
        }

        $data = $request->validate([
            'status'          => ['required', 'in:UNDER_REVIEW,UPHELD,DISMISSED'],
            'resolution_note' => ['nullable', 'string', 'max:5000'],
        ]);

        $oldStatus = $appeal->status;
        $appeal->update([
            'status'          => $data['status'],
            'resolution_note' => $data['resolution_note'] ?? $appeal->resolution_note,
            'reviewed_by'     => $request->user()->id,
            'reviewed_at'     => now(),
        ]);

        $submission = Submission::find($appeal->submission_id);

        if ($data['status'] === AppealRequest::STATUS_UPHELD && $submission) {
            // Appeal succeeds: reopen the submission at the stage that produced the
            // rejection so reviewers can reconsider.
            $prevStatus = $submission->status;
            $this->reopenForReview($submission);

            AuditLog::create([
                'submission_id' => $submission->id,
                'actor_id'      => $request->user()->id,
                'action'        => 'APPEAL_UPHELD',
                'before_state'  => ['status' => $prevStatus, 'appeal_status' => $oldStatus],
                'after_state'   => ['status' => Submission::STATUS_IN_REVIEW, 'appeal_status' => $data['status']],
            ]);

            app(NotificationService::class)->notifyStatusChange($submission->fresh(), Submission::STATUS_IN_REVIEW);

        } elseif ($data['status'] === AppealRequest::STATUS_DISMISSED && $submission) {
            // Appeal fails: the original rejection stands.
            $prevStatus = $submission->status;
            if ($submission->status === Submission::STATUS_APPEAL_PENDING) {
                $submission->update(['status' => Submission::STATUS_REJECTED]);
                app(NotificationService::class)->notifyStatusChange($submission->fresh(), Submission::STATUS_REJECTED);
            }

            AuditLog::create([
                'submission_id' => $submission->id,
                'actor_id'      => $request->user()->id,
                'action'        => 'APPEAL_DISMISSED',
                'before_state'  => ['status' => $prevStatus, 'appeal_status' => $oldStatus],
                'after_state'   => ['status' => $submission->fresh()->status, 'appeal_status' => $data['status']],
            ]);

        } else {
            // UNDER_REVIEW — being considered; the submission outcome is unchanged.
            AuditLog::create([
                'submission_id' => $appeal->submission_id,
                'actor_id'      => $request->user()->id,
                'action'        => 'APPEAL_UNDER_REVIEW',
                'before_state'  => ['appeal_status' => $oldStatus],
                'after_state'   => ['appeal_status' => $data['status']],
            ]);
        }

        $appeal->load('resolver:id,name');

        return response()->json([
            'id'               => $appeal->id,
            'status'           => $appeal->status,
            'resolution_note'  => $appeal->resolution_note,
            'reviewed_at'      => $appeal->reviewed_at,
            'reviewed_by_name' => $appeal->resolver?->name,
        ]);
    }

    /**
     * Reopen a submission for re-review after an appeal is upheld. Resets the
     * reviewer decisions on the stage that most recently decided (the stage that
     * produced the rejection), points the workflow back at that stage, and
     * returns the submission to IN_REVIEW.
     */
    private function reopenForReview(Submission $submission): void
    {
        $lastDecided = SubmissionReviewer::where('submission_id', $submission->id)
            ->whereNotNull('decision_at')
            ->orderByDesc('decision_at')
            ->first();

        // Clear any pending-gatekeeper markers left over from the release flow.
        $metadata = $submission->metadata ?? [];
        unset(
            $metadata['pending_gatekeeper_stage_id'],
            $metadata['pending_gatekeeper_stage_name'],
            $metadata['pending_gatekeeper_stage_outcome']
        );

        $update = [
            'status'   => Submission::STATUS_IN_REVIEW,
            'metadata' => $metadata,
        ];

        if ($lastDecided) {
            $stageId = $lastDecided->stage_id;

            // Reset that stage's reviewer decisions so they can reconsider.
            SubmissionReviewer::where('submission_id', $submission->id)
                ->where('stage_id', $stageId)
                ->update([
                    'decision'    => null,
                    'decision_at' => null,
                    'comments'    => null,
                    'status'      => 'pending',
                ]);

            $update['current_stage_id']         = $stageId;
            $update['current_stage_entered_at'] = now();

            // Notify that stage's reviewers to re-review.
            $stageReviewers = SubmissionReviewer::with('user')
                ->where('submission_id', $submission->id)
                ->where('stage_id', $stageId)
                ->get();

            foreach ($stageReviewers as $sr) {
                if ($sr->user) {
                    app(NotificationService::class)->notify(
                        $sr->user,
                        \App\Models\Notification::TYPE_REVIEWER_ASSIGNED,
                        [
                            'submission_id'    => $submission->id,
                            'submission_title' => $submission->title,
                            'note'             => 'An appeal was upheld — this stage has been reopened for re-review.',
                        ]
                    );
                }
            }
        }

        $submission->update($update);
    }
}
