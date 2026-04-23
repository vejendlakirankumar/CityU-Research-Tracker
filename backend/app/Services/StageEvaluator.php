<?php

namespace App\Services;

use App\Models\Submission;
use App\Models\StageDefinition;
use App\Models\SubmissionReviewer;

/**
 * Pure evaluation of a review stage's outcome.
 *
 * Decision values stored in submission_reviewers.decision:
 *   approve | revise | reject
 *
 * Stage outcome:
 *   PENDING            – not all reviewers have decided yet
 *   PASSED             – approval condition met
 *   REVISION_REQUIRED  – at least one revise, no reject
 *   FAILED             – at least one reject (immediate)
 */
class StageEvaluator
{
    /**
     * Evaluate the stage for the given submission.
     *
     * @return 'PENDING'|'PASSED'|'REVISION_REQUIRED'|'FAILED'
     */
    public function evaluate(string $submissionId, StageDefinition $stage): string
    {
        $reviewers = SubmissionReviewer::where('submission_id', $submissionId)
            ->where('stage_id', $stage->id)
            ->where('status', '!=', 'declined')   // declined reviewers don't count
            ->get();

        $total     = $reviewers->count();
        $decided   = $reviewers->whereNotNull('decision')->count();
        $pending   = $total - $decided;

        $approvals = $reviewers->where('decision', 'approve')->count();
        $revisions = $reviewers->where('decision', 'revise')->count();
        $rejections = $reviewers->where('decision', 'reject')->count();

        // Step 3 – Immediate rejection
        if ($rejections > 0) {
            return 'FAILED';
        }

        $strategy     = strtoupper($stage->approval_strategy ?? 'ALL');
        $minApprovals = (int) ($stage->min_approvals ?? 1);

        // Step 5 – Check approval condition
        $passed = match ($strategy) {
            'ANY'      => $approvals >= 1,
            'MAJORITY' => $approvals >= $minApprovals,
            default    => $total > 0 && $approvals >= $total,   // ALL
        };

        if ($passed) {
            return 'PASSED';
        }

        // Step 6 – Still waiting?
        if ($pending > 0) {
            return 'PENDING';
        }

        // Everyone decided, approval condition not met → revision
        if ($revisions > 0) {
            return 'REVISION_REQUIRED';
        }

        // Edge case: no rejections, no revisions, approval not met yet (shouldn't normally happen)
        return 'PENDING';
    }
}
