<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSsoIdentity extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'user_sso_identities';

    protected $fillable = [
        'user_id',
        'provider_id',
        'provider_sub',
        'provider_email',
    ];

    protected $casts = [
        'linked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(SsoProvider::class, 'provider_id');
    }
}
