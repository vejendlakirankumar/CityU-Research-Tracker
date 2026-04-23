<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Create submission_reviewers table.
 *
 * Per-submission reviewer assignment. A coordinator/admin assigns
 * specific reviewers to a submission + stage combination. This is
 * independent of the workflow runtime (stage_instances / stage_assignments)
 * so reviewers can be configured before or after the workflow starts.
 *
 * Statuses:
 *   pending   → assigned but reviewer has not responded
 *   accepted  → reviewer agreed to review
 *   declined  → reviewer declined
 *   completed → reviewer has submitted their decision
 *
 * Decisions (set when completed):
 *   approve | reject | revise
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_reviewers', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('stage_id');               // stage_definitions.id
            $table->uuid('user_id');                // the reviewer
            $table->uuid('assigned_by');            // coordinator or admin
            $table->timestampTz('assigned_at')->default(DB::raw('now()'));
            $table->string('status', 20)->default('pending');
            // pending | accepted | declined | completed
            $table->date('due_at')->nullable();
            $table->string('decision', 20)->nullable();
            // approve | reject | revise
            $table->timestampTz('decision_at')->nullable();
            $table->text('comments')->nullable();
            $table->timestampTz('reminder_sent_at')->nullable();

            // A reviewer can only be assigned once per submission + stage
            $table->unique(['submission_id', 'stage_id', 'user_id']);

            $table->foreign('submission_id')
                  ->references('id')->on('submissions')
                  ->cascadeOnDelete();

            $table->foreign('stage_id')
                  ->references('id')->on('stage_definitions')
                  ->cascadeOnDelete();

            $table->foreign('user_id')
                  ->references('id')->on('users');

            $table->foreign('assigned_by')
                  ->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_sub_reviewers_submission ON submission_reviewers(submission_id, stage_id)');
        DB::statement('CREATE INDEX idx_sub_reviewers_user ON submission_reviewers(user_id, status)');
        DB::statement('CREATE INDEX idx_sub_reviewers_status ON submission_reviewers(status)');
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_reviewers');
    }
};
