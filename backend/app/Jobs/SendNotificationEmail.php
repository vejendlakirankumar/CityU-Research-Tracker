<?php

namespace App\Jobs;

use App\Models\EmailSetting;
use App\Models\Notification;
use App\Models\NotificationTemplate;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Renders a notification's email template and delivers it via the configured
 * mail transport (SMTP / SES / Microsoft Graph — see EmailSetting).
 *
 * Dispatched by NotificationService for notification types that map to an
 * active email template. Runs on the queue so request handling is never blocked
 * by an outbound email; failures are logged and never re-thrown to the caller.
 */
class SendNotificationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        public string $userId,
        public string $eventType,
        public array $data = [],
        public ?string $notificationId = null,
    ) {}

    public function handle(): void
    {
        $template = NotificationTemplate::where('event_type', $this->eventType)
            ->where('is_active', true)
            ->first();

        // No active template for this event → nothing to email (in-app only).
        if (!$template) {
            return;
        }

        $user = User::find($this->userId);
        if (!$user || !$user->email) {
            return;
        }

        $setting = EmailSetting::current();
        $vars    = $this->buildVars($user);

        $subject  = strtr($template->subject, $vars);
        $bodyHtml = strtr($template->body_html, $vars);

        try {
            config(['mail.mailers.dynamic_email' => $setting->toMailerConfig()]);
            config(['mail.from.address' => $setting->from_address]);
            config(['mail.from.name'    => $setting->from_name]);

            Mail::mailer('dynamic_email')->html($bodyHtml, function ($message) use ($user, $subject, $setting) {
                $message->to($user->email, $user->name)->subject($subject);
                if ($setting->reply_to) {
                    $message->replyTo($setting->reply_to);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('Notification email send failed', [
                'event_type' => $this->eventType,
                'user_id'    => $this->userId,
                'error'      => $e->getMessage(),
            ]);
            return;
        }

        // Record that the in-app notification was also emailed.
        if ($this->notificationId) {
            Notification::where('id', $this->notificationId)
                ->whereNull('emailed_at')
                ->update(['emailed_at' => now()]);
        }
    }

    /**
     * Build the {{placeholder}} => value map from the recipient and the
     * notification payload. Missing values render as an empty string.
     */
    private function buildVars(User $user): array
    {
        $portal  = config('app.frontend_url') ?: config('app.url');
        $support = EmailSetting::current()->reply_to ?: EmailSetting::current()->from_address;

        return [
            '{{user_name}}'        => $user->name ?? '',
            '{{reviewer_name}}'    => $this->data['reviewer_name'] ?? ($user->name ?? ''),
            '{{submission_title}}' => $this->data['submission_title'] ?? '',
            '{{submission_id}}'    => $this->data['submission_id'] ?? '',
            '{{stage_name}}'       => $this->data['stage_name'] ?? '',
            '{{due_date}}'         => $this->data['due_at'] ?? ($this->data['due_date'] ?? ''),
            '{{days_overdue}}'     => (string) ($this->data['days_overdue'] ?? ''),
            '{{comments}}'         => $this->data['comments'] ?? ($this->data['note'] ?? ''),
            '{{program_name}}'     => $this->data['program_name'] ?? '',
            '{{portal_url}}'       => $portal ?? '',
            '{{support_email}}'    => $support ?? '',
        ];
    }
}
