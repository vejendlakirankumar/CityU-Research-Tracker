<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/stats
     * Returns role-appropriate dashboard statistics.
     */
    public function stats(Request $request): JsonResponse
    {
        $user  = $request->user();
        $roles = $user->roles ?? [];

        if (in_array('admin', $roles) || in_array('coordinator', $roles)) {
            return $this->adminStats();
        }

        if (in_array('reviewer', $roles)) {
            return $this->reviewerStats($user);
        }

        return $this->studentStats($user);
    }

    // ── Role-specific stat builders ───────────────────────────────────────────

    private function adminStats(): JsonResponse
    {
        $active = Submission::whereIn('status', [
            Submission::STATUS_SUBMITTED,
            Submission::STATUS_AWAITING_REVIEWERS,
            Submission::STATUS_IN_REVIEW,
            Submission::STATUS_REVISION_REQUIRED,
        ])->count();

        $pendingAssignment = Submission::where('status', Submission::STATUS_AWAITING_REVIEWERS)->count();

        $overdue = SubmissionReviewer::where('status', '!=', 'completed')
            ->where('status', '!=', 'declined')
            ->where('due_at', '<', now()->toDateString())
            ->distinct('submission_id')
            ->count('submission_id');

        $thisMonthCompleted = Submission::whereIn('status', [
            Submission::STATUS_ACCEPTED,
            Submission::STATUS_CONDITIONALLY_ACCEPTED,
            Submission::STATUS_REJECTED,
        ])
        ->whereBetween('updated_at', [now()->startOfMonth(), now()->endOfMonth()])
        ->count();

        $totalUsers = User::where('is_active', true)->count();

        return response()->json([
            'role'  => 'admin',
            'stats' => [
                ['key' => 'active_submissions',    'label' => 'Active Submissions',    'value' => $active],
                ['key' => 'pending_assignment',    'label' => 'Pending Assignment',    'value' => $pendingAssignment],
                ['key' => 'overdue',               'label' => 'Overdue Reviews',       'value' => $overdue],
                ['key' => 'completed_this_month',  'label' => 'Completed This Month',  'value' => $thisMonthCompleted],
                ['key' => 'total_users',           'label' => 'Active Users',          'value' => $totalUsers],
            ],
        ]);
    }

    private function reviewerStats(User $user): JsonResponse
    {
        $pending = SubmissionReviewer::where('user_id', $user->id)
            ->whereNull('decision')
            ->where('status', '!=', 'declined')
            ->count();

        $overdue = SubmissionReviewer::where('user_id', $user->id)
            ->whereNull('decision')
            ->where('status', '!=', 'declined')
            ->where('due_at', '<', now()->toDateString())
            ->count();

        $completed = SubmissionReviewer::where('user_id', $user->id)
            ->where('status', 'completed')
            ->count();

        return response()->json([
            'role'  => 'reviewer',
            'stats' => [
                ['key' => 'pending_reviews',  'label' => 'Pending Reviews',  'value' => $pending],
                ['key' => 'overdue',          'label' => 'Overdue',          'value' => $overdue],
                ['key' => 'completed',        'label' => 'Completed Reviews', 'value' => $completed],
            ],
        ]);
    }

    private function studentStats(User $user): JsonResponse
    {
        $mySubmissions = Submission::where('submitter_id', $user->id)->count();

        $inReview = Submission::where('submitter_id', $user->id)
            ->whereIn('status', [
                Submission::STATUS_AWAITING_REVIEWERS,
                Submission::STATUS_IN_REVIEW,
            ])->count();

        $accepted = Submission::where('submitter_id', $user->id)
            ->whereIn('status', [
                Submission::STATUS_ACCEPTED,
                Submission::STATUS_CONDITIONALLY_ACCEPTED,
            ])->count();

        $revisionRequired = Submission::where('submitter_id', $user->id)
            ->where('status', Submission::STATUS_REVISION_REQUIRED)
            ->count();

        return response()->json([
            'role'  => 'student',
            'stats' => [
                ['key' => 'my_submissions',     'label' => 'My Submissions',     'value' => $mySubmissions],
                ['key' => 'under_review',       'label' => 'Under Review',       'value' => $inReview],
                ['key' => 'revision_required',  'label' => 'Revision Required',  'value' => $revisionRequired],
                ['key' => 'accepted',           'label' => 'Accepted',           'value' => $accepted],
            ],
        ]);
    }
}
