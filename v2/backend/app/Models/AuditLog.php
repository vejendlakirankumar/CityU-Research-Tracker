<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'submission_id', 'actor_id', 'action',
        'before_state', 'after_state', 'data',
        'ip_address', 'user_agent', 'request_id',
    ];

    protected function casts(): array
    {
        return [
            'before_state' => 'array',
            'after_state'  => 'array',
            'data'         => 'array',
            'created_at'   => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
