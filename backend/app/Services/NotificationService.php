<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

/**
 * Creates in-app notification records.
 *
 * Usage:
 *   app(NotificationService::class)->notify($user, Notification::TYPE_REVIEWER_ASSIGNED, [
 *       'submission_id'    => $sub->id,
 *       'submission_title' => $sub->title,
 *       'stage_name'       => $stage->name,
 *   ]);
 */
class NotificationService
{
    /**
     * Send an in-app notification to one or more users.
     *
     * @param User|User[] $users
     */
    public function notify(User|array $users, string $type, array $data = []): void
    {
        $users = is_array($users) ? $users : [$users];

        foreach ($users as $user) {
            Notification::create([
                'user_id' => $user->id,
                'type'    => $type,
                'data'    => $data,
            ]);
        }
    }

    /**
     * Convenience: notify the submitter of a submission about a status change.
     */
    public function notifyStatusChange(
        \App\Models\Submission $submission,
        string $newStatus
    ): void {
        $typeMap = [
            'ACCEPTED'          => Notification::TYPE_SUBMISSION_ACCEPTED,
            'REJECTED'          => Notification::TYPE_SUBMISSION_REJECTED,
            'REVISION_REQUIRED' => Notification::TYPE_REVISION_REQUIRED,
        ];

        $notifType = $typeMap[$newStatus] ?? null;
        if (!$notifType) {
            return;
        }

        $submitter = $submission->submitter;
        if (!$submitter) {
            return;
        }

        $this->notify($submitter, $notifType, [
            'submission_id'    => $submission->id,
            'submission_title' => $submission->title,
            'new_status'       => $newStatus,
        ]);
    }
}
