<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Single-row table for organization branding and settings
        DB::statement("
            CREATE TABLE organization_settings (
                id                          INT PRIMARY KEY DEFAULT 1,
                org_name                    VARCHAR(255) NOT NULL DEFAULT 'Research Review Portal',
                org_short_name              VARCHAR(100),
                logo_path                   VARCHAR(500),
                favicon_path                VARCHAR(500),
                primary_color               VARCHAR(7) DEFAULT '#1E40AF',
                accent_color                VARCHAR(7),
                timezone                    VARCHAR(100) NOT NULL DEFAULT 'UTC',
                locale                      VARCHAR(10) NOT NULL DEFAULT 'en',
                date_format                 VARCHAR(50) NOT NULL DEFAULT 'YYYY-MM-DD',
                footer_text                 TEXT,
                support_email               VARCHAR(255),
                allow_public_registration   BOOLEAN NOT NULL DEFAULT false,
                archive_after_days          INT DEFAULT 365,
                max_file_size_mb_global     INT NOT NULL DEFAULT 10,
                backup_retention_days       INT NOT NULL DEFAULT 90,
                created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT single_org_row CHECK (id = 1)
            )
        ");

        // Single-row email settings
        DB::statement("
            CREATE TABLE email_settings (
                id              INT PRIMARY KEY DEFAULT 1,
                driver          VARCHAR(20) NOT NULL DEFAULT 'log',
                host            VARCHAR(255),
                port            INT DEFAULT 587,
                encryption      VARCHAR(10) DEFAULT 'tls',
                username        VARCHAR(255),
                password_enc    VARCHAR(1000),
                from_address    VARCHAR(255) NOT NULL DEFAULT 'noreply@example.com',
                from_name       VARCHAR(255) NOT NULL DEFAULT 'Research Review Portal',
                reply_to        VARCHAR(255),
                is_verified     BOOLEAN NOT NULL DEFAULT false,
                ses_key_enc     VARCHAR(1000),
                ses_secret_enc  VARCHAR(1000),
                ses_region      VARCHAR(50),
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT single_email_row CHECK (id = 1)
            )
        ");

        // Single-row password policy
        DB::statement("
            CREATE TABLE password_policy (
                id                       INT PRIMARY KEY DEFAULT 1,
                min_length               INT NOT NULL DEFAULT 12,
                require_uppercase        BOOLEAN NOT NULL DEFAULT true,
                require_number           BOOLEAN NOT NULL DEFAULT true,
                require_special          BOOLEAN NOT NULL DEFAULT true,
                expiry_days              INT,
                history_count            INT DEFAULT 5,
                max_login_attempts       INT NOT NULL DEFAULT 5,
                lockout_duration_minutes INT NOT NULL DEFAULT 15,
                session_timeout_minutes  INT NOT NULL DEFAULT 480,
                require_2fa              BOOLEAN NOT NULL DEFAULT false,
                CONSTRAINT single_policy_row CHECK (id = 1)
            )
        ");

        Schema::create('feature_flags', function (Blueprint $table) {
            $table->string('key', 100)->primary();
            $table->boolean('value')->default(false);
            $table->text('description')->nullable();
            $table->timestampTz('updated_at')->default(DB::raw('now()'));
        });

        Schema::create('sso_providers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name', 255);
            $table->string('protocol', 10);
            // 'SAML2' | 'OIDC' | 'OAUTH2'
            $table->boolean('is_enabled')->default(false);
            $table->boolean('is_default')->default(false);
            $table->string('button_label', 255)->nullable();
            $table->string('button_icon_url', 500)->nullable();
            $table->jsonb('config')->default('{}');
            $table->boolean('auto_provision_users')->default(true);
            $table->string('default_role', 50)->default('student');
            $table->timestampsTz();
        });

        DB::statement(
            "CREATE UNIQUE INDEX uq_one_default_sso ON sso_providers(is_default) WHERE is_default = true"
        );

        Schema::create('notification_templates', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('event_type', 100)->unique();
            $table->string('subject', 500);
            $table->text('body_html');
            $table->text('body_text');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_templates');
        Schema::dropIfExists('sso_providers');
        Schema::dropIfExists('feature_flags');
        DB::statement('DROP TABLE IF EXISTS password_policy');
        DB::statement('DROP TABLE IF EXISTS email_settings');
        DB::statement('DROP TABLE IF EXISTS organization_settings');
    }
};
