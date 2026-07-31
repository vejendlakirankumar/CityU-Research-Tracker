<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\OrganizationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogController extends Controller
{
    /**
     * GET /api/admin/audit-logs
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['actor:id,name,email'])
            ->orderBy('created_at', 'desc');

        // Filter by submission
        if ($request->filled('submission_id')) {
            $query->where('submission_id', $request->submission_id);
        }

        // Filter by actor
        if ($request->filled('actor_id')) {
            $query->where('actor_id', $request->actor_id);
        }

        // Filter by action
        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        // Date range — validate before passing to DB to prevent errors from malformed values
        if ($request->filled('from')) {
            if (!strtotime($request->from)) {
                return response()->json(['message' => 'Invalid from date.'], 422);
            }
            $query->where('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            if (!strtotime($request->to)) {
                return response()->json(['message' => 'Invalid to date.'], 422);
            }
            $query->where('created_at', '<=', $request->to);
        }

        // Search in data JSON
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('action', 'ilike', "%{$search}%")
                  ->orWhereRaw("data::text ilike ?", ["%{$search}%"]);
            });
        }

        $perPage = min((int) $request->get('per_page', 50), 200);
        $items = $query->paginate($perPage);

        return response()->json([
            'data' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page'    => $items->lastPage(),
                'per_page'     => $items->perPage(),
                'total'        => $items->total(),
            ],
        ]);
    }

    /**
     * GET /api/admin/audit-logs/actions
     * Distinct action values for filter dropdowns.
     */
    public function actions(): JsonResponse
    {
        $actions = AuditLog::select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action');

        return response()->json(['data' => $actions]);
    }

    /**
     * GET /api/admin/audit-logs/stats
     * Retention configuration + counts used by the retention management UI.
     */
    public function stats(): JsonResponse
    {
        $org       = OrganizationSetting::current();
        $retention = $org->audit_retention_days;

        $total  = AuditLog::count();
        $oldest = AuditLog::min('created_at');
        $newest = AuditLog::max('created_at');

        $eligible = 0;
        if ($retention) {
            $cutoff   = now()->subDays($retention);
            $eligible = AuditLog::where('created_at', '<', $cutoff)->count();
        }

        return response()->json([
            'retention_days'        => $retention,
            'total'                 => $total,
            'oldest'                => $oldest,
            'newest'                => $newest,
            'eligible_for_deletion' => $eligible,
        ]);
    }

    /**
     * PATCH /api/admin/audit-logs/retention
     * Set the number of days to retain audit logs (null = keep forever).
     */
    public function setRetention(Request $request): JsonResponse
    {
        $data = $request->validate([
            'retention_days' => ['present', 'nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $org = OrganizationSetting::current();
        $org->update(['audit_retention_days' => $data['retention_days']]);

        AuditLog::create([
            'actor_id'    => $request->user()->id,
            'action'      => 'AUDIT_RETENTION_UPDATED',
            'after_state' => ['audit_retention_days' => $data['retention_days']],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'request_id'  => $request->header('X-Request-Id'),
        ]);

        return response()->json(['retention_days' => $org->audit_retention_days]);
    }

    /**
     * DELETE /api/admin/audit-logs
     * Permanently delete audit logs older than the given number of days.
     * Defaults to the configured retention period when not specified.
     * The audit_logs table is immutable at the DB layer (a rule blocks
     * deletes); the rule is lifted only for the duration of this operation.
     */
    public function purge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'older_than_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $org  = OrganizationSetting::current();
        $days = $data['older_than_days'] ?? $org->audit_retention_days;

        if (!$days) {
            return response()->json([
                'message' => 'Specify the age in days, or set a retention period first.',
            ], 422);
        }

        $cutoff  = now()->subDays((int) $days);
        $deleted = 0;

        DB::transaction(function () use ($cutoff, &$deleted) {
            DB::statement('ALTER TABLE audit_logs DISABLE RULE no_delete_audit');
            try {
                $deleted = DB::table('audit_logs')
                    ->where('created_at', '<', $cutoff)
                    ->delete();
            } finally {
                DB::statement('ALTER TABLE audit_logs ENABLE RULE no_delete_audit');
            }
        });

        // Record the purge itself (created now, so it survives the cutoff).
        AuditLog::create([
            'actor_id'    => $request->user()->id,
            'action'      => 'AUDIT_LOGS_PURGED',
            'after_state' => [
                'older_than_days' => (int) $days,
                'cutoff'          => $cutoff->toISOString(),
                'deleted'         => $deleted,
            ],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'request_id'  => $request->header('X-Request-Id'),
        ]);

        return response()->json([
            'deleted'         => $deleted,
            'older_than_days' => (int) $days,
        ]);
    }
}
