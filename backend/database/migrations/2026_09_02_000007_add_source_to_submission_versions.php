<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Marks who originated a version: the submitter (default) or a reviewer
        // who promoted their lightly-edited copy so later stages review the latest.
        DB::statement("ALTER TABLE submission_versions ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'submitter'");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE submission_versions DROP COLUMN IF EXISTS source');
    }
};
