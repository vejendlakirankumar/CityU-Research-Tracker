<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Facades\Crypt;

class SsoProvider extends Model
{
    use HasUuids;

    protected $table = 'sso_providers';

    /** Config keys stored encrypted. */
    private const SECRET_KEYS = ['client_secret', 'private_key'];

    protected $fillable = [
        'name', 'protocol', 'is_enabled', 'is_default',
        'button_label', 'button_icon_url', 'config',
        'auto_provision_users', 'default_role',
    ];

    protected function casts(): array
    {
        return [
            'config'               => 'array',
            'is_enabled'           => 'boolean',
            'is_default'           => 'boolean',
            'auto_provision_users' => 'boolean',
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Store config, encrypting secret sub-keys.
     */
    public function setConfigSafely(array $config): void
    {
        $stored = $this->config ?? [];

        foreach ($config as $k => $v) {
            if (in_array($k, self::SECRET_KEYS, true)) {
                // Keep existing if placeholder or empty
                if ($v !== '' && $v !== null && $v !== '••••••••') {
                    $stored[$k] = Crypt::encryptString((string) $v);
                }
            } else {
                $stored[$k] = $v;
            }
        }

        $this->config = $stored;
    }

    /**
     * Return config safe for the API (secrets redacted).
     */
    public function toApiConfig(): array
    {
        $cfg = $this->config ?? [];
        foreach (self::SECRET_KEYS as $key) {
            if (isset($cfg[$key])) {
                $cfg[$key] = '[set]';
            }
        }
        return $cfg;
    }

    /**
     * Return decrypted config for internal use (building OAuth2 redirects).
     */
    public function decryptedConfig(): array
    {
        $cfg = $this->config ?? [];
        foreach (self::SECRET_KEYS as $key) {
            if (!empty($cfg[$key]) && $cfg[$key] !== '[set]') {
                try {
                    $cfg[$key] = Crypt::decryptString($cfg[$key]);
                } catch (\Exception) {
                    $cfg[$key] = null;
                }
            }
        }
        return $cfg;
    }

    /**
     * Build OIDC / OAuth2 authorization URL parameters.
     */
    public function buildAuthorizationUrl(string $state, string $redirectUri): ?string
    {
        $cfg = $this->decryptedConfig();

        $authUrl = match ($this->protocol) {
            'OIDC', 'OAUTH2' => $cfg['authorization_url']
                ?? "https://login.microsoftonline.com/{$cfg['tenant_id']}/oauth2/v2.0/authorize",
            default => null,
        };

        if (!$authUrl) {
            return null;
        }

        $params = http_build_query([
            'client_id'     => $cfg['client_id'] ?? '',
            'response_type' => 'code',
            'redirect_uri'  => $redirectUri,
            'scope'         => $cfg['scopes'] ?? 'openid email profile',
            'state'         => $state,
            'response_mode' => 'query',
        ]);

        return $authUrl . '?' . $params;
    }
}
