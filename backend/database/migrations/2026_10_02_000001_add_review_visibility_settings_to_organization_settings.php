<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE organization_settings
                ADD COLUMN IF NOT EXISTS due_date_visibility VARCHAR(20) NOT NULL DEFAULT 'all_stages',
                ADD COLUMN IF NOT EXISTS reviewers_can_view_future_submissions BOOLEAN NOT NULL DEFAULT true
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE organization_settings
                DROP COLUMN IF EXISTS due_date_visibility,
                DROP COLUMN IF EXISTS reviewers_can_view_future_submissions
        SQL);
    }
};
