<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Services\NotificationService;

/**
 * Evaluates all stages for a submission after a reviewer decision
 * and advances the submission status accordingly.
 *
 * Logic:
 *  1. Load all stages in the workflow (ordered).
 *  2. Evaluate each stage with StageEvaluator.
 *  3. If any stage FAILED → REJECTED.
 *  4. If any stage REVISION_REQUIRED → REVISION_REQUIRED.
 *  5. If all stages PASSED → ACCEPTED (or final_status_on_pass from workflow).
 *  6. Otherwise stay IN_REVIEW.
 */
class WorkflowAdvancer
{
    public function __construct(private StageEvaluator $evaluator) {}

    /**
     * Called after a reviewer submits a decision.
     * Evaluates stage outcome and transitions submission status if warranted.
     */
    public function evaluateAndAdvance(Submission $submission): void
    {
        $submission->load(['submissionType.workflow.stages']);

        $stages = $submission->submissionType?->workflow?->stages ?? collect();

        if ($stages->isEmpty()) {
            return;
        }

        // Only process when submission is IN_REVIEW
        if (!in_array($submission->status, [
            Submission::STATUS_IN_REVIEW,
            Submission::STATUS_AWAITING_REVIEWERS,
        ])) {
            return;
        }

        $allPassed  = true;
        $anyFailed  = false;
        $anyRevision = false;

        foreach ($stages as $stage) {
            $outcome = $this->evaluator->evaluate($submission->id, $stage);

            if ($outcome === 'FAILED') {
                $anyFailed = true;
                break;
            }

            if ($outcome === 'REVISION_REQUIRED') {
                $anyRevision = true;
            }

            if ($outcome === 'PENDING') {
                $allPassed = false;
            }
        }

        if ($anyFailed) {
            $this->transition($submission, Submission::STATUS_REJECTED, 'auto_rejected');
            return;
        }

        if ($anyRevision) {
            $this->transition($submission, Submission::STATUS_REVISION_REQUIRED, 'auto_revision_requested');
            return;
        }

        if ($allPassed) {
            // Check if this is a gated review type — goes to PENDING_RELEASE instead of ACCEPTED
            $isGated = $submission->submissionType?->is_gated_review ?? false;

            if ($isGated) {
                $this->transition($submission, Submission::STATUS_PENDING_RELEASE, 'auto_pending_release');
            } else {
                $finalStatus = $submission->submissionType?->workflow?->final_status_on_pass
                    ?? Submission::STATUS_ACCEPTED;

                $this->transition($submission, $finalStatus, 'auto_accepted');
            }
        }
            $finalStatus = $submission->submissionType?->workflow?->final_status_on_pass
                ?? Submission::STATUS_ACCEPTED;

            $this->transition($submission, $finalStatus, 'auto_accepted');
        }
        // else: still PENDING — no status change
    }

    private function transition(Submission $submission, string $newStatus, string $action): void
    {
        $old = $submission->status;
        $submission->update(['status' => $newStatus]);

        AuditLog::create([
            'submission_id' => $submission->id,
            'actor_id'      => null,   // system action
            'action'        => strtoupper($action),
            'before_state'  => ['status' => $old],
            'after_state'   => ['status' => $newStatus],
        ]);

        // Notify the submitter of the status change
        $submission->loadMissing('submitter');
        app(NotificationService::class)->notifyStatusChange($submission, $newStatus);
    }
}
