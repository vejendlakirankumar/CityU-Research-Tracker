<?php

namespace App\Models;

use Illuminate\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Laravel\Sanctum\HasApiTokens;

class User extends Model implements AuthenticatableContract
{
    use HasApiTokens, HasUuids, Authenticatable;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'email',
        'name',
        'first_name',
        'last_name',
        'organization',
        'org_role',
        'password_hash',
        'roles',
        'program_id',
        'is_active',
        'last_login_at',
        'last_login_attempt_at',
        'last_login_success',
        'failed_login_attempts',
        'locked_at',
        'is_emergency_admin',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'roles'                  => 'array',
            'is_active'              => 'boolean',
            'is_emergency_admin'     => 'boolean',
            'last_login_at'          => 'datetime',
            'last_login_attempt_at'  => 'datetime',
            'last_login_success'     => 'boolean',
            'locked_at'              => 'datetime',
            'failed_login_attempts'  => 'integer',
        ];
    }

    // ── Auth contract ─────────────────────────────────────────────────────────

    public function getAuthIdentifierName(): string
    {
        return 'id';
    }

    public function getAuthIdentifier(): string
    {
        return $this->id;
    }

    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function getRememberToken(): ?string { return null; }
    public function setRememberToken($value): void {}
    public function getRememberTokenName(): string { return ''; }

    // ── Role helpers ──────────────────────────────────────────────────────────

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles ?? [], true);
    }

    public function hasAnyRole(array $roles): bool
    {
        return (bool) array_intersect($roles, $this->roles ?? []);
    }

    public function isAdmin(): bool       { return $this->hasRole('admin'); }
    public function isCoordinator(): bool { return $this->hasRole('coordinator'); }
    public function isReviewer(): bool    { return $this->hasRole('reviewer'); }
    public function isStudent(): bool     { return $this->hasRole('student'); }
    public function isLocked(): bool      { return $this->locked_at !== null; }

    /**
     * Sync the emergency admin user's active state:
     * - Active when no other admin exists
     * - Inactive when at least one other active admin exists
     */
    public static function syncEmergencyAdmin(): void
    {
        $emergency = static::where('is_emergency_admin', true)->first();
        if (!$emergency) return;

        $otherActiveAdmins = static::where('is_emergency_admin', false)
            ->whereRaw("roles @> ?", [json_encode(['admin'])])
            ->where('is_active', true)
            ->exists();

        if ($otherActiveAdmins && $emergency->is_active) {
            $emergency->update(['is_active' => false]);
        } elseif (!$otherActiveAdmins && !$emergency->is_active) {
            $emergency->update(['is_active' => true]);
        }
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'user_groups')
                    ->withPivot('role')
                    ->withTimestamps('joined_at', 'joined_at');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'submitter_id');
    }

    public function stageAssignments(): HasMany
    {
        return $this->hasMany(StageAssignment::class);
    }
}
