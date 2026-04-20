<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\SubmissionMeeting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SubmissionMeetingController extends Controller
{
    /**
     * GET /api/submissions/{id}/meetings
     * List all meetings for a submission. Optionally filter by ?stage_id=X.
     */
    public function index(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::findOrFail($submissionId);
        $this->authorize('view', $submission);

        $query = SubmissionMeeting::with(['requester:id,name,email', 'stage:id,name'])
            ->where('submission_id', $submissionId);

        if ($request->filled('stage_id')) {
            $query->where('stage_id', $request->stage_id);
        }

        $meetings = $query->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $meetings->map(fn($m) => $this->toResource($m))]);
    }

    /**
     * POST /api/submissions/{id}/meetings
     * Request a meeting (reviewer, submitter, or admin).
     */
    public function store(Request $request, string $submissionId): JsonResponse
    {
        $submission = Submission::findOrFail($submissionId);
        $this->authorize('view', $submission);

        $data = $request->validate([
            'stage_id'    => ['nullable', 'uuid', 'exists:stage_definitions,id'],
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'proposed_at' => ['nullable', 'date'],
        ]);

        $meeting = SubmissionMeeting::create([
            'id'            => Str::uuid()->toString(),
            'submission_id' => $submissionId,
            'stage_id'      => $data['stage_id'] ?? null,
            'requested_by'  => $request->user()->id,
            'title'         => $data['title'],
            'description'   => $data['description'] ?? null,
            'proposed_at'   => $data['proposed_at'] ?? null,
            'status'        => 'requested',
        ]);

        $meeting->load(['requester:id,name,email', 'stage:id,name']);

        return response()->json(['data' => $this->toResource($meeting)], 201);
    }

    /**
     * PATCH /api/submissions/{id}/meetings/{meetingId}
     * Confirm, cancel, or complete a meeting. Admin/coordinator only.
     */
    public function update(Request $request, string $submissionId, string $meetingId): JsonResponse
    {
        $meeting = SubmissionMeeting::where('submission_id', $submissionId)
            ->where('id', $meetingId)
            ->firstOrFail();

        $data = $request->validate([
            'status'       => ['sometimes', 'in:confirmed,cancelled,completed'],
            'confirmed_at' => ['sometimes', 'nullable', 'date'],
            'meeting_link' => ['sometimes', 'nullable', 'url', 'max:500'],
            'notes'        => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $meeting->update($data);
        $meeting->load(['requester:id,name,email', 'stage:id,name']);

        return response()->json(['data' => $this->toResource($meeting)]);
    }

    /**
     * DELETE /api/submissions/{id}/meetings/{meetingId}
     * Cancel/delete a meeting. Requester or admin/coordinator.
     */
    public function destroy(Request $request, string $submissionId, string $meetingId): JsonResponse
    {
        $meeting = SubmissionMeeting::where('submission_id', $submissionId)
            ->where('id', $meetingId)
            ->firstOrFail();

        $user = $request->user();
        if ($meeting->requested_by !== $user->id && !$user->hasAnyRole(['admin', 'coordinator'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $meeting->delete();

        return response()->json(null, 204);
    }

    private function toResource(SubmissionMeeting $m): array
    {
        return [
            'id'            => $m->id,
            'submission_id' => $m->submission_id,
            'stage_id'      => $m->stage_id,
            'stage'         => $m->stage ? ['id' => $m->stage->id, 'name' => $m->stage->name] : null,
            'requested_by'  => $m->requested_by,
            'requester'     => $m->requester
                ? ['id' => $m->requester->id, 'name' => $m->requester->name, 'email' => $m->requester->email]
                : null,
            'title'         => $m->title,
            'description'   => $m->description,
            'proposed_at'   => $m->proposed_at?->toISOString(),
            'status'        => $m->status,
            'confirmed_at'  => $m->confirmed_at?->toISOString(),
            'meeting_link'  => $m->meeting_link,
            'notes'         => $m->notes,
            'created_at'    => $m->created_at->toISOString(),
        ];
    }
}
