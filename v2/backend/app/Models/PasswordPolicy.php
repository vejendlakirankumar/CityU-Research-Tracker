<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordPolicy extends Model
{
    protected $table = 'password_policy';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'int';
    public $timestamps = false;

    protected $fillable = [
        'min_length', 'require_uppercase', 'require_number', 'require_special',
        'expiry_days', 'history_count', 'max_login_attempts',
        'lockout_duration_minutes', 'session_timeout_minutes', 'require_2fa',
    ];

    protected function casts(): array
    {
        return [
            'require_uppercase' => 'boolean',
            'require_number'    => 'boolean',
            'require_special'   => 'boolean',
            'require_2fa'       => 'boolean',
        ];
    }
}
