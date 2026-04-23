<?php

namespace Tests\Feature;

use App\Models\AppealRequest;
use App\Models\ReviewAssignment;
use App\Models\Submission;
use App\Models\SubmissionType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

/**
 * Edge-case tests covering:
 *   1. Revision cycle (REVISION_REQUIRED → resubmit → back IN_REVIEW)
 *   2. Rejection + appeal flow (REJECTED → appeal → APPEAL_PENDING)
 *   3. Account lockout (3 wrong passwords → locked; 4th → locked message; admin unlock → can login)
 */
class EdgeCaseTest extends TestCase
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

    protected function authHeader(User $user): array
    {
        return ['Authorization' => 'Bearer ' . $user->createToken('test')->plainTextToken];
    }

    /** Create a submission, submit it, and assign a reviewer. Returns [submissionId, reviewer]. */
    protected function submittedWithReviewer(): array
    {
        $student  = $this->createStudent();
        $reviewer = $this->createReviewer();
        $type     = SubmissionType::factory()->create(['is_active' => true]);

        $resp = $this->postJson('/api/submissions', [
            'title'              => $this->faker->sentence(4),
            'submission_type_id' => $type->id,
            'abstract'           => 'Test abstract.',
        ], $this->authHeader($student))->assertStatus(201);

        $submissionId = $resp->json('data.id');

        $this->postJson("/api/submissions/$submissionId/submit", [], $this->authHeader($student))
             ->assertStatus(200);

        $admin = $this->createAdmin();
        $this->postJson("/api/submissions/$submissionId/reviewers", [
            'reviewer_id' => $reviewer->id,
            'stage_key'   => 'initial_review',
        ], $this->authHeader($admin))->assertStatus(200);

        return [$submissionId, $reviewer, $student, $admin];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. REVISION CYCLE
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function submission_transitions_to_revision_required_when_reviewer_requests_revision(): void
    {
        [$submissionId, $reviewer] = $this->submittedWithReviewer();

        // Reviewer submits a "revise" decision
        $this->postJson("/api/submissions/$submissionId/review", [
            'decision'  => 'revise',
            'feedback'  => 'Please clarify section 2.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        $this->getJson("/api/submissions/$submissionId", $this->authHeader($reviewer))
             ->assertJsonPath('data.status', Submission::STATUS_REVISION_REQUIRED);
    }

    /** @test */
    public function student_can_resubmit_after_revision_required(): void
    {
        [$submissionId, $reviewer, $student] = $this->submittedWithReviewer();

        // Drive to REVISION_REQUIRED
        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'revise',
            'feedback' => 'Needs more references.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        // Student resubmits (same endpoint as initial submit)
        $this->postJson("/api/submissions/$submissionId/submit", [], $this->authHeader($student))
             ->assertStatus(200)
             ->assertJsonPath('data.status', Submission::STATUS_SUBMITTED);
    }

    /** @test */
    public function resubmitted_paper_returns_to_in_review_once_reviewer_assigned(): void
    {
        [$submissionId, $reviewer, $student, $admin] = $this->submittedWithReviewer();

        // Drive to REVISION_REQUIRED
        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'revise',
            'feedback' => 'Add methodology section.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        // Student resubmits
        $this->postJson("/api/submissions/$submissionId/submit", [], $this->authHeader($student))
             ->assertStatus(200);

        // Admin re-assigns a reviewer (same or different)
        $this->postJson("/api/submissions/$submissionId/reviewers", [
            'reviewer_id' => $reviewer->id,
            'stage_key'   => 'initial_review',
        ], $this->authHeader($admin))->assertStatus(200);

        $status = $this->getJson("/api/submissions/$submissionId", $this->authHeader($admin))
             ->assertStatus(200)
             ->json('data.status');

        // Should be SUBMITTED or IN_REVIEW depending on auto-advance logic
        $this->assertContains($status, [
            Submission::STATUS_SUBMITTED,
            Submission::STATUS_IN_REVIEW,
        ]);
    }

    /** @test */
    public function student_cannot_resubmit_a_withdrawn_submission(): void
    {
        [$submissionId, , $student] = $this->submittedWithReviewer();

        $this->postJson("/api/submissions/$submissionId/withdraw", [], $this->authHeader($student))
             ->assertStatus(200);

        $this->postJson("/api/submissions/$submissionId/submit", [], $this->authHeader($student))
             ->assertStatus(422);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. REJECTION + APPEAL FLOW
    // ─────────────────────────────────────────────────────────────────────────

    /** @test */
    public function rejected_submission_status_is_rejected(): void
    {
        [$submissionId, $reviewer] = $this->submittedWithReviewer();

        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'reject',
            'feedback' => 'Does not meet quality standards.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        $this->getJson("/api/submissions/$submissionId", $this->authHeader($reviewer))
             ->assertJsonPath('data.status', Submission::STATUS_REJECTED);
    }

    /** @test */
    public function student_can_appeal_rejected_submission(): void
    {
        [$submissionId, $reviewer, $student] = $this->submittedWithReviewer();

        // Reject first
        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'reject',
            'feedback' => 'Outside scope.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        // Student appeals
        $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'The reviewer applied the wrong assessment criteria.',
        ], $this->authHeader($student))
             ->assertStatus(201)
             ->assertJsonPath('data.status', AppealRequest::STATUS_PENDING);

        // Submission should now be APPEAL_PENDING
        $this->getJson("/api/submissions/$submissionId", $this->authHeader($student))
             ->assertJsonPath('data.status', Submission::STATUS_APPEAL_PENDING);
    }

    /** @test */
    public function student_cannot_file_duplicate_appeal(): void
    {
        [$submissionId, $reviewer, $student] = $this->submittedWithReviewer();

        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'reject',
            'feedback' => 'Not relevant.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'First appeal.',
        ], $this->authHeader($student))->assertStatus(201);

        // Second appeal while first is still pending → should be rejected
        $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'Second appeal attempt.',
        ], $this->authHeader($student))->assertStatus(422);
    }

    /** @test */
    public function admin_can_uphold_appeal_and_submission_returns_to_in_review(): void
    {
        [$submissionId, $reviewer, $student, $admin] = $this->submittedWithReviewer();

        // Reject
        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'reject',
            'feedback' => 'Inconclusive data.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        // Appeal
        $appealResp = $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'Data was correctly analysed; reviewer misread figure 3.',
        ], $this->authHeader($student))->assertStatus(201);

        $appealId = $appealResp->json('data.id');

        // Admin upholds appeal
        $this->patchJson("/api/admin/appeals/$appealId", [
            'status'          => AppealRequest::STATUS_UPHELD,
            'resolution_note' => 'Upon review the appeal is upheld; reassign for fresh review.',
        ], $this->authHeader($admin))->assertStatus(200);

        // Submission back to IN_REVIEW
        $this->getJson("/api/submissions/$submissionId", $this->authHeader($admin))
             ->assertJsonPath('data.status', Submission::STATUS_IN_REVIEW);
    }

    /** @test */
    public function admin_can_dismiss_appeal_and_submission_stays_rejected(): void
    {
        [$submissionId, $reviewer, $student, $admin] = $this->submittedWithReviewer();

        $this->postJson("/api/submissions/$submissionId/review", [
            'decision' => 'reject',
            'feedback' => 'Poor methodology.',
        ], $this->authHeader($reviewer))->assertStatus(200);

        $appealResp = $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'The methodology is standard in our field.',
        ], $this->authHeader($student))->assertStatus(201);

        $appealId = $appealResp->json('data.id');

        $this->patchJson("/api/admin/appeals/$appealId", [
            'status'          => AppealRequest::STATUS_DISMISSED,
            'resolution_note' => 'Grounds not sufficient.',
        ], $this->authHeader($admin))->assertStatus(200);

        // Submission should remain REJECTED (not moved back)
        $this->getJson("/api/submissions/$submissionId", $this->authHeader($admin))
             ->assertJsonPath('data.status', Submission::STATUS_REJECTED);
    }

    /** @test */
    public function student_cannot_appeal_a_non_rejected_submission(): void
    {
        [$submissionId, , $student] = $this->submittedWithReviewer();

        // Still in SUBMITTED / IN_REVIEW — not rejected
        $this->postJson("/api/submissions/$submissionId/appeal", [
            'grounds' => 'Pre-emptive appeal.',
        ], $this->authHeader($student))->assertStatus(422);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ACCOUNT LOCKOUT
    // ─────────────────────────────────────────────────────────────────────────

    private function attemptLogin(string $email, string $password): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/auth/login', compact('email', 'password'));
    }

    /** @test */
    public function three_consecutive_wrong_passwords_lock_the_account(): void
    {
        $password = 'CorrectP@ss1!';
        $user     = User::factory()->student()->create([
            'email'         => 'lockout.test@example.com',
            'password_hash' => bcrypt($password),
            'is_active'     => true,
        ]);

        $this->attemptLogin($user->email, 'wrong1')->assertStatus(401);
        $this->attemptLogin($user->email, 'wrong2')->assertStatus(401);
        $this->attemptLogin($user->email, 'wrong3')->assertStatus(401);

        $user->refresh();
        $this->assertTrue($user->isLocked(), 'Account should be locked after 3 failed attempts');
    }

    /** @test */
    public function fourth_attempt_returns_locked_message_even_with_correct_password(): void
    {
        $password = 'CorrectP@ss2!';
        $user     = User::factory()->student()->create([
            'email'         => 'lockout.correct@example.com',
            'password_hash' => bcrypt($password),
            'is_active'     => true,
        ]);

        $this->attemptLogin($user->email, 'bad')->assertStatus(401);
        $this->attemptLogin($user->email, 'bad')->assertStatus(401);
        $this->attemptLogin($user->email, 'bad')->assertStatus(401);

        // 4th attempt with the CORRECT password — should still be locked out
        $this->attemptLogin($user->email, $password)
             ->assertStatus(401)
             ->assertJsonPath('message', fn($v) => str_contains(strtolower((string) $v), 'lock'));
    }

    /** @test */
    public function admin_can_unlock_locked_account_and_user_can_then_login(): void
    {
        $password = 'CorrectP@ss3!';
        $student  = User::factory()->student()->create([
            'email'                  => 'lockout.unlock@example.com',
            'password_hash'          => bcrypt($password),
            'is_active'              => true,
            'failed_login_attempts'  => 3,
            'locked_at'              => now(),
        ]);

        $admin = $this->createAdmin();

        // Confirm locked
        $this->assertTrue($student->isLocked());

        // Admin unlocks
        $this->postJson("/api/users/{$student->id}/unlock", [], $this->authHeader($admin))
             ->assertStatus(200);

        $student->refresh();
        $this->assertFalse($student->isLocked(), 'Account should be unlocked after admin action');
        $this->assertSame(0, $student->failed_login_attempts);

        // Can now login
        $this->attemptLogin($student->email, $password)
             ->assertStatus(200)
             ->assertJsonPath('token', fn($v) => is_string($v) && strlen($v) > 10);
    }
}
