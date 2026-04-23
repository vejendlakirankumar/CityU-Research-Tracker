<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntegrationSetting extends Model
{
    protected $table      = 'integration_settings';
    protected $primaryKey = 'key';
    public $incrementing  = false;
    protected $keyType    = 'string';
    public $timestamps    = false;

    protected $fillable = ['key', 'settings', 'is_enabled', 'updated_at'];

    protected function casts(): array
    {
        return [
            'settings'   => 'array',
            'is_enabled' => 'boolean',
            'updated_at' => 'datetime',
        ];
    }

    public static function for(string $key): self
    {
        return static::firstOrCreate(
            ['key' => $key],
            ['settings' => [], 'is_enabled' => false, 'updated_at' => now()]
        );
    }

    public function get(string $field, mixed $default = null): mixed
    {
        return $this->settings[$field] ?? $default;
    }
}
