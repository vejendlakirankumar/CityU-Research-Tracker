<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->smallInteger('extension_request_count')->default(0)->after('extension_requested_at');
        });

        // Add Turnitin result columns to submissions
        Schema::table('submissions', function (Blueprint $table) {
            $table->string('turnitin_status', 50)->nullable();
            $table->float('turnitin_score')->nullable();
            $table->text('turnitin_report_url')->nullable();
            $table->timestamp('turnitin_checked_at')->nullable();
        });

        // Bug fix: reset current_stage_id on submissions where no reviewer at the
        // current stage has accepted or completed their review yet (assignment-only stage).
        // This fixes premature stage advancement caused by the old store() code that
        // advanced the stage pointer on assignment instead of on acceptance.
        DB::statement("
            UPDATE submissions
            SET current_stage_id = NULL,
                current_stage_entered_at = NULL
            WHERE current_stage_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM submission_reviewers sr
                  WHERE sr.submission_id = submissions.id
                    AND sr.stage_id = submissions.current_stage_id
                    AND sr.status IN ('accepted', 'completed')
              )
        ");
    }

    public function down(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->dropColumn('extension_request_count');
        });
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['turnitin_status', 'turnitin_score', 'turnitin_report_url', 'turnitin_checked_at']);
        });
    }
};
