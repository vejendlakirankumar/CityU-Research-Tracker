<?php

namespace Tests\Feature;

use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery\MockInterface;
use Tests\TestCase;

class RevisionWorkflowTest extends TestCase
{
    private Submission $submission;
    private User $student;
    private array $stageIds;
    private array $reviewerIds;
    private MockInterface $notifications;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        $this->travelTo(now()->setDate(2026, 10, 21)->setTime(12, 0));
        Storage::fake();
        $this->notifications = $this->spy(NotificationService::class);

        Schema::create('organization_settings', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->string('org_name');
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
            $table->json('roles');
        });
        Schema::create('workflow_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('revision_restart_policy')->default('FULL_RESTART');
            $table->timestamps();
        });
        Schema::create('stage_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->string('name');
            $table->string('stage_role_label')->default('reviewer');
            $table->integer('order');
            $table->integer('due_days')->default(10);
            $table->integer('min_approvals')->default(1);
            $table->boolean('is_gatekeeper')->default(false);
            $table->boolean('allows_finalize')->default(false);
            $table->boolean('is_email_stage')->default(false);
        });
        Schema::create('submission_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id');
            $table->string('slug')->default('proposal');
            $table->string('label')->default('Proposal');
            $table->boolean('is_gated_review')->default(true);
            $table->boolean('is_blind_review')->default(false);
            $table->boolean('allow_meetings')->default(false);
            $table->integer('max_file_size_mb')->default(8);
            $table->integer('max_files')->default(5);
            $table->json('allowed_extensions');
        });
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_type_id');
            $table->uuid('submitter_id');
            $table->uuid('program_id')->nullable();
            $table->string('title');
            $table->text('abstract')->nullable();
            $table->string('status');
            $table->integer('current_version');
            $table->uuid('current_stage_id')->nullable();
            $table->timestamp('current_stage_entered_at')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
        Schema::create('submission_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->integer('version_number');
            $table->json('document_paths');
            $table->text('change_summary')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->uuid('created_by');
            $table->timestamps();
        });
        Schema::create('submission_reviewers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('stage_id');
            $table->uuid('user_id');
            $table->string('status');
            $table->string('decision')->nullable();
            $table->text('comments')->nullable();
            $table->timestamp('decision_at')->nullable();
            $table->boolean('finalize_workflow')->default(false);
            $table->text('draft_comments')->nullable();
            $table->string('draft_decision')->nullable();
            $table->timestamp('draft_saved_at')->nullable();
            $table->date('due_at')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('assignment_notified_at')->nullable();
            $table->timestamp('reminder_sent_at')->nullable();
        });
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id')->nullable();
            $table->uuid('actor_id')->nullable();
            $table->string('action');
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
        });

        $studentId = (string) Str::uuid();
        DB::table('users')->insert([
            'id' => $studentId, 'name' => 'Student', 'email' => 'student@example.test',
            'roles' => json_encode(['student']),
        ]);
        $this->student = (new User())->forceFill([
            'id' => $studentId, 'roles' => ['student'], 'is_active' => true,
        ]);
        $workflowId = (string) Str::uuid();
        $typeId = (string) Str::uuid();
        DB::table('workflow_definitions')->insert(['id' => $workflowId]);
        DB::table('submission_types')->insert([
            'id' => $typeId, 'workflow_id' => $workflowId, 'allowed_extensions' => json_encode(['pdf']),
        ]);
        $this->stageIds = [];
        $this->reviewerIds = [];
        foreach (['Chair', 'Committee', 'Program Director'] as $index => $name) {
            $this->stageIds[] = $stageId = (string) Str::uuid();
            $this->reviewerIds[] = $reviewerId = (string) Str::uuid();
            DB::table('stage_definitions')->insert([
                'id' => $stageId, 'workflow_id' => $workflowId, 'name' => $name,
                'order' => $index + 1, 'is_gatekeeper' => $index === 0,
            ]);
            DB::table('users')->insert([
                'id' => $reviewerId, 'name' => "$name Reviewer", 'email' => "reviewer$index@example.test",
                'roles' => json_encode(['reviewer']),
            ]);
        }
        $this->submission = Submission::create([
            'title' => 'Revised proposal', 'submission_type_id' => $typeId,
            'submitter_id' => $studentId, 'status' => 'REVISION_REQUIRED', 'current_version' => 4,
            'current_stage_id' => $this->stageIds[0], 'current_stage_entered_at' => now()->subDays(9),
            'metadata' => ['pending_revision_stage_id' => $this->stageIds[0], 'pending_revision_stage_name' => 'Chair'],
        ]);
        DB::table('submission_versions')->insert([
            'id' => (string) Str::uuid(), 'submission_id' => $this->submission->id,
            'version_number' => 4, 'document_paths' => json_encode(['proposal.pdf']), 'created_by' => $studentId,
        ]);
        foreach ($this->stageIds as $index => $stageId) {
            DB::table('submission_reviewers')->insert([
                'id' => (string) Str::uuid(), 'submission_id' => $this->submission->id,
                'stage_id' => $stageId, 'user_id' => $this->reviewerIds[$index],
                'status' => $index === 0 ? 'completed' : 'pending',
                'decision' => $index === 0 ? 'revise' : null,
                'comments' => 'Previous round', 'decision_at' => $index === 0 ? now()->subDays(6) : null,
                'finalize_workflow' => true, 'draft_comments' => 'Old draft', 'draft_decision' => 'revise',
                'draft_saved_at' => now()->subDays(6), 'due_at' => now()->subDays(1)->toDateString(),
                'assigned_at' => now()->subDays(9), 'assignment_notified_at' => now()->subDays(9),
                'reminder_sent_at' => now()->subDays(1),
            ]);
        }
        $this->actingAs($this->student, 'sanctum');
    }

    public function test_revision_stage_is_not_complete_and_current_stage_matches_submission(): void
    {
        $this->getJson("/api/submissions/{$this->submission->id}/review-progress")
            ->assertOk()->assertJsonPath('current_stage_id', $this->stageIds[0])
            ->assertJsonPath('data.0.status', 'revision_required')
            ->assertJsonPath('data.0.outcome', 'revision')
            ->assertJsonPath('data.1.status', 'assigned');
    }

    public function test_uploading_a_revision_does_not_implicitly_resubmit_or_erase_feedback(): void
    {
        $this->post("/api/submissions/{$this->submission->id}/versions", [
            'files' => [UploadedFile::fake()->create('revised.pdf', 100, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame('REVISION_REQUIRED', $this->submission->fresh()->status);
        $this->assertSame(5, $this->submission->fresh()->current_version);
        $this->assertSame('revise', SubmissionReviewer::where('stage_id', $this->stageIds[0])->value('decision'));
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_resubmission_reopens_chair_clears_old_round_and_notifies_only_current_stage(): void
    {
        $this->postJson("/api/submissions/{$this->submission->id}/submit")
            ->assertOk()->assertJsonPath('data.status', 'IN_REVIEW')
            ->assertJsonPath('data.current_stage.id', $this->stageIds[0]);
        $chair = SubmissionReviewer::where('stage_id', $this->stageIds[0])->firstOrFail();
        $this->assertNull($chair->decision);
        $this->assertNull($chair->draft_decision);
        $this->assertNull($chair->draft_comments);
        $this->assertNull($chair->draft_saved_at);
        $this->assertNull($chair->reminder_sent_at);
        $this->assertFalse($chair->finalize_workflow);
        $this->assertSame('pending', $chair->status);
        $this->assertSame(now()->addDays(10)->toDateString(), $chair->due_at->toDateString());
        $this->assertNotNull($chair->assignment_notified_at);
        $this->assertNull(SubmissionReviewer::where('stage_id', $this->stageIds[1])->value('due_at'));
        $this->assertNull(SubmissionReviewer::where('stage_id', $this->stageIds[1])->value('assignment_notified_at'));
        $this->notifications->shouldHaveReceived('notify')->once()->withArgs(
            fn ($user, $type, $data) => $user->id === $this->reviewerIds[0] && $data['stage_name'] === 'Chair'
        );
        $this->assertDatabaseHas('audit_logs', ['action' => 'SUBMISSION_RESUBMITTED']);
        $this->assertArrayNotHasKey('pending_revision_stage_id', $this->submission->fresh()->metadata);
        $this->getJson("/api/submissions/{$this->submission->id}/review-progress")
            ->assertOk()->assertJsonPath('current_stage_id', $this->stageIds[0])
            ->assertJsonPath('data.0.status', 'assigned')->assertJsonPath('data.0.completed_count', 0);
    }

    public function test_resume_policy_preserves_approved_chair_and_reopens_committee(): void
    {
        DB::table('workflow_definitions')->update(['revision_restart_policy' => 'RESUME_FROM_STAGE']);
        SubmissionReviewer::where('stage_id', $this->stageIds[0])->update(['decision' => 'approve']);
        SubmissionReviewer::where('stage_id', $this->stageIds[1])->update(['decision' => 'revise', 'status' => 'completed']);
        $this->submission->update([
            'current_stage_id' => $this->stageIds[1],
            'metadata' => ['pending_revision_stage_id' => $this->stageIds[1]],
        ]);
        $this->postJson("/api/submissions/{$this->submission->id}/submit")
            ->assertOk()->assertJsonPath('data.current_stage.id', $this->stageIds[1]);
        $this->assertSame('approve', SubmissionReviewer::where('stage_id', $this->stageIds[0])->value('decision'));
        $this->notifications->shouldHaveReceived('notify')->once()->withArgs(
            fn ($user, $type, $data) => $user->id === $this->reviewerIds[1] && $data['stage_name'] === 'Committee'
        );
    }

    public function test_declined_assignments_are_not_reactivated_by_restart(): void
    {
        SubmissionReviewer::where('stage_id', $this->stageIds[1])->update(['status' => 'declined']);
        $this->postJson("/api/submissions/{$this->submission->id}/submit")->assertOk();
        $this->assertSame('declined', SubmissionReviewer::where('stage_id', $this->stageIds[1])->value('status'));
        $this->getJson("/api/submissions/{$this->submission->id}/review-progress")
            ->assertOk()->assertJsonPath('data.1.reviewers_count', 0);
    }

    public function test_invalid_resume_stage_does_not_partially_resubmit(): void
    {
        DB::table('workflow_definitions')->update(['revision_restart_policy' => 'RESUME_FROM_STAGE']);
        $this->submission->update(['metadata' => ['pending_revision_stage_id' => (string) Str::uuid()]]);
        $this->postJson("/api/submissions/{$this->submission->id}/submit")
            ->assertUnprocessable()->assertJsonValidationErrors('submission');
        $this->assertSame('REVISION_REQUIRED', $this->submission->fresh()->status);
        $this->assertSame('revise', SubmissionReviewer::where('stage_id', $this->stageIds[0])->value('decision'));
        $this->assertDatabaseCount('audit_logs', 0);
        $this->notifications->shouldNotHaveReceived('notify');
    }

    public function test_resubmission_without_active_reviewers_returns_to_assignment_queue(): void
    {
        SubmissionReviewer::query()->update(['status' => 'declined']);
        $this->postJson("/api/submissions/{$this->submission->id}/submit")
            ->assertOk()->assertJsonPath('data.status', 'RESUBMITTED')->assertJsonPath('data.current_stage', null);
        $this->assertNull($this->submission->fresh()->current_stage_entered_at);
        $this->assertSame(3, SubmissionReviewer::where('status', 'declined')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'SUBMISSION_RESUBMITTED']);
    }
}
