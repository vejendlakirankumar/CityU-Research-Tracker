<?php

namespace Tests\Feature;

use App\Models\Submission;
use App\Models\SubmissionType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

/**
 * Submission lifecycle happy-path tests.
 *
 * DB: SQLite in-memory (set in phpunit.xml).
 * Migrations are run via RefreshDatabase.
 */
class SubmissionLifecycleTest extends TestCase
{
    use RefreshDatabase;
    use WithFaker;

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createAdmin(array $attrs = []): User
    {
        return User::factory()->admin()->create(array_merge([
            'email' => $this->faker->unique()->safeEmail(),
        ], $attrs));
    }

    protected function createStudent(array $attrs = []): User
    {
        return User::factory()->student()->create(array_merge([
            'email' => $this->faker->unique()->safeEmail(),
        ], $attrs));
    }

    protected function createReviewer(array $attrs = []): User
    {
        return User::factory()->reviewer()->create(array_merge([
            'email' => $this->faker->unique()->safeEmail(),
        ], $attrs));
    }

    protected function createSubmissionType(array $attrs = []): SubmissionType
    {
        return SubmissionType::factory()->create($attrs);
    }

    protected function authHeader(User $user): array
    {
        $token = $user->createToken('test')->plainTextToken;
        return ['Authorization' => "Bearer $token"];
    }

    // ── Auth tests ────────────────────────────────────────────────────────────

    /** @test */
    public function guest_cannot_access_authenticated_routes(): void
    {
        $this->getJson('/api/submissions')
             ->assertStatus(401);
    }

    /** @test */
    public function student_can_login_and_get_token(): void
    {
        $password = 'SecureP@ss123!';
        $student  = User::factory()->student()->create([
            'email'         => 'student@test.example',
            'password_hash' => bcrypt($password),
            'is_active'     => true,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'student@test.example',
            'password' => $password,
        ])->assertStatus(200)
          ->assertJsonPath('data.token', fn($v) => is_string($v) && strlen($v) > 10);
    }

    /** @test */
    public function login_fails_with_wrong_password(): void
    {
        User::factory()->student()->create([
            'email'         => 'badpass@test.example',
            'password_hash' => bcrypt('CorrectPassword1!'),
            'is_active'     => true,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'badpass@test.example',
            'password' => 'WrongPassword',
        ])->assertStatus(401);
    }

    /** @test */
    public function inactive_user_cannot_login(): void
    {
        User::factory()->student()->inactive()->create([
            'email'         => 'inactive@test.example',
            'password_hash' => bcrypt('Password123!'),
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'inactive@test.example',
            'password' => 'Password123!',
        ])->assertStatus(401);
    }

    // ── Submission creation ───────────────────────────────────────────────────

    /** @test */
    public function student_can_create_draft_submission(): void
    {
        $student = $this->createStudent();
        $type    = $this->createSubmissionType();

        $this->postJson('/api/submissions', [
            'title'              => 'My Research Paper',
            'submission_type_id' => $type->id,
            'abstract'           => 'This is a test abstract.',
        ], $this->authHeader($student))
             ->assertStatus(201)
             ->assertJsonPath('data.status', 'DRAFT')
             ->assertJsonPath('data.title', 'My Research Paper');
    }

    /** @test */
    public function student_can_submit_their_draft(): void
    {
        $student = $this->createStudent();
        $type    = $this->createSubmissionType();

        // Create draft
        $response = $this->postJson('/api/submissions', [
            'title'              => 'Submittable Paper',
            'submission_type_id' => $type->id,
        ], $this->authHeader($student))->assertStatus(201);

        $submissionId = $response->json('data.id');

        // Submit it
        $this->postJson("/api/submissions/$submissionId/submit", [], $this->authHeader($student))
             ->assertStatus(200)
             ->assertJsonPath('data.status', 'SUBMITTED');
    }

