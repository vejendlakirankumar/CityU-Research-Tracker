<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewerPool extends Model
{
    protected $table = 'reviewer_pools';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false; // table uses added_at, not created_at/updated_at

    protected $fillable = [
        'id', 'submission_type_id', 'user_id', 'stage_id', 'stage_role_label',
    ];

    protected function casts(): array
    {
        return [
            'added_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function stage()
    {
        return $this->belongsTo(StageDefinition::class, 'stage_id');
    }

    public function submissionType()
    {
        return $this->belongsTo(SubmissionType::class, 'submission_type_id');
    }
}
