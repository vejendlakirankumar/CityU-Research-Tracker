<?php

namespace App\Http\Controllers;

use App\Models\AppealRequest;
use App\Models\AuditLog;
use App\Models\Submission;
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
        ])->findOrFail($id);

        return response()->json($appeal);
    }

    /**
     * PATCH /api/appeals/{id}
     * Admin updates appeal status: UNDER_REVIEW → UPHELD | DISMISSED
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $appeal = AppealRequest::findOrFail($id);

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

        // If upheld, update submission status to APPEAL_PENDING → back to IN_REVIEW for re-review
        if ($data['status'] === AppealRequest::STATUS_UPHELD) {
            $submission = Submission::find($appeal->submission_id);
            if ($submission) {
                $prevStatus = $submission->status;
                $submission->update(['status' => Submission::STATUS_IN_REVIEW]);

                AuditLog::create([
                    'submission_id' => $submission->id,
                    'actor_id'      => $request->user()->id,
                    'action'        => 'APPEAL_UPHELD',
                    'before_state'  => ['status' => $prevStatus, 'appeal_status' => $oldStatus],
                    'after_state'   => ['status' => Submission::STATUS_IN_REVIEW, 'appeal_status' => $data['status']],
                ]);

                app(NotificationService::class)->notifyStatusChange($submission->fresh(), Submission::STATUS_IN_REVIEW);
            }
        }

        AuditLog::create([
            'submission_id' => $appeal->submission_id,
            'actor_id'      => $request->user()->id,
            'action'        => 'APPEAL_' . $data['status'],
            'before_state'  => ['appeal_status' => $oldStatus],
            'after_state'   => ['appeal_status' => $data['status']],
        ]);

        return response()->json([
            'id'              => $appeal->id,
            'status'          => $appeal->status,
            'resolution_note' => $appeal->resolution_note,
            'reviewed_at'     => $appeal->reviewed_at,
        ]);
    }
}
