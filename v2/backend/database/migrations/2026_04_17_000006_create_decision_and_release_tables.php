<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── Immutable decision records ────────────────────────────────────────
        Schema::create('review_decisions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('stage_instance_id');
            $table->uuid('submission_id');
            $table->integer('version_number');
            $table->uuid('reviewer_id');
            $table->string('decision', 100);
            // Must match a decision_options.value in the stage's stage_definition
            $table->text('comments')->nullable();
            $table->timestampTz('submitted_at')->default(DB::raw('now()'));

            $table->unique(['stage_instance_id', 'reviewer_id']);
            $table->foreign('stage_instance_id')->references('id')->on('stage_instances');
            $table->foreign('submission_id')->references('id')->on('submissions');
            $table->foreign('reviewer_id')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_decisions_stage ON review_decisions(stage_instance_id)');
        DB::statement('CREATE INDEX idx_decisions_submission ON review_decisions(submission_id, version_number)');
        DB::statement('CREATE INDEX idx_decisions_reviewer ON review_decisions(reviewer_id)');

        // Prevent UPDATE and DELETE (immutable)
        DB::statement('CREATE RULE no_update_decisions AS ON UPDATE TO review_decisions DO INSTEAD NOTHING');
        DB::statement('CREATE RULE no_delete_decisions AS ON DELETE TO review_decisions DO INSTEAD NOTHING');

        // ── Gated releases ────────────────────────────────────────────────────
        Schema::create('gated_releases', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('workflow_run_id');
            $table->integer('version_number');
            $table->string('decision', 50);
            // ACCEPTED | CONDITIONALLY_ACCEPTED | REVISION_REQUIRED | REJECTED
            $table->text('feedback')->nullable();
            $table->uuid('released_by');
            $table->timestampTz('released_at')->default(DB::raw('now()'));

            $table->unique('workflow_run_id');
            $table->foreign('submission_id')->references('id')->on('submissions')->cascadeOnDelete();
            $table->foreign('workflow_run_id')->references('id')->on('workflow_runs');
            $table->foreign('released_by')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_gated_releases_submission ON gated_releases(submission_id)');
        DB::statement('CREATE RULE no_update_releases AS ON UPDATE TO gated_releases DO INSTEAD NOTHING');
        DB::statement('CREATE RULE no_delete_releases AS ON DELETE TO gated_releases DO INSTEAD NOTHING');

        // ── Appeals ───────────────────────────────────────────────────────────
        Schema::create('appeal_requests', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('submitter_id');
            $table->text('grounds');
            $table->string('status', 20)->default('PENDING');
            // PENDING | UNDER_REVIEW | UPHELD | DISMISSED
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('submission_id')->references('id')->on('submissions');
            $table->foreign('submitter_id')->references('id')->on('users');
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
        });

        // ── Meetings ──────────────────────────────────────────────────────────
        Schema::create('meetings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->string('title', 255);
            $table->timestampTz('scheduled_at');
            $table->integer('duration_min')->default(60);
            $table->string('location', 500)->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by');
            $table->jsonb('attendees')->default('[]');
            $table->timestampsTz();

            $table->foreign('submission_id')->references('id')->on('submissions')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_meetings_submission ON meetings(submission_id)');

        // ── Escalation logs ───────────────────────────────────────────────────
        Schema::create('escalation_logs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('stage_instance_id');
            $table->jsonb('escalated_to');
            $table->string('action_taken', 50);
            // NOTIFY_ONLY | REASSIGN | ADD_PARALLEL_APPROVER
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('stage_instance_id')->references('id')->on('stage_instances');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('escalation_logs');
        Schema::dropIfExists('meetings');
        Schema::dropIfExists('appeal_requests');
        Schema::dropIfExists('gated_releases');
        Schema::dropIfExists('review_decisions');
    }
};
