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

    /** Runtime-only active-role override from the X-Active-Role header. Never persisted. */
    protected ?string $activeRoleOverride = null;

    /** Honour an active role only when the user actually holds it; otherwise ignore. */
    public function applyActiveRole(?string $role): void
    {
        $this->activeRoleOverride = ($role && in_array($role, $this->roles ?? [], true)) ? $role : null;
    }

    public function getActiveRole(): ?string
    {
        return $this->activeRoleOverride;
    }

    /**
     * Roles effective for authorization: the single active role when one is set,
     * otherwise the union of all assigned roles. `$this->roles` always stays the
     * full real list (so /auth/me can render the role switcher).
     */
    public function effectiveRoles(): array
    {
        return $this->activeRoleOverride !== null ? [$this->activeRoleOverride] : ($this->roles ?? []);
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->effectiveRoles(), true);
    }

    public function hasAnyRole(array $roles): bool
    {
        return (bool) array_intersect($roles, $this->effectiveRoles());
    }

    public function isAdmin(): bool       { return $this->hasRole('admin'); }
    public function isCoordinator(): bool { return $this->hasRole('coordinator'); }
    public function isReviewer(): bool    { return $this->hasRole('reviewer'); }
    public function isStudent(): bool     { return $this->hasRole('student'); }
    public function isLocked(): bool      { return $this->locked_at !== null; }

    /**
     * Access-token lifetime. Ties the Sanctum bearer-token expiry to the admin-configured
     * session timeout (falls back to SANCTUM_TOKEN_TTL_MINUTES, then 8 hours) so a stolen
     * token cannot be replayed indefinitely. Returns null only when a non-positive timeout
     * is configured (never-expire — not recommended).
     */
    public static function tokenExpiresAt(): ?\Illuminate\Support\Carbon
    {
        $minutes = (int) (\App\Models\PasswordPolicy::find(1)?->session_timeout_minutes
            ?? env('SANCTUM_TOKEN_TTL_MINUTES', 480));

        return $minutes > 0 ? now()->addMinutes($minutes) : null;
    }

    /**
     * Sync the emergency admin user's active state:
     * - Active when no other admin exists
     * - Inactive when at least one other active admin exists
     */
    public static function syncEmergencyAdmin(): void
    {
        $emergency = static::where('is_emergency_admin', true)->first();
        if (!$emergency) return;

        // Optional break-glass override for operational recovery scenarios.
        $forceEnable = filter_var((string) env('ENABLE_EMERGENCY_ADMIN', false), FILTER_VALIDATE_BOOLEAN);
        if ($forceEnable) {
            if (!$emergency->is_active) {
                $emergency->update(['is_active' => true]);
            }
            return;
        }

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
