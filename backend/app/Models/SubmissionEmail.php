<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionEmail extends Model
{
    use HasUuids;

    protected $table = 'submission_emails';

    protected $fillable = [
        'submission_id', 'stage_id', 'template_id', 'sender_id',
        'recipient_email', 'recipient_name', 'subject', 'body_html', 'body_text',
        'status', 'error', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(StageDefinition::class, 'stage_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(EmailTemplate::class, 'template_id');
    }
}
