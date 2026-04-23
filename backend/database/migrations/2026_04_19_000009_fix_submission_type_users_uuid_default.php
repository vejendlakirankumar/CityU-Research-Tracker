<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // The original migration used PHP Str::uuid() at migration-time, producing
        // a static hardcoded UUID as the column default. Every INSERT therefore
        // attempted to reuse the same UUID, causing a primary-key violation on the
        // second row. Fix: use PostgreSQL's gen_random_uuid() as a real DB function.
        DB::statement('ALTER TABLE submission_type_users ALTER COLUMN id SET DEFAULT gen_random_uuid()');
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE submission_type_users ALTER COLUMN id DROP DEFAULT");
    }
};
