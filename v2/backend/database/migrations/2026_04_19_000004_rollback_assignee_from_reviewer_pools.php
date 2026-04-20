<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Roll back migration 000003 (per-author/group scoping on reviewer_pools).
 *
 * The assignee approach was wrong for a journal review portal.
 * Reviewer assignment belongs to individual submissions, handled by
 * submission_reviewers (migration 000006), not pre-configured at the
 * submission-type level.
 *
 * This migration restores reviewer_pools to a simple "default suggestion pool"
 * scoped only by (submission_type_id, user_id, stage_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Drop the COALESCE-based functional unique index added in 000003
        DB::statement('DROP INDEX IF EXISTS reviewer_pools_scope_unique');

        Schema::table('reviewer_pools', function (Blueprint $table) {
            if (Schema::hasColumn('reviewer_pools', 'assignee_user_id')) {
                $table->dropForeign(['assignee_user_id']);
                $table->dropColumn('assignee_user_id');
            }
            if (Schema::hasColumn('reviewer_pools', 'assignee_group_id')) {
                $table->dropForeign(['assignee_group_id']);
                $table->dropColumn('assignee_group_id');
            }

            // Restore the clean unique constraint
            $table->unique(['submission_type_id', 'user_id', 'stage_id']);
        });
    }

    public function down(): void
    {
        Schema::table('reviewer_pools', function (Blueprint $table) {
            $table->dropUnique(['submission_type_id', 'user_id', 'stage_id']);

            $table->uuid('assignee_user_id')->nullable();
            $table->uuid('assignee_group_id')->nullable();
            $table->foreign('assignee_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('assignee_group_id')->references('id')->on('groups')->cascadeOnDelete();
        });

        DB::statement("
            CREATE UNIQUE INDEX reviewer_pools_scope_unique
            ON reviewer_pools (
                submission_type_id, stage_id, user_id,
                COALESCE(assignee_user_id::text, ''),
                COALESCE(assignee_group_id::text, '')
            )
        ");
    }
};
