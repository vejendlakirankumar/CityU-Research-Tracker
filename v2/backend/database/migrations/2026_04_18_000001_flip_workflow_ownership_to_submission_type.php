<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Flip workflow ownership:
 *   BEFORE: workflow_definitions.submission_type_id (N workflows → 1 type)
 *   AFTER:  submission_types.workflow_id (1 type → 1 workflow, same workflow can be reused)
 *
 * This allows the same workflow to be attached to multiple submission types.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Drop unique constraint and FK on workflow_definitions.submission_type_id
        Schema::table('workflow_definitions', function (Blueprint $table) {
            // Drop the composite unique index (submission_type_id, is_active)
            $table->dropUnique(['submission_type_id', 'is_active']);
            $table->dropForeign(['submission_type_id']);
            $table->dropColumn('submission_type_id');
        });

        // 2. Add workflow_id (nullable) to submission_types
        Schema::table('submission_types', function (Blueprint $table) {
            $table->uuid('workflow_id')->nullable()->after('is_active');
            $table->foreign('workflow_id')
                ->references('id')
                ->on('workflow_definitions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        // Reverse: remove workflow_id from submission_types
        Schema::table('submission_types', function (Blueprint $table) {
            $table->dropForeign(['workflow_id']);
            $table->dropColumn('workflow_id');
        });

        // Re-add submission_type_id to workflow_definitions
        Schema::table('workflow_definitions', function (Blueprint $table) {
            $table->uuid('submission_type_id')->nullable()->after('id');
            $table->foreign('submission_type_id')
                ->references('id')
                ->on('submission_types');
            $table->unique(['submission_type_id', 'is_active']);
        });
    }
};
