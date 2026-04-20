<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class CoordinatorGroupAssignment extends Model
{
    public $timestamps = false;

    protected $table = 'coordinator_group_assignments';

    protected $fillable = ['coordinator_id', 'group_id'];

    public $incrementing = false;
    protected $primaryKey = null;

    protected $casts = [
        'assigned_at' => 'datetime',
    ];

    public function coordinator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'coordinator_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }
}
