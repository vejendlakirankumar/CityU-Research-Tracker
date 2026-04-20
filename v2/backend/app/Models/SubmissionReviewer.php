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
    ];

    protected function casts(): array
    {
        return [
            'assigned_at'       => 'datetime',
            'decision_at'       => 'datetime',
            'reminder_sent_at'  => 'datetime',
            'due_at'            => 'date',
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
