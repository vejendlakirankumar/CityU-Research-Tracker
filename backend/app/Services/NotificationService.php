<?php

namespace App\Services;

use App\Jobs\SendNotificationEmail;
use App\Models\Notification;
use App\Models\User;

/**
 * Creates in-app notification records and, for notification types that map to
 * an active email template, dispatches a queued email to each recipient.
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
     * Maps in-app notification types to the email template `event_type` used to
     * render the outbound email. Types not listed here are in-app only.
     */
    private const EMAIL_TEMPLATE_MAP = [
        Notification::TYPE_SUBMISSION_RECEIVED  => 'SUBMISSION_RECEIVED',
        Notification::TYPE_SUBMISSION_ACCEPTED  => 'SUBMISSION_ACCEPTED',
        Notification::TYPE_SUBMISSION_REJECTED  => 'SUBMISSION_REJECTED',
        Notification::TYPE_REVISION_REQUIRED    => 'REVISION_REQUIRED',
        Notification::TYPE_REVIEWER_ASSIGNED    => 'STAGE_ASSIGNED',
        Notification::TYPE_STAGE_DUE_SOON       => 'STAGE_DUE_SOON',
    ];

    /**
     * Send an in-app notification to one or more users. When $email is true and
     * the type maps to an active email template, a queued email is also sent.
     *
     * @param User|User[] $users
     */
    public function notify(User|array $users, string $type, array $data = [], bool $email = true): void
    {
        $users = is_array($users) ? $users : [$users];

        $templateEvent = self::EMAIL_TEMPLATE_MAP[$type] ?? null;

        foreach ($users as $user) {
            $notification = Notification::create([
                'user_id' => $user->id,
                'type'    => $type,
                'data'    => $data,
            ]);

            if ($email && $templateEvent && $user->email) {
                SendNotificationEmail::dispatch($user->id, $templateEvent, $data, $notification->id);
            }
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
