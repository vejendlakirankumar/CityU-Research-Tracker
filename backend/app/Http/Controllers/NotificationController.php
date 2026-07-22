<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     *
     * Returns the authenticated user's notifications, newest first.
     * Includes a top-level `unread_count` for badge display.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = Notification::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $unreadCount = $notifications->whereNull('read_at')->count();

        return response()->json([
            'data'         => $notifications->map(fn($n) => $this->toResource($n)),
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * POST /api/notifications/read
     *
     * Marks notifications as read.
     * Body: { ids: ['uuid', ...] } — or omit `ids` to mark ALL read.
     */
    public function markRead(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'ids'   => ['sometimes', 'array'],
            'ids.*' => ['uuid'],
        ]);

        $query = Notification::where('user_id', $user->id)->whereNull('read_at');

        if (!empty($data['ids'])) {
            $query->whereIn('id', $data['ids']);
        }

        $query->update(['read_at' => now()]);

        return response()->json(['message' => 'Marked as read.']);
    }

    /**
     * GET /api/notifications/unread-count
     *
     * Lightweight poll endpoint — just returns the count.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function toResource(Notification $n): array
    {
        return [
            'id'         => $n->id,
            'type'       => $n->type,
            'data'       => $n->data ?? [],
            'read_at'    => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at?->toIso8601String(),
            'title'      => $this->titleFor($n),
            'body'       => $this->bodyFor($n),
            'link'       => $this->linkFor($n),
        ];
    }

    private function titleFor(Notification $n): string
    {
        $data = $n->data ?? [];
        return match ($n->type) {
            'announcement'         => $data['title'] ?? 'Announcement',
            'reviewer_assigned'    => 'You have been assigned as a reviewer',
            'decision_submitted'   => 'A reviewer submitted their decision',
            'submission_accepted'  => 'Your submission has been accepted',
            'submission_rejected'  => 'Your submission was not accepted',
            'revision_required'    => 'Revision required on your submission',
            'submission_submitted' => 'New submission received',
            'reviewer_accepted'    => 'Reviewer accepted assignment',
            'reviewer_declined'    => 'Reviewer declined assignment',
            'stage_complete'       => 'Review stage completed',
            default                => 'Notification',
        };
    }

    private function bodyFor(Notification $n): string
    {
        $data  = $n->data ?? [];
        $title = $data['submission_title'] ?? 'a submission';
        $stage = $data['stage_name'] ?? null;

        return match ($n->type) {
            'announcement'         => $data['body'] ?? '',
            'reviewer_assigned'    => 'You have been asked to review "' . $title . '"' . ($stage ? ' — ' . $stage . ' stage' : '') . '.',
            'decision_submitted'   => 'A decision was recorded on "' . $title . '"' . ($stage ? ' — ' . $stage . ' stage' : '') . '.',
            'submission_accepted'  => '"' . $title . '" has been accepted.',
            'submission_rejected'  => '"' . $title . '" was rejected. Please check the feedback tab.',
            'revision_required'    => '"' . $title . '" requires revision. Please review the feedback and resubmit.',
            'submission_submitted' => '"' . $title . '" has been submitted for review.',
            'reviewer_accepted'    => ($data['reviewer_name'] ?? 'A reviewer') . ' accepted the review assignment for "' . $title . '".',
            'reviewer_declined'    => ($data['reviewer_name'] ?? 'A reviewer') . ' declined the review assignment for "' . $title . '".',
            'stage_complete'       => 'The ' . ($stage ?? 'review') . ' stage has completed for "' . $title . '".',
            default                => 'See submission "' . $title . '" for details.',
        };
    }

    private function linkFor(Notification $n): string|null
    {
        if ($n->type === 'announcement') {
            return '/announcements';
        }
        $submissionId = ($n->data ?? [])['submission_id'] ?? null;
        return $submissionId ? '/submissions/' . $submissionId : null;
    }
}
