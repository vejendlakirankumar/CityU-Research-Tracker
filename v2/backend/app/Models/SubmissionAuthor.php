<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubmissionAuthor extends Model
{
    protected $table = 'submission_authors';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id', 'submission_id', 'user_id', 'name', 'email',
        'affiliation', 'is_corresponding', 'author_order',
        'invite_token', 'invited_at', 'joined_at',
    ];

    protected function casts(): array
    {
        return [
            'is_corresponding' => 'boolean',
            'author_order'     => 'integer',
            'invited_at'       => 'datetime',
            'joined_at'        => 'datetime',
            'added_at'         => 'datetime',
        ];
    }

    public function submission()
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
