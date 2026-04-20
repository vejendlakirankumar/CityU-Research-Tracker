<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Add assignee_user_id and assignee_group_id to reviewer_pools.
 *
 * This enables per-student or per-group reviewer configuration on top of the
 * existing global (default) pool. The scope is:
 *   - Both NULL              → default pool, applies to everyone
 *   - assignee_user_id set   → pool for a specific student
 *   - assignee_group_id set  → pool for a specific student group
 *
 * Because standard UNIQUE constraints treat two NULLs as distinct, we drop the
 * Laravel-managed unique and replace it with a functional index using COALESCE
 * so that (type, stage, reviewer, '', '') is truly unique.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviewer_pools', function (Blueprint $table) {
            // Drop the unique added by the previous migration
            $table->dropUnique(['submission_type_id', 'user_id', 'stage_id']);

            $table->uuid('assignee_user_id')->nullable()->after('stage_id');
            $table->uuid('assignee_group_id')->nullable()->after('assignee_user_id');

            $table->foreign('assignee_user_id')
                  ->references('id')->on('users')->cascadeOnDelete();

            $table->foreign('assignee_group_id')
                  ->references('id')->on('groups')->cascadeOnDelete();
        });

        // Functional unique: treats NULL as empty string so (a, b, NULL) is unique per key
        DB::statement("
            CREATE UNIQUE INDEX reviewer_pools_scope_unique
            ON reviewer_pools (
                submission_type_id,
                stage_id,
                user_id,
                COALESCE(assignee_user_id::text, ''),
                COALESCE(assignee_group_id::text, '')
            )
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS reviewer_pools_scope_unique');

        Schema::table('reviewer_pools', function (Blueprint $table) {
            $table->dropForeign(['assignee_user_id']);
            $table->dropForeign(['assignee_group_id']);
            $table->dropColumn(['assignee_user_id', 'assignee_group_id']);

            $table->unique(['submission_type_id', 'user_id', 'stage_id']);
        });
    }
};
