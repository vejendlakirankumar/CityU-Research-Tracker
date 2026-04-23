<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class NotificationTemplate extends Model
{
    use HasUuids;

    protected $table = 'notification_templates';

    protected $fillable = [
        'event_type', 'subject', 'body_html', 'body_text', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * Known template variables available per event type.
     */
    public static function variablesFor(string $eventType): array
    {
        $common = ['{{user_name}}', '{{submission_title}}', '{{portal_url}}', '{{support_email}}'];

        return match ($eventType) {
            'SUBMISSION_RECEIVED' => [...$common, '{{submission_id}}', '{{program_name}}'],
            'STAGE_ASSIGNED'      => [...$common, '{{due_date}}', '{{stage_name}}', '{{reviewer_name}}'],
            'REVISION_REQUIRED'   => [...$common, '{{comments}}', '{{due_date}}'],
            'SUBMISSION_ACCEPTED' => [...$common, '{{program_name}}'],
            'SUBMISSION_REJECTED' => [...$common, '{{program_name}}'],
            'STAGE_OVERDUE'       => [...$common, '{{due_date}}', '{{days_overdue}}'],
            'APPEAL_SUBMITTED'    => [...$common, '{{appeal_reason}}'],
            default               => $common,
        };
    }
}
