<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds the default email notification templates. Idempotent and
 * production-safe: it uses insertOrIgnore keyed on the unique event_type,
 * so any template an operator has already edited is left untouched.
 *
 * Run on production with:
 *   php artisan db:seed --class=NotificationTemplatesSeeder --force
 */
class NotificationTemplatesSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            [
                'event_type' => 'SUBMISSION_RECEIVED',
                'subject'    => 'Submission Received: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your submission "<strong>{{submission_title}}</strong>" has been received and is under review.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" has been received.",
            ],
            [
                'event_type' => 'STAGE_ASSIGNED',
                'subject'    => 'Review Assignment: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>You have been assigned to review "<strong>{{submission_title}}</strong>".</p><p>Due date: {{due_date}}</p>',
                'body_text'  => "Dear {{user_name}},\n\nYou have been assigned to review \"{{submission_title}}\".\nDue: {{due_date}}",
            ],
            [
                'event_type' => 'REVISION_REQUIRED',
                'subject'    => 'Revision Required: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your submission "<strong>{{submission_title}}</strong>" requires revision. Please review the comments and resubmit.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" requires revision.",
            ],
            [
                'event_type' => 'SUBMISSION_ACCEPTED',
                'subject'    => 'Submission Accepted: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Congratulations! Your submission "<strong>{{submission_title}}</strong>" has been accepted.</p>',
                'body_text'  => "Dear {{user_name}},\n\nCongratulations! Your submission \"{{submission_title}}\" has been accepted.",
            ],
            [
                'event_type' => 'SUBMISSION_REJECTED',
                'subject'    => 'Submission Outcome: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>After careful review, your submission "<strong>{{submission_title}}</strong>" was not accepted at this time.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" was not accepted.",
            ],
            [
                'event_type' => 'STAGE_OVERDUE',
                'subject'    => 'Action Required: Review Overdue for {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your review of "<strong>{{submission_title}}</strong>" is now overdue. Please submit your review at your earliest convenience.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour review of \"{{submission_title}}\" is overdue.",
            ],
            [
                'event_type' => 'STAGE_DUE_SOON',
                'subject'    => 'Reminder: Review Due Soon for {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>This is a friendly reminder that your review of "<strong>{{submission_title}}</strong>" for stage <strong>{{stage_name}}</strong> is due on <strong>{{due_date}}</strong>. Please submit it before the deadline.</p>',
                'body_text'  => "Dear {{user_name}},\n\nReminder: your review of \"{{submission_title}}\" (stage {{stage_name}}) is due on {{due_date}}.",
            ],
            [
                'event_type' => 'APPEAL_SUBMITTED',
                'subject'    => 'Appeal Received for {{submission_title}}',
                'body_html'  => '<p>An appeal has been submitted for "<strong>{{submission_title}}</strong>" and is awaiting coordinator review.</p>',
                'body_text'  => "An appeal has been submitted for \"{{submission_title}}\".",
            ],
        ];

        foreach ($templates as $template) {
            DB::table('notification_templates')->insertOrIgnore(array_merge($template, [
                'id'         => (string) Str::uuid(),
                'is_active'  => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }
}
