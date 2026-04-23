<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class SubmissionVersion extends Model
{
    use HasUuids;

    protected $table = 'submission_versions';

    protected $fillable = [
        'submission_id', 'version_number', 'document_paths',
        'change_summary', 'submitted_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'document_paths' => 'array',
            'submitted_at'   => 'datetime',
        ];
    }

    public $timestamps = false;

    // ── Relationships ─────────────────────────────────────────────────────────

    public function submission()
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
