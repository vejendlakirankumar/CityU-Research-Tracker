<?php

namespace Tests\Feature;

use App\Models\SystemLog;
use App\Models\OrganizationSetting;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReviewerUploadDiagnosticsTest extends TestCase
{
    private string $submissionId;
    private string $reviewerId;
    private string $typeId;
    private User $reviewer;

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');

        // Isolate upload tests from unrelated, PostgreSQL-specific workflow migrations.
        Schema::create('organization_settings', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->string('org_name');
            $table->timestamps();
        });
        (require database_path('migrations/2026_10_16_000002_add_reviewer_feedback_upload_settings.php'))->up();
        OrganizationSetting::current()->update([
            'reviewer_feedback_max_file_size_mb' => 8, 'reviewer_feedback_max_files' => 5,
        ]);
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            foreach (['name', 'email', 'first_name', 'last_name', 'org_role'] as $column) {
                $table->string($column)->nullable();
            }
        });
        Schema::create('submission_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->integer('max_file_size_mb');
            $table->integer('max_files');
            $table->json('allowed_extensions');
        });
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_type_id');
            $table->string('status');
        });
        Schema::create('stage_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('stage_role_label');
            $table->integer('order');
            $table->boolean('is_gatekeeper')->default(false);
            $table->boolean('allows_finalize')->default(false);
        });
        Schema::create('submission_reviewers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            foreach (['submission_id', 'stage_id', 'user_id', 'assigned_by'] as $column) {
                $table->uuid($column);
            }
            $table->string('status');
            $table->string('decision')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->string('annotated_document_path')->nullable();
            $table->boolean('conflict_flagged')->default(false);
        });
        (require database_path('migrations/2026_09_02_000001_create_submission_reviewer_documents_table.php'))->up();
        (require database_path('migrations/2026_10_16_000001_create_system_logs_table.php'))->up();

        $userId = (string) Str::uuid();
        $stageId = (string) Str::uuid();
        $this->submissionId = (string) Str::uuid();
        $this->reviewerId = (string) Str::uuid();
        $this->typeId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $userId, 'name' => 'Reviewer', 'email' => 'reviewer@example.test']);
        DB::table('submission_types')->insert([
            'id' => $this->typeId, 'max_file_size_mb' => 8, 'max_files' => 5,
            'allowed_extensions' => json_encode(['pdf', 'doc', 'docx']),
        ]);
        DB::table('submissions')->insert([
            'id' => $this->submissionId, 'submission_type_id' => $this->typeId, 'status' => 'IN_REVIEW',
        ]);
        DB::table('stage_definitions')->insert([
            'id' => $stageId, 'name' => 'Chair', 'stage_role_label' => 'reviewer', 'order' => 1,
        ]);
        DB::table('submission_reviewers')->insert([
            'id' => $this->reviewerId, 'submission_id' => $this->submissionId,
            'stage_id' => $stageId, 'user_id' => $userId, 'assigned_by' => $userId, 'status' => 'accepted',
        ]);
        $this->reviewer = new User();
        $this->reviewer->forceFill(['id' => $userId, 'roles' => ['reviewer'], 'is_active' => true]);
        $this->actingAs($this->reviewer, 'sanctum');
        Storage::fake();
    }

    private function upload(UploadedFile $file, array $extra = [])
    {
        return $this->post("/api/submissions/{$this->submissionId}/reviewers/{$this->reviewerId}", [
            '_method' => 'PATCH', 'annotated_documents' => [$file], ...$extra,
        ], ['Accept' => 'application/json']);
    }

    public function test_pdf_from_reported_incident_is_persisted_under_eight_mb_feedback_limit(): void
    {
        $this->upload(UploadedFile::fake()->create('Chapter 3.pdf', 3584, 'application/pdf'))->assertOk();
        $this->assertDatabaseCount('submission_reviewer_documents', 1);
        $document = DB::table('submission_reviewer_documents')->first();
        Storage::assertExists($document->path);
        $this->assertSame('Chapter 3.pdf', $document->name);
        $this->assertDatabaseHas('system_logs', [
            'event' => 'reviewer.documents_uploaded', 'submission_id' => $this->submissionId,
            'reviewer_id' => $this->reviewerId,
        ]);
    }

    public function test_configured_feedback_size_failure_does_not_record_a_decision_and_has_diagnostics(): void
    {
        $response = $this->upload(UploadedFile::fake()->create('Too big.pdf', 8193, 'application/pdf'), [
            'decision' => 'revise', 'comments' => 'Private feedback must not be logged.',
        ])->assertUnprocessable()->assertJsonValidationErrors('annotated_documents.0');
        $this->assertStringContainsString('8 MB', $response->json('errors')['annotated_documents.0'][0]);
        $this->assertDatabaseCount('submission_reviewer_documents', 0);
        $this->assertNull(DB::table('submission_reviewers')->value('decision'));
        $log = SystemLog::where('request_id', $response->json('request_id'))->firstOrFail();
        $this->assertSame('reviewer.validation_failed', $log->event);
        $this->assertContains('Max', $log->context['failed_rules']['annotated_documents.0']);
        $this->assertStringNotContainsString('Private feedback', json_encode($log->context));
        $this->assertStringNotContainsString('Too big.pdf', json_encode($log->context));
    }

    public function test_review_settings_override_old_size_limit_independently_of_category(): void
    {
        DB::table('submission_types')->update([
            'max_file_size_mb' => 1, 'max_files' => 1, 'allowed_extensions' => json_encode(['txt']),
        ]);
        OrganizationSetting::current()->update([
            'reviewer_feedback_max_file_size_mb' => 64, 'reviewer_feedback_max_files' => 2,
        ]);
        $this->upload(UploadedFile::fake()->create('Feedback.pdf', 32768, 'application/pdf'))->assertOk();
        $this->upload(UploadedFile::fake()->create('Feedback.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))->assertOk();
        $this->upload(UploadedFile::fake()->create('Feedback.txt', 100, 'text/plain'))
            ->assertUnprocessable()->assertJsonValidationErrors('annotated_documents.0');
        $this->assertDatabaseCount('submission_reviewer_documents', 2);
    }

    public function test_file_at_configured_feedback_size_boundary_is_accepted(): void
    {
        $this->upload(UploadedFile::fake()->create('Exactly eight MB.pdf', 8192, 'application/pdf'))->assertOk();
        $this->assertDatabaseCount('submission_reviewer_documents', 1);
    }

    public function test_file_count_includes_already_uploaded_documents(): void
    {
        OrganizationSetting::current()->update(['reviewer_feedback_max_files' => 1]);
        $this->upload(UploadedFile::fake()->create('First.pdf', 100, 'application/pdf'))->assertOk();
        $this->upload(UploadedFile::fake()->create('Second.pdf', 100, 'application/pdf'))
            ->assertUnprocessable()->assertJsonValidationErrors('annotated_documents');
        $this->assertDatabaseCount('submission_reviewer_documents', 1);
    }

    public function test_legacy_and_modern_feedback_share_the_configured_file_count(): void
    {
        OrganizationSetting::current()->update(['reviewer_feedback_max_files' => 1]);
        $this->upload(UploadedFile::fake()->create('Modern.pdf', 100, 'application/pdf'), [
            'annotated_document' => UploadedFile::fake()->create('Legacy.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors('annotated_documents');
        $this->assertDatabaseCount('submission_reviewer_documents', 0);
    }

    public function test_admin_can_save_limits_and_reviewer_metadata_reports_the_same_values(): void
    {
        $this->reviewer->forceFill(['roles' => ['admin']]);
        $this->patchJson('/api/system/organization', [
            'reviewer_feedback_max_file_size_mb' => 12,
            'reviewer_feedback_max_files' => 2,
        ])->assertOk()->assertJsonPath('reviewer_feedback_max_file_size_mb', 12)
            ->assertJsonPath('reviewer_feedback_max_files', 2);
        $this->getJson('/api/system/organization')->assertOk()
            ->assertJsonPath('reviewer_feedback_max_file_size_mb', 12)
            ->assertJsonStructure(['upload_server_limits' => ['upload_max_filesize', 'post_max_size', 'max_file_uploads']]);
        $this->reviewer->forceFill(['roles' => ['reviewer']]);
        $this->getJson("/api/submissions/{$this->submissionId}/reviewers")->assertOk()
            ->assertJsonPath('meta.feedback_upload_policy.max_file_size_mb', 12)
            ->assertJsonPath('meta.feedback_upload_policy.max_files', 2)
            ->assertJsonPath('meta.feedback_upload_policy.allowed_extensions', ['pdf', 'doc', 'docx']);
        $this->upload(UploadedFile::fake()->create('Allowed.pdf', 12288, 'application/pdf'))->assertOk();
        $this->upload(UploadedFile::fake()->create('Rejected.pdf', 12289, 'application/pdf'))
            ->assertUnprocessable()->assertJsonValidationErrors('annotated_documents.0');
    }

    public function test_invalid_settings_are_rejected_and_non_admins_cannot_change_them(): void
    {
        $this->patchJson('/api/system/organization', [
            'reviewer_feedback_max_file_size_mb' => 100,
        ])->assertForbidden();
        $this->reviewer->forceFill(['roles' => ['admin']]);
        $this->patchJson('/api/system/organization', [
            'reviewer_feedback_max_file_size_mb' => 0,
            'reviewer_feedback_max_files' => 51,
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'reviewer_feedback_max_file_size_mb', 'reviewer_feedback_max_files',
        ]);
        $this->assertSame(8, OrganizationSetting::current()->reviewer_feedback_max_file_size_mb);
        $this->patchJson('/api/system/organization', [
            'reviewer_feedback_max_file_size_mb' => 501, 'reviewer_feedback_max_files' => 0,
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'reviewer_feedback_max_file_size_mb', 'reviewer_feedback_max_files',
        ]);
    }

    public function test_new_settings_default_to_previous_feedback_policy(): void
    {
        DB::table('organization_settings')->delete();
        $settings = OrganizationSetting::current()->fresh();
        $this->assertSame(25, $settings->reviewer_feedback_max_file_size_mb);
        $this->assertSame(10, $settings->reviewer_feedback_max_files);
    }

    public function test_php_upload_error_is_reported_without_inspecting_invalid_file_contents(): void
    {
        $source = UploadedFile::fake()->create('Chapter 3.pdf');
        $file = new UploadedFile($source->getPathname(), 'Chapter 3.pdf', 'application/pdf', UPLOAD_ERR_INI_SIZE, true);
        $response = $this->upload($file)->assertUnprocessable()->assertJsonValidationErrors('annotated_documents.0');
        $log = SystemLog::where('request_id', $response->json('request_id'))->firstOrFail();
        $this->assertSame(UPLOAD_ERR_INI_SIZE, $log->context['files'][0]['php_upload_error']);
        $this->assertDatabaseCount('submission_reviewer_documents', 0);
    }

    public function test_system_logs_are_restricted_to_active_administrators(): void
    {
        foreach (['reviewer', 'coordinator', 'student'] as $role) {
            $this->reviewer->forceFill(['roles' => [$role]]);
            $this->getJson('/api/system/logs')->assertForbidden();
        }
        $this->reviewer->forceFill(['roles' => ['admin', 'reviewer']]);
        $this->getJson('/api/system/logs', ['X-Active-Role' => 'reviewer'])->assertForbidden();
        $this->getJson('/api/system/logs', ['X-Active-Role' => 'admin'])->assertOk()->assertJsonPath('total', 0);
    }

    public function test_system_log_filters_and_pagination_are_bounded(): void
    {
        $this->upload(UploadedFile::fake()->create('Chapter 3.pdf', 3584, 'application/pdf'))->assertOk();
        $this->reviewer->forceFill(['roles' => ['admin']]);
        $this->getJson("/api/system/logs?submission_id={$this->submissionId}&level=info")
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('per_page', 50);
        $this->getJson('/api/system/logs?request_id=invalid')->assertUnprocessable();
        $this->getJson('/api/system/logs?date_from=2026-10-16&date_to=2026-10-15')->assertUnprocessable();
        $this->getJson('/api/system/logs?date_to=2026-10-16')->assertOk();
    }
}
