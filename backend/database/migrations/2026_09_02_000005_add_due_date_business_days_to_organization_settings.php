<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE organization_settings
                ADD COLUMN IF NOT EXISTS due_date_exclude_weekends  BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS due_date_consider_holidays BOOLEAN NOT NULL DEFAULT false
        SQL);
    }

    public function down(): void
    {
        DB::statement(<<<SQL
            ALTER TABLE organization_settings
                DROP COLUMN IF EXISTS due_date_exclude_weekends,
                DROP COLUMN IF EXISTS due_date_consider_holidays
        SQL);
    }
};
