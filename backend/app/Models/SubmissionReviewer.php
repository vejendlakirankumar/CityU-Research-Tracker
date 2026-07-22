<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubmissionReviewer extends Model
{
    protected $table = 'submission_reviewers';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id', 'submission_id', 'stage_id', 'user_id', 'assigned_by',
        'status', 'due_at', 'decision', 'decision_at', 'comments',
        'reminder_sent_at',
        // Reviewer-uploaded annotated document
        'annotated_document_path', 'annotated_document_name', 'annotated_document_uploaded_at',
        // Extension request
        'extension_reason', 'extension_requested_days', 'extension_status',
        'extension_requested_at', 'extension_resolved_at', 'extension_request_count',
        // Conflict of interest
        'conflict_flagged', 'conflict_reason', 'conflict_flagged_at',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at'            => 'datetime',
            'decision_at'            => 'datetime',
            'reminder_sent_at'       => 'datetime',
            'extension_requested_at' => 'datetime',
            'extension_resolved_at'  => 'datetime',
            'conflict_flagged_at'    => 'datetime',
            'annotated_document_uploaded_at' => 'datetime',
            'conflict_flagged'       => 'boolean',
            'due_at'                 => 'date',
        ];
    }

    public function submission()
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function stage()
    {
        return $this->belongsTo(StageDefinition::class, 'stage_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
