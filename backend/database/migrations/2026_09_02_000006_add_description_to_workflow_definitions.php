<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS description TEXT');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE workflow_definitions DROP COLUMN IF EXISTS description');
    }
};
