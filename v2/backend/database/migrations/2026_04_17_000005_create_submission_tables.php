<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_type_id');
            $table->uuid('program_id')->nullable();
            $table->uuid('submitter_id');
            $table->string('title', 500);
            $table->text('abstract')->nullable();
            $table->string('status', 50)->default('DRAFT');
            $table->integer('current_version')->default(0);
            $table->boolean('is_locked')->default(false);
            $table->jsonb('metadata')->default('{}');
            $table->timestampsTz();

            $table->foreign('submission_type_id')->references('id')->on('submission_types');
            $table->foreign('program_id')->references('id')->on('programs')->nullOnDelete();
            $table->foreign('submitter_id')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_submissions_submitter ON submissions(submitter_id)');
        DB::statement('CREATE INDEX idx_submissions_type ON submissions(submission_type_id)');
        DB::statement('CREATE INDEX idx_submissions_status ON submissions(status)');
        DB::statement('CREATE INDEX idx_submissions_program ON submissions(program_id)');

        Schema::create('submission_versions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->integer('version_number');
            $table->jsonb('document_paths')->default('[]');
            $table->text('change_summary')->nullable();
            $table->timestampTz('submitted_at')->default(DB::raw('now()'));
            $table->uuid('created_by');

            $table->unique(['submission_id', 'version_number']);
            $table->foreign('submission_id')->references('id')->on('submissions')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_sub_versions_submission ON submission_versions(submission_id, version_number DESC)');

        Schema::create('workflow_runs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('workflow_definition_id');
            $table->integer('version_number');
            $table->string('status', 20)->default('ACTIVE');
            // ACTIVE | COMPLETED | SUPERSEDED | CANCELLED
            $table->timestampTz('started_at')->default(DB::raw('now()'));
            $table->timestampTz('completed_at')->nullable();

            $table->unique(['submission_id', 'version_number']);
            $table->foreign('submission_id')->references('id')->on('submissions')->cascadeOnDelete();
            $table->foreign('workflow_definition_id')->references('id')->on('workflow_definitions');
        });

        DB::statement('CREATE INDEX idx_workflow_runs_submission ON workflow_runs(submission_id)');
        DB::statement('CREATE INDEX idx_workflow_runs_status ON workflow_runs(status)');
        // Only one ACTIVE workflow run per submission
        DB::statement("
            CREATE UNIQUE INDEX uq_one_active_run
            ON workflow_runs(submission_id)
            WHERE status = 'ACTIVE'
        ");

        Schema::create('stage_instances', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('workflow_run_id');
            $table->uuid('stage_definition_id');
            $table->integer('order');
            $table->string('status', 30)->default('PENDING');
            // PENDING | ACTIVE | PASSED | FAILED | REVISION_REQUIRED | SKIPPED
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('due_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->integer('sequential_position')->default(0);
            $table->boolean('pending_release')->default(false);
            $table->integer('recheck_count')->default(0);

            $table->unique(['workflow_run_id', 'order']);
            $table->foreign('workflow_run_id')->references('id')->on('workflow_runs')->cascadeOnDelete();
            $table->foreign('stage_definition_id')->references('id')->on('stage_definitions');
        });

        DB::statement('CREATE INDEX idx_stage_instances_run ON stage_instances(workflow_run_id, "order")');
        DB::statement('CREATE INDEX idx_stage_instances_status ON stage_instances(status)');

        Schema::create('stage_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('stage_instance_id');
            $table->uuid('user_id');
            $table->timestampTz('assigned_at')->default(DB::raw('now()'));
            $table->uuid('assigned_by');
            $table->timestampTz('notified_at')->nullable();
            $table->boolean('is_active')->default(true);

            $table->unique(['stage_instance_id', 'user_id']);
            $table->foreign('stage_instance_id')->references('id')->on('stage_instances')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('assigned_by')->references('id')->on('users');
        });

        DB::statement('CREATE INDEX idx_stage_assignments_stage ON stage_assignments(stage_instance_id)');
        DB::statement('CREATE INDEX idx_stage_assignments_user ON stage_assignments(user_id, is_active)');

        Schema::create('reviewer_pools', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_type_id');
            $table->uuid('user_id');
            $table->string('stage_role_label', 255)->nullable();
            $table->timestampTz('added_at')->default(DB::raw('now()'));

            $table->unique(['submission_type_id', 'user_id', 'stage_role_label']);
            $table->foreign('submission_type_id')->references('id')->on('submission_types')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviewer_pools');
        Schema::dropIfExists('stage_assignments');
        Schema::dropIfExists('stage_instances');
        Schema::dropIfExists('workflow_runs');
        Schema::dropIfExists('submission_versions');
        Schema::dropIfExists('submissions');
    }
};
