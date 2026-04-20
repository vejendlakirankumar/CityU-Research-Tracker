<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppealRequest extends Model
{
    use HasUuids;

    const STATUS_PENDING      = 'PENDING';
    const STATUS_UNDER_REVIEW = 'UNDER_REVIEW';
    const STATUS_UPHELD       = 'UPHELD';
    const STATUS_DISMISSED    = 'DISMISSED';

    protected $fillable = [
        'submission_id',
        'submitter_id',
        'grounds',
        'status',
        'reviewed_by',
        'reviewed_at',
        'resolution_note',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitter_id');
    }
}
