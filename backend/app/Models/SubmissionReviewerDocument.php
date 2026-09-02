<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionReviewerDocument extends Model
{
    use HasUuids;

    protected $table = 'submission_reviewer_documents';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'submission_reviewer_id', 'path', 'name', 'size', 'uploaded_at',
    ];

    protected function casts(): array
    {
        return [
            'size'        => 'integer',
            'uploaded_at' => 'datetime',
        ];
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(SubmissionReviewer::class, 'submission_reviewer_id');
    }
}