    /** @test */
    public function student_can_withdraw_submitted_submission(): void
    {
        $student = $this->createStudent();
        $type    = $this->createSubmissionType();

        $response = $this->postJson('/api/submissions', [
            'title'              => 'Withdrawable Paper',
            'submission_type_id' => $type->id,
        ], $this->authHeader($student))->assertStatus(201);

        $id = $response->json('data.id');
        $this->postJson("/api/submissions/$id/submit", [], $this->authHeader($student))->assertStatus(200);
        $this->postJson("/api/submissions/$id/withdraw", [], $this->authHeader($student))
             ->assertStatus(200)
             ->assertJsonPath('data.status', 'WITHDRAWN');
    }

    /** @test */
    public function student_cannot_see_other_students_submissions(): void
    {
        $alice  = $this->createStudent();
        $bob    = $this->createStudent();
        $type   = $this->createSubmissionType();

        // Alice creates a submission
        $response = $this->postJson('/api/submissions', [
            'title'              => "Alice's Paper",
            'submission_type_id' => $type->id,
        ], $this->authHeader($alice))->assertStatus(201);

        $id = $response->json('data.id');

        // Bob tries to view it
        $this->getJson("/api/submissions/$id", $this->authHeader($bob))->assertStatus(403);
    }

    /** @test */
    public function admin_can_see_all_submissions(): void
    {
        $admin   = $this->createAdmin();
        $student = $this->createStudent();
        $type    = $this->createSubmissionType();

        $this->postJson('/api/submissions', [
            'title'              => 'Visible to Admin',
            'submission_type_id' => $type->id,
        ], $this->authHeader($student))->assertStatus(201);

        $this->getJson('/api/submissions', $this->authHeader($admin))
             ->assertStatus(200)
             ->assertJsonPath('meta.total', fn($v) => $v >= 1);
    }

    // ── Role-based access control ─────────────────────────────────────────────

    /** @test */
    public function student_cannot_access_admin_routes(): void
    {
        $student = $this->createStudent();

        $this->getJson('/api/admin/submission-types', $this->authHeader($student))
             ->assertStatus(403);
    }

    /** @test */
    public function admin_can_list_submission_types(): void
    {
        $admin = $this->createAdmin();

        $this->getJson('/api/admin/submission-types', $this->authHeader($admin))
             ->assertStatus(200);
    }

    /** @test */
    public function admin_can_create_submission_type(): void
    {
        $admin = $this->createAdmin();

        $this->postJson('/api/admin/submission-types', [
            'slug'        => 'test-type',
            'label'       => 'Test Type',
            'description' => 'A test submission type',
            'is_active'   => true,
        ], $this->authHeader($admin))
             ->assertStatus(201)
             ->assertJsonPath('data.slug', 'test-type');
    }

    // ── User management ───────────────────────────────────────────────────────

    /** @test */
    public function admin_can_create_user(): void
    {
        $admin = $this->createAdmin();

        $this->postJson('/api/users', [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
            'email'      => 'jane.doe@test.example',
            'password'   => 'SecureP@ss123!',
            'roles'      => ['reviewer'],
        ], $this->authHeader($admin))
             ->assertStatus(201)
             ->assertJsonPath('data.email', 'jane.doe@test.example');
    }

    /** @test */
    public function admin_can_view_analytics_overview(): void
    {
        $admin = $this->createAdmin();

        $this->getJson('/api/admin/analytics/overview', $this->authHeader($admin))
             ->assertStatus(200)
             ->assertJsonStructure([
                 'data' => [
                     'total_submissions',
                     'pending_review',
                     'completed_this_month',
                     'by_status',
                     'monthly_trend',
                 ],
             ]);
    }

    /** @test */
    public function admin_can_view_audit_log(): void
    {
        $admin = $this->createAdmin();

        $this->getJson('/api/admin/audit-logs', $this->authHeader($admin))
             ->assertStatus(200)
             ->assertJsonStructure(['data', 'meta']);
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    /** @test */
    public function authenticated_user_can_view_dashboard_stats(): void
    {
        $student = $this->createStudent();

        $this->getJson('/api/dashboard/stats', $this->authHeader($student))
             ->assertStatus(200)
             ->assertJsonStructure(['data']);
    }
}
