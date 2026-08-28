<?php

namespace App\Console\Commands;

use App\Models\Notification;
use App\Models\SubmissionReviewer;
use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Reminds reviewers whose deadline is approaching (within the configured window)
 * that their review is due soon. Each assignment is reminded once — `reminder_sent_at`
 * is stamped after sending so daily runs do not re-notify.
 *
 * Schedule: run daily via the scheduler (see bootstrap/app.php → withSchedule()).
 */
class CheckDueSoonReviewers extends Command
{
    protected $signature   = 'reviews:check-due-soon {--days=2 : Days before due_at to send the reminder}';
    protected $description = 'Remind reviewers whose deadline is approaching';

    public function handle(): int
    {
        $windowDays = (int) $this->option('days');
        $today      = now()->startOfDay();
        $windowEnd  = $today->copy()->addDays(max(0, $windowDays))->endOfDay();

        $upcoming = SubmissionReviewer::with([
            'user:id,name,email',
            'submission:id,title',
            'stage:id,name',
        ])
        ->whereIn('status', ['pending', 'accepted'])
        ->whereNull('decision')
        ->whereNull('reminder_sent_at')
        ->whereNotNull('due_at')
        ->whereBetween('due_at', [$today, $windowEnd])
        ->get();

        if ($upcoming->isEmpty()) {
            $this->info('No reviewers with upcoming deadlines.');
            return self::SUCCESS;
        }

        $this->info("Found {$upcoming->count()} reviewer(s) with deadlines within {$windowDays} day(s).");

        $svc = app(NotificationService::class);

        foreach ($upcoming as $reviewer) {
            $sub  = $reviewer->submission;
            $user = $reviewer->user;
            if (!$sub || !$user) {
                continue;
            }

            $svc->notify($user, Notification::TYPE_STAGE_DUE_SOON, [
                'submission_id'    => $sub->id,
                'submission_title' => $sub->title,
                'stage_name'       => $reviewer->stage?->name,
                'due_at'           => $reviewer->due_at?->toDateString(),
            ]);

            $reviewer->forceFill(['reminder_sent_at' => now()])->save();

            $this->info("  Reminded: {$user->name} → {$sub->title}");
        }

        return self::SUCCESS;
    }
}
