<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS graph_tenant_id VARCHAR(255)");
        DB::statement("ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS graph_client_id VARCHAR(255)");
        DB::statement("ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS graph_client_secret_enc VARCHAR(1000)");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE email_settings DROP COLUMN IF EXISTS graph_tenant_id");
        DB::statement("ALTER TABLE email_settings DROP COLUMN IF EXISTS graph_client_id");
        DB::statement("ALTER TABLE email_settings DROP COLUMN IF EXISTS graph_client_secret_enc");
    }
};
