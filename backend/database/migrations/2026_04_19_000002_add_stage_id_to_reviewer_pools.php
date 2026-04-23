<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Replace stage_role_label with stage_id on reviewer_pools.
 *
 * Problem: multiple stages can share the same stage_role_label (e.g. "reviewer"),
 * causing every stage in a workflow to show the same pool entries.
 * Fix: key the pool by the stage's UUID so each stage has an independent reviewer pool.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviewer_pools', function (Blueprint $table) {
            // Drop old unique constraint before altering columns
            $table->dropUnique(['submission_type_id', 'user_id', 'stage_role_label']);

            // Add stage_id column referencing stage_definitions
            $table->uuid('stage_id')->nullable()->after('user_id');
            $table->foreign('stage_id')
                  ->references('id')
                  ->on('stage_definitions')
                  ->cascadeOnDelete();

            // New unique constraint: one entry per (submission_type, user, stage)
            $table->unique(['submission_type_id', 'user_id', 'stage_id']);
        });
    }

    public function down(): void
    {
        Schema::table('reviewer_pools', function (Blueprint $table) {
            $table->dropForeign(['stage_id']);
            $table->dropUnique(['submission_type_id', 'user_id', 'stage_id']);
            $table->dropColumn('stage_id');

            $table->unique(['submission_type_id', 'user_id', 'stage_role_label']);
        });
    }
};
