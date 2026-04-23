<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds:
 * - review_settings columns to organization_settings
 *   (grace_period_days, grace_period_consider_holidays, grace_period_holidays_country, max_extension_requests)
 * - integration_settings table (Turnitin, storage providers)
 * - storage_settings table (S3 + Azure Blob configuration)
 * - backup_catalog table
 * - archive_catalog table
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Extend organization_settings ──────────────────────────────────────
        DB::statement("
            ALTER TABLE organization_settings
                ADD COLUMN IF NOT EXISTS review_grace_period_days       SMALLINT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS grace_period_consider_holidays  BOOLEAN  NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS grace_period_holidays_country   VARCHAR(5),
                ADD COLUMN IF NOT EXISTS max_extension_requests          SMALLINT NOT NULL DEFAULT 3
        ");

        // ── Integration settings (key-value JSON store) ───────────────────────
        DB::statement("
            CREATE TABLE IF NOT EXISTS integration_settings (
                key         VARCHAR(100) PRIMARY KEY,
                settings    JSONB NOT NULL DEFAULT '{}',
                is_enabled  BOOLEAN NOT NULL DEFAULT false,
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        ");

        // Seed Turnitin, S3, Azure rows
        DB::table('integration_settings')->insertOrIgnore([
            ['key' => 'turnitin',     'settings' => json_encode(['api_key' => '', 'api_url' => 'https://api.turnitin.com', 'webhook_secret' => '']), 'is_enabled' => false, 'updated_at' => now()],
            ['key' => 's3_storage',   'settings' => json_encode(['access_key' => '', 'secret_key' => '', 'region' => 'us-east-1', 'bucket' => '', 'endpoint' => '']),  'is_enabled' => false, 'updated_at' => now()],
            ['key' => 'azure_blob',   'settings' => json_encode(['connection_string' => '', 'account_name' => '', 'account_key' => '', 'container' => '', 'sas_token' => '']), 'is_enabled' => false, 'updated_at' => now()],
            ['key' => 'azure_backup', 'settings' => json_encode(['connection_string' => '', 'account_name' => '', 'account_key' => '', 'container' => 'backups', 'sas_token' => '']), 'is_enabled' => false, 'updated_at' => now()],
            ['key' => 's3_backup',    'settings' => json_encode(['access_key' => '', 'secret_key' => '', 'region' => 'us-east-1', 'bucket' => '', 'prefix' => 'backups/', 'endpoint' => '']), 'is_enabled' => false, 'updated_at' => now()],
        ]);

        // ── Backup catalog ────────────────────────────────────────────────────
        DB::statement("
            CREATE TABLE IF NOT EXISTS backup_catalog (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                filename        VARCHAR(500) NOT NULL,
                storage_type    VARCHAR(20) NOT NULL DEFAULT 'local',
                -- local | s3 | azure
                storage_path    TEXT NOT NULL,
                size_bytes      BIGINT,
                checksum_sha256 VARCHAR(64),
                status          VARCHAR(20) NOT NULL DEFAULT 'completed',
                -- completed | failed | uploading
                notes           TEXT,
                created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
                restored_at     TIMESTAMPTZ,
                restored_by     UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_backup_catalog_created ON backup_catalog(created_at DESC)');

        // ── Archive catalog ───────────────────────────────────────────────────
        DB::statement("
            CREATE TABLE IF NOT EXISTS archive_catalog (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                archived_by     UUID REFERENCES users(id) ON DELETE SET NULL,
                storage_type    VARCHAR(20) NOT NULL DEFAULT 'local',
                -- local | s3 | azure
                storage_path    TEXT,
                size_bytes      BIGINT,
                archive_reason  VARCHAR(50) NOT NULL DEFAULT 'age',
                -- age | manual | policy
                restored_at     TIMESTAMPTZ,
                restored_by     UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        ");

        DB::statement('CREATE INDEX IF NOT EXISTS idx_archive_catalog_submission ON archive_catalog(submission_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_archive_catalog_created ON archive_catalog(created_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS archive_catalog');
        DB::statement('DROP TABLE IF EXISTS backup_catalog');
        DB::statement('DROP TABLE IF EXISTS integration_settings');

        DB::statement("
            ALTER TABLE organization_settings
                DROP COLUMN IF EXISTS review_grace_period_days,
                DROP COLUMN IF EXISTS grace_period_consider_holidays,
                DROP COLUMN IF EXISTS grace_period_holidays_country,
                DROP COLUMN IF EXISTS max_extension_requests
        ");
    }
};
