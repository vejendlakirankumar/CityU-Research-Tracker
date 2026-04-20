<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\SubmissionType;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * GET /api/analytics/overview
     * High-level counts for the admin dashboard.
     */
    public function overview(Request $request): JsonResponse
    {
        // Submission counts by status
        $byStatus = Submission::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        // Submission counts by type
        $byType = Submission::select(
                'submission_types.label',
                DB::raw('count(submissions.id) as count')
            )
            ->leftJoin('submission_types', 'submissions.submission_type_id', '=', 'submission_types.id')
            ->groupBy('submission_types.label')
            ->pluck('count', 'label');

        // Monthly submission trend (last 12 months)
        $monthlyTrend = DB::select("
            SELECT to_char(created_at, 'YYYY-MM') AS month, count(*) AS count
            FROM submissions
            WHERE created_at >= now() - interval '12 months'
            GROUP BY month
            ORDER BY month
        ");

        // Active users (logged in within last 30 days)
        $activeUsers = User::where('last_login_at', '>=', now()->subDays(30))->count();

        // Total counts
        $totalSubmissions  = Submission::count();
        $totalUsers        = User::where('is_active', true)->count();
        $pendingReview     = Submission::whereIn('status', ['SUBMITTED', 'IN_REVIEW'])->count();
        $completedThisMonth = Submission::whereIn('status', ['ACCEPTED', 'CONDITIONALLY_ACCEPTED', 'REJECTED'])
            ->where('updated_at', '>=', now()->startOfMonth())
            ->count();

        return response()->json([
            'data' => [
                'total_submissions'       => $totalSubmissions,
                'total_active_users'      => $totalUsers,
                'active_users_30d'        => $activeUsers,
                'pending_review'          => $pendingReview,
                'completed_this_month'    => $completedThisMonth,
                'by_status'               => $byStatus,
                'by_type'                 => $byType,
                'monthly_trend'           => $monthlyTrend,
            ],
        ]);
    }

    /**
     * GET /api/analytics/turnaround
     * Average review turnaround time by submission type.
     */
    public function turnaround(Request $request): JsonResponse
    {
        // Average days from SUBMITTED to first decision (accepted/rejected/revision)
        $rows = DB::select("
            SELECT
                st.label AS type_label,
                count(s.id) AS total,
                round(avg(
                    extract(epoch from (s.updated_at - s.created_at)) / 86400.0
                )::numeric, 1) AS avg_days,
                round(min(
                    extract(epoch from (s.updated_at - s.created_at)) / 86400.0
                )::numeric, 1) AS min_days,
                round(max(
                    extract(epoch from (s.updated_at - s.created_at)) / 86400.0
                )::numeric, 1) AS max_days
            FROM submissions s
            LEFT JOIN submission_types st ON s.submission_type_id = st.id
            WHERE s.status IN ('ACCEPTED','CONDITIONALLY_ACCEPTED','REJECTED','REVISION_REQUIRED')
            GROUP BY st.label
            ORDER BY avg_days DESC NULLS LAST
        ");

        // Per-stage average (using submission_reviewers decision timing)
        $stageRows = DB::select("
            SELECT
                sr.stage_role_label,
                count(sr.id) AS total,
                round(avg(
                    extract(epoch from (sr.decision_at - sr.assigned_at)) / 86400.0
                )::numeric, 1) AS avg_days
            FROM submission_reviewers sr
            WHERE sr.decision IS NOT NULL
              AND sr.assigned_at IS NOT NULL
              AND sr.decision_at IS NOT NULL
            GROUP BY sr.stage_role_label
            ORDER BY avg_days DESC NULLS LAST
        ");

        return response()->json([
            'data' => [
                'by_type'  => $rows,
                'by_stage' => $stageRows,
            ],
        ]);
    }

    /**
     * GET /api/analytics/reviewer-load
     * Reviewer workload — active assignments and decision rate.
     */
    public function reviewerLoad(Request $request): JsonResponse
    {
        $rows = DB::select("
            SELECT
                u.id,
                u.name,
                u.email,
                count(sr.id) FILTER (WHERE sr.decision IS NULL)  AS pending_count,
                count(sr.id) FILTER (WHERE sr.decision IS NOT NULL) AS completed_count,
                count(sr.id) AS total_count,
                round(
                    100.0 * count(sr.id) FILTER (WHERE sr.decision IS NOT NULL)
                    / NULLIF(count(sr.id), 0), 1
                ) AS completion_rate,
                max(sr.assigned_at) AS last_assigned_at
            FROM users u
            JOIN submission_reviewers sr ON sr.reviewer_id = u.id
            GROUP BY u.id, u.name, u.email
            HAVING count(sr.id) > 0
            ORDER BY pending_count DESC, total_count DESC
            LIMIT 50
        ");

        return response()->json(['data' => $rows]);
    }
}
