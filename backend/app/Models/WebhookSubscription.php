<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebhookSubscription extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'url', 'events', 'secret_enc', 'description', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'events'    => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class, 'webhook_subscription_id');
    }

    /**
     * Return secret masked for display (never expose raw value).
     */
    public function getMaskedSecretAttribute(): ?string
    {
        return $this->secret_enc ? '••••••••' . substr($this->secret_enc, -4) : null;
    }
}
