<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_types', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('slug', 100)->unique();
            $table->string('label', 255);
            $table->text('description')->nullable();
            $table->boolean('is_gated_review')->default(false);
            $table->boolean('is_blind_review')->default(false);
            $table->boolean('allow_meetings')->default(false);
            $table->integer('max_file_size_mb')->default(8);
            $table->jsonb('allowed_extensions')->default('["pdf","docx"]');
            $table->integer('max_files')->default(5);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_type_id');
            $table->string('name', 255);
            $table->string('revision_restart_policy', 50)->default('FULL_RESTART');
            // FULL_RESTART | FAILED_STAGE_RESTART
            $table->string('final_status_on_pass', 100)->default('ACCEPTED');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->foreign('submission_type_id')->references('id')->on('submission_types');
            $table->unique(['submission_type_id', 'is_active']);
        });

        Schema::create('stage_templates', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('stage_role_label', 255);
            $table->string('execution_type', 20)->default('PARALLEL');
            $table->string('approval_strategy', 20)->default('ALL');
            $table->integer('min_approvals')->default(1);
            $table->boolean('is_anonymous')->default(false);
            $table->integer('due_days')->default(7);
            $table->jsonb('decision_options')->default('[
                {"value":"APPROVE","label":"Approve","outcome":"APPROVED"},
                {"value":"REQUEST_CHANGES","label":"Request Changes","outcome":"REVISION"},
                {"value":"REJECT","label":"Reject","outcome":"REJECTED"}
            ]');
            $table->jsonb('visibility_config')->default('{}');
            $table->jsonb('escalation_config')->default('{}');
            $table->boolean('is_system')->default(false);
            $table->timestampsTz();
        });

        Schema::create('stage_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('workflow_id');
            $table->string('name', 255);
            $table->integer('order');
            // order is display hint; actual routing is via stage_transitions
            $table->string('stage_role_label', 255);
            $table->uuid('template_id')->nullable();
            $table->boolean('is_gatekeeper')->default(false);
            $table->string('execution_type', 20)->default('PARALLEL');
            $table->string('approval_strategy', 20)->default('ALL');
            $table->integer('min_approvals')->default(1);
            $table->boolean('is_anonymous')->default(false);
            $table->integer('due_days')->default(7);
            $table->jsonb('visibility_config')->default('{}');
            $table->jsonb('escalation_config')->default('{}');
            $table->jsonb('decision_options')->default('[
                {"value":"APPROVE","label":"Approve","outcome":"APPROVED"},
                {"value":"REQUEST_CHANGES","label":"Request Changes","outcome":"REVISION"},
                {"value":"REJECT","label":"Reject","outcome":"REJECTED"}
            ]');
            $table->jsonb('skip_condition')->nullable();
            $table->jsonb('auto_assignment')->default('{"strategy":"MANUAL"}');
            $table->timestampsTz();

            $table->foreign('workflow_id')->references('id')->on('workflow_definitions')->cascadeOnDelete();
            $table->foreign('template_id')->references('id')->on('stage_templates')->nullOnDelete();
            $table->unique(['workflow_id', 'order']);
        });

        DB::statement('CREATE INDEX idx_stage_def_workflow ON stage_definitions(workflow_id, "order")');

        // Enforce at most one gatekeeper per workflow
        DB::statement('
            CREATE UNIQUE INDEX one_gatekeeper_per_workflow
            ON stage_definitions(workflow_id)
            WHERE is_gatekeeper = true
        ');

        Schema::create('stage_transitions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('workflow_id');
            $table->uuid('from_stage_id')->nullable();
            // NULL = entry edge (workflow start → this stage)
            $table->uuid('to_stage_id');
            $table->jsonb('condition')->nullable();
            // { "field": "metadata.involves_human_subjects", "operator": "eq", "value": true }
            $table->integer('priority')->default(0);
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('workflow_id')->references('id')->on('workflow_definitions')->cascadeOnDelete();
            $table->foreign('from_stage_id')->references('id')->on('stage_definitions')->cascadeOnDelete();
            $table->foreign('to_stage_id')->references('id')->on('stage_definitions')->cascadeOnDelete();

        });
        DB::statement('ALTER TABLE stage_transitions ADD CONSTRAINT chk_no_self_loop CHECK (from_stage_id IS DISTINCT FROM to_stage_id)');

        DB::statement('CREATE INDEX idx_transitions_from ON stage_transitions(workflow_id, from_stage_id)');
        DB::statement('CREATE INDEX idx_transitions_to ON stage_transitions(workflow_id, to_stage_id)');
    }

    public function down(): void
    {
        Schema::dropIfExists('stage_transitions');
        Schema::dropIfExists('stage_definitions');
        Schema::dropIfExists('stage_templates');
        Schema::dropIfExists('workflow_definitions');
        Schema::dropIfExists('submission_types');
    }
};
