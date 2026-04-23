<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class EmailSetting extends Model
{
    protected $table = 'email_settings';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'int';

    /** Columns stored encrypted at rest (AES via Laravel Crypt). */
    private const ENCRYPTED = ['password_enc', 'ses_key_enc', 'ses_secret_enc'];

    protected $fillable = [
        'driver', 'host', 'port', 'encryption', 'username',
        'password_enc', 'from_address', 'from_name', 'reply_to',
        'is_verified', 'ses_key_enc', 'ses_secret_enc', 'ses_region',
    ];

    protected function casts(): array
    {
        return [
            'port'        => 'integer',
            'is_verified' => 'boolean',
        ];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'driver'       => 'log',
            'from_address' => 'noreply@example.com',
            'from_name'    => 'Research Review Portal',
        ]);
    }

    // ── Encrypt/decrypt helpers ───────────────────────────────────────────────

    public function setPasswordEncAttribute(?string $value): void
    {
        // Empty string = keep existing encrypted value (UI placeholder "••••")
        if ($value !== null && $value !== '' && $value !== '••••••••') {
            $this->attributes['password_enc'] = Crypt::encryptString($value);
        }
    }

    public function setSesKeyEncAttribute(?string $value): void
    {
        if ($value !== null && $value !== '' && $value !== '••••••••') {
            $this->attributes['ses_key_enc'] = Crypt::encryptString($value);
        }
    }

    public function setSesSecretEncAttribute(?string $value): void
    {
        if ($value !== null && $value !== '' && $value !== '••••••••') {
            $this->attributes['ses_secret_enc'] = Crypt::encryptString($value);
        }
    }

    /**
     * Build a PHP mail config array suitable for dynamic mailer configuration.
     */
    public function toMailerConfig(): array
    {
        $password = null;
        try {
            $password = $this->attributes['password_enc']
                ? Crypt::decryptString($this->attributes['password_enc'])
                : null;
        } catch (\Exception) {
        }

        return match ($this->driver) {
            'smtp' => [
                'transport'  => 'smtp',
                'host'       => $this->host,
                'port'       => $this->port,
                'encryption' => $this->encryption ?: null,
                'username'   => $this->username,
                'password'   => $password,
            ],
            'ses' => [
                'transport' => 'ses',
                'key'       => $this->attributes['ses_key_enc']
                    ? Crypt::decryptString($this->attributes['ses_key_enc'])
                    : null,
                'secret'    => $this->attributes['ses_secret_enc']
                    ? Crypt::decryptString($this->attributes['ses_secret_enc'])
                    : null,
                'region'    => $this->ses_region ?? 'us-east-1',
            ],
            default => ['transport' => 'log'],
        };
    }

    /**
     * Return settings safe for the API response (passwords redacted).
     */
    public function toApiArray(): array
    {
        return [
            'id'           => $this->id,
            'driver'       => $this->driver,
            'host'         => $this->host,
            'port'         => $this->port,
            'encryption'   => $this->encryption,
            'username'     => $this->username,
            'password_set' => !empty($this->attributes['password_enc']),
            'from_address' => $this->from_address,
            'from_name'    => $this->from_name,
            'reply_to'     => $this->reply_to,
            'is_verified'  => $this->is_verified,
            'ses_region'   => $this->ses_region,
            'ses_key_set'  => !empty($this->attributes['ses_key_enc']),
            'ses_secret_set' => !empty($this->attributes['ses_secret_enc']),
            'updated_at'   => $this->updated_at,
        ];
    }
}
