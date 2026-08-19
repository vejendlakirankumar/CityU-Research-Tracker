<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the default feature-flag rows. Idempotent and production-safe:
 * it never overwrites an existing flag's value (only inserts missing keys),
 * so operators' toggles are preserved on re-run.
 *
 * Run on production with:
 *   php artisan db:seed --class=FeatureFlagsSeeder --force
 */
class FeatureFlagsSeeder extends Seeder
{
    public function run(): void
    {
        $flags = [
            ['key' => 'sso_enabled',           'value' => false, 'description' => 'Enable SSO login button'],
            ['key' => 'public_registration',   'value' => false, 'description' => 'Allow self-registration'],
            ['key' => 'webhooks_enabled',      'value' => false, 'description' => 'Enable webhook delivery'],
            ['key' => 'allow_appeals',         'value' => true,  'description' => 'Allow appeal requests'],
            ['key' => 'allow_meetings',        'value' => true,  'description' => 'Enable meeting scheduling'],
            ['key' => 'realtime_notifications','value' => false, 'description' => 'Enable WebSocket (Reverb) notifications'],
            ['key' => 'reviewer_pool_enabled', 'value' => true,  'description' => 'Enable reviewer pool management'],
            ['key' => 'audit_log_enabled',     'value' => true,  'description' => 'Log all audit events'],
            ['key' => 'file_storage_s3',       'value' => false, 'description' => 'Use S3 for file storage (else local)'],
        ];

        foreach ($flags as $flag) {
            // insertOrIgnore preserves any value an operator has already toggled.
            DB::table('feature_flags')->insertOrIgnore([
                'key'         => $flag['key'],
                'value'       => $flag['value'],
                'description' => $flag['description'],
                'updated_at'  => now(),
            ]);
        }
    }
}
