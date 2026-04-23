<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\OrganizationSetting;
use App\Models\SubmissionReviewer;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Checks for reviewers who have passed their due_at date (+ grace period),
 * then sends escalation notifications to admins/coordinators and an email to
 * the reviewer (CC coordinator).
 *
 * Schedule: run daily via cron (see app/Console/Kernel.php → $schedule->daily())
 */
class CheckOverdueReviewers extends Command
{
    protected $signature   = 'reviews:check-overdue';
    protected $description = 'Escalate overdue reviewer deadlines after grace period';

    public function handle(): int
    {
        $org         = OrganizationSetting::current();
        $graceDays   = $org->review_grace_period_days ?? 0;
        $holidays    = $org->grace_period_consider_holidays ?? false;
        $country     = $org->grace_period_holidays_country ?? 'US';

        $this->info("Grace period: {$graceDays} days | Holidays: " . ($holidays ? $country : 'off'));

        // Find pending/accepted reviewers whose effective deadline has passed
        $overdue = SubmissionReviewer::with([
            'user:id,name,email',
            'submission:id,title,reference_number',
            'stage:id,name',
        ])
        ->whereIn('status', ['pending', 'accepted'])
        ->whereNull('decision')
        ->whereNotNull('due_at')
        ->get()
        ->filter(function ($reviewer) use ($graceDays, $holidays, $country) {
            $effectiveDue = $this->computeEffectiveDue($reviewer->due_at, $graceDays, $holidays, $country);
            return now()->startOfDay()->greaterThan($effectiveDue->endOfDay());
        });

        if ($overdue->isEmpty()) {
            $this->info('No overdue reviewers found.');
            return self::SUCCESS;
        }

        $this->info("Found {$overdue->count()} overdue reviewer(s). Sending escalations…");

        $notifSvc   = app(NotificationService::class);
        $admins     = User::whereJsonContains('roles', 'admin')
                          ->orWhereJsonContains('roles', 'coordinator')
                          ->get();
        $coordinators = User::whereJsonContains('roles', 'coordinator')->get();

        foreach ($overdue as $reviewer) {
            $sub = $reviewer->submission;
            if (!$sub) continue;

            $reviewerUser = $reviewer->user;

            // In-app notification to admins/coordinators
            if ($admins->isNotEmpty()) {
                $notifSvc->notify($admins->all(), Notification::TYPE_REVIEWER_OVERDUE, [
                    'submission_id'    => $sub->id,
                    'submission_title' => $sub->title,
                    'reviewer_name'    => $reviewerUser?->name,
                    'stage_name'       => $reviewer->stage?->name,
                    'due_at'           => $reviewer->due_at?->toDateString(),
                    'grace_days'       => $graceDays,
                    'message'          => "Reviewer {$reviewerUser?->name} is overdue (grace period of {$graceDays} day(s) elapsed).",
                ]);
            }

            // Email the reviewer (CC coordinator)
            if ($reviewerUser) {
                $this->sendOverdueEmail($reviewerUser, $sub, $reviewer, $coordinators);
            }

            $this->info("  Escalated: {$reviewerUser?->name} → {$sub->title}");
        }

        return self::SUCCESS;
    }

    /**
     * Compute effective due date = due_at + graceDays business/calendar days.
     * If consider_holidays is true, skip public holidays of the given country using
     * a simple hardcoded 2026 holiday list (extensible via DB in future).
     */
    private function computeEffectiveDue(mixed $dueAt, int $graceDays, bool $holidays, string $country): Carbon
    {
        $due = $dueAt instanceof Carbon ? $dueAt->copy() : Carbon::parse($dueAt);

        if ($graceDays <= 0) {
            return $due;
        }

        if (!$holidays) {
            return $due->addDays($graceDays);
        }

        // Advance by graceDays, skipping weekends and public holidays
        $publicHolidays = $this->getPublicHolidays($country, $due->year);
        $added = 0;
        $current = $due->copy();

        while ($added < $graceDays) {
            $current->addDay();
            $dateStr = $current->toDateString();
            if ($current->isWeekday() && !in_array($dateStr, $publicHolidays)) {
                $added++;
            }
        }

        return $current;
    }

    /**
     * Returns a list of public holiday dates (YYYY-MM-DD) for a given country + year.
     * Basic list — extend as needed or replace with an external API.
     */
    private function getPublicHolidays(string $country, int $year): array
    {
        $holidays = [
            'US' => [
                "{$year}-01-01", // New Year's
                "{$year}-07-04", // Independence Day
                "{$year}-11-11", // Veterans Day
                "{$year}-12-25", // Christmas
                "{$year}-12-26", // Boxing Day
            ],
            'GB' => [
                "{$year}-01-01",
                "{$year}-12-25",
                "{$year}-12-26",
            ],
            'HK' => [
                "{$year}-01-01",
                "{$year}-01-29", // Lunar New Year
                "{$year}-01-30",
                "{$year}-01-31",
                "{$year}-04-04", // Ching Ming
                "{$year}-04-18", // Good Friday
                "{$year}-04-21", // Easter Monday
                "{$year}-05-01", // Labour Day
                "{$year}-05-05", // Buddha's Birthday
                "{$year}-07-01", // Establishment Day
                "{$year}-10-01", // National Day
                "{$year}-10-07", // Chung Yeung
                "{$year}-12-25",
                "{$year}-12-26",
            ],
        ];

        return $holidays[$country] ?? $holidays['US'];
    }

    private function sendOverdueEmail(User $reviewer, mixed $sub, SubmissionReviewer $assignment, $coordinators): void
    {
        try {
            $org        = OrganizationSetting::current();
            $fromAddr   = config('mail.from.address', 'noreply@example.com');
            $fromName   = $org->portal_name ?? $org->org_name;
            $ccEmails   = $coordinators->pluck('email')->filter()->toArray();

            $body = "Dear {$reviewer->name},\n\n"
                  . "This is a reminder that your review for the following submission is overdue:\n\n"
                  . "  Title: {$sub->title}\n"
                  . "  Reference: {$sub->reference_number}\n"
                  . "  Stage: {$assignment->stage?->name}\n"
                  . "  Original Due Date: {$assignment->due_at?->toDateString()}\n\n"
                  . "Please complete your review as soon as possible or contact the coordinator.\n\n"
                  . "Regards,\n{$fromName}";

            Mail::raw($body, function ($msg) use ($reviewer, $sub, $fromAddr, $fromName, $ccEmails) {
                $msg->to($reviewer->email, $reviewer->name)
                    ->subject("Overdue Review Reminder — {$sub->title}")
                    ->from($fromAddr, $fromName);
                foreach ($ccEmails as $cc) {
                    $msg->cc($cc);
                }
            });
        } catch (\Throwable $e) {
            Log::warning("Failed to send overdue email to {$reviewer->email}", ['error' => $e->getMessage()]);
        }
    }
}
