<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeatureFlag extends Model
{
    protected $table = 'feature_flags';
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['key', 'value', 'description'];

    protected function casts(): array
    {
        return ['value' => 'boolean'];
    }

    public static function isEnabled(string $key): bool
    {
        return (bool) static::where('key', $key)->value('value');
    }
}
