<?php

namespace Tests\Feature;

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentAnnotationController;
use App\Http\Controllers\GatedReleaseController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SimilarityController;
use App\Http\Controllers\SsoAuthController;
use App\Http\Controllers\SubmissionAuthorController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\SubmissionEmailController;
use App\Http\Controllers\SubmissionMeetingController;
use App\Http\Controllers\SubmissionMessageController;
use App\Http\Controllers\SubmissionReviewerController;
use App\Http\Middleware\EnforceReadOnlyAccess;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReadOnlyAccessTest extends TestCase
{
    private function user(array $roles = ['readonly']): User
    {
        return (new User())->forceFill([
            'id' => (string) Str::uuid(), 'roles' => $roles, 'is_active' => true,
        ]);
    }

    public function test_every_authenticated_route_has_the_read_only_guard_and_obeys_the_read_contract(): void
    {
        $reads = [
            AuthController::class => ['me'],
            SsoAuthController::class => ['listIdentities'],
            DashboardController::class => ['stats'],
            SubmissionController::class => [
                'index', 'show', 'myReviews', 'activityLog', 'feedback', 'reviewProgress',
                'listVersions', 'downloadFile', 'calendarDeadlines',
            ],
            SubmissionReviewerController::class => ['index', 'downloadAnnotatedDocument', 'downloadDocument'],
            SubmissionAuthorController::class => ['index'],
            DocumentAnnotationController::class => ['index'],
            SubmissionMessageController::class => ['index'],
            SubmissionMeetingController::class => ['index'],
            SubmissionEmailController::class => ['index'],
            SimilarityController::class => ['result'],
            GatedReleaseController::class => ['showForSubmission'],
            NotificationController::class => ['index', 'unreadCount'],
            AnalyticsController::class => ['overview', 'turnaround', 'reviewerLoad', 'metrics'],
        ];
        $registeredReads = [];
        $checked = 0;

        foreach (app('router')->getRoutes() as $route) {
            if (!in_array('active-role', $route->gatherMiddleware(), true)) {
                continue;
            }
            $this->assertContains('read-only', $route->gatherMiddleware(), $route->uri());
            $action = $route->getActionName();
            [$controller, $method] = array_pad(explode('@', $action, 2), 2, null);
            foreach ($route->methods() as $verb) {
                $isRead = in_array($verb, ['GET', 'HEAD'], true)
                    && in_array($method, $reads[$controller] ?? [], true);
                $allowed = $isRead
                    || ($verb === 'POST' && $action === AuthController::class . '@logout')
                    || ($verb === 'PATCH' && $action === AuthController::class . '@changePassword');
                $request = Request::create('/' . $route->uri(), $verb);
                $request->setRouteResolver(fn () => $route);
                $request->setUserResolver(fn () => $this->user());
                $response = (new EnforceReadOnlyAccess())->handle($request, fn () => response()->noContent());
                $this->assertSame($allowed ? 204 : 403, $response->getStatusCode(), "$verb {$route->uri()}");
                if ($isRead) {
                    $registeredReads[$action] = true;
                }
                $checked++;
            }
        }
        $this->assertGreaterThan(50, $checked);
        foreach ($reads as $controller => $methods) {
            foreach ($methods as $method) {
                $this->assertArrayHasKey("$controller@$method", $registeredReads);
            }
        }
    }

    public function test_read_only_can_view_and_download_but_cannot_change_even_an_owned_submission(): void
    {
        $user = $this->user(['admin', 'coordinator', 'reviewer', 'student', 'readonly']);
        $user->applyActiveRole('readonly');
        $submission = (new Submission())->forceFill([
            'id' => (string) Str::uuid(), 'submitter_id' => $user->id, 'status' => 'DRAFT',
        ]);
        $gate = Gate::forUser($user);
        $this->assertTrue($gate->allows('view', $submission));
        $this->assertTrue($gate->allows('downloadFile', $submission));
        $this->assertFalse($gate->allows('create', Submission::class));
        foreach (['update', 'delete', 'withdraw', 'cancel', 'uploadVersion'] as $ability) {
            $this->assertFalse($gate->allows($ability, $submission), $ability);
        }
        $this->assertStringNotContainsString('submitter_id', Submission::visibleTo($user)->toSql());
    }

    public function test_direct_api_writes_and_administration_are_forbidden_in_the_read_only_lens(): void
    {
        $user = $this->user(['admin', 'coordinator', 'reviewer', 'readonly']);
        $this->actingAs($user, 'sanctum')->withHeader('X-Active-Role', 'readonly');
        $id = (string) Str::uuid();
        $this->postJson('/api/submissions', [])->assertForbidden()->assertJsonFragment(['message' =>
            'Read-only access: you may view submissions, documents, assignments, and reports, but cannot make changes or access administration.',
        ]);
        $this->patchJson("/api/submissions/$id", ['title' => 'Changed'])->assertForbidden();
        $this->postJson("/api/submissions/$id/versions", [])->assertForbidden();
        $this->postJson("/api/submissions/$id/submit", [])->assertForbidden();
        $this->postJson("/api/submissions/$id/gated-release", [])->assertForbidden();
        $this->postJson('/api/notifications/read', [])->assertForbidden();
        $this->getJson('/api/system/organization')->assertForbidden();
        $this->getJson('/api/system/logs')->assertForbidden();
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/admin/submission-types')->assertForbidden();
    }

    public function test_unassigned_active_role_cannot_bypass_the_guard_and_existing_roles_still_pass(): void
    {
        $user = $this->user();
        $user->applyActiveRole('admin');
        $this->assertSame(['readonly'], $user->effectiveRoles());
        $request = Request::create('/api/submissions', 'POST');
        $request->setRouteResolver(fn () => new Route('POST', 'api/submissions', SubmissionController::class . '@store'));
        $request->setUserResolver(fn () => $user);
        $guard = new EnforceReadOnlyAccess();
        $this->assertSame(403, $guard->handle($request, fn () => response()->noContent())->getStatusCode());
        foreach (['admin', 'coordinator', 'reviewer', 'student'] as $role) {
            $actor = $this->user([$role, 'readonly']);
            $actor->applyActiveRole($role);
            $request->setUserResolver(fn () => $actor);
            $this->assertSame(204, $guard->handle($request, fn () => response()->noContent())->getStatusCode());
        }
    }

    public function test_only_an_administrator_can_assign_the_new_role(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->json('roles');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_emergency_admin')->default(false);
            $table->timestamps();
        });
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_id')->nullable();
            $table->string('action');
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->string('request_id')->nullable();
        });
        $target = User::create(['name' => 'Observer', 'email' => 'observer@example.test', 'roles' => ['student']]);
        $this->actingAs($this->user(['coordinator']), 'sanctum')
            ->patchJson("/api/users/{$target->id}/roles", ['roles' => ['readonly']])->assertForbidden();
        $this->actingAs($this->user(['admin']), 'sanctum')
            ->patchJson("/api/users/{$target->id}/roles", ['roles' => ['readonly']])->assertOk();
        $this->assertSame(['readonly'], $target->fresh()->roles);
        $this->assertDatabaseHas('audit_logs', ['action' => 'USER_ROLES_CHANGED']);
    }

    public function test_assignment_browser_keeps_multiple_reviewers_and_archived_assignments(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
        });
        Schema::create('stage_definitions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('stage_role_label');
            $table->integer('order');
        });
        Schema::create('submission_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug');
            $table->string('label');
        });
        Schema::create('programs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
        });
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('status');
            $table->uuid('submitter_id');
            $table->uuid('current_stage_id');
            $table->uuid('submission_type_id')->nullable();
            $table->uuid('program_id')->nullable();
            $table->integer('current_version')->default(1);
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('submission_reviewers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('user_id');
            $table->uuid('stage_id');
            $table->string('status');
            $table->string('decision')->nullable();
            $table->timestamp('decision_at')->nullable();
            $table->date('due_at')->nullable();
        });
        $ownerId = (string) Str::uuid();
        $reviewerId = (string) Str::uuid();
        $stageId = (string) Str::uuid();
        $submissionId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $ownerId, 'name' => 'Owner', 'email' => 'owner@example.test'],
            ['id' => $reviewerId, 'name' => 'Reviewer', 'email' => 'reviewer@example.test'],
        ]);
        DB::table('stage_definitions')->insert([
            'id' => $stageId, 'name' => 'Chair', 'stage_role_label' => 'reviewer', 'order' => 1,
        ]);
        DB::table('submissions')->insert([
            'id' => $submissionId, 'title' => 'Research', 'status' => 'IN_REVIEW',
            'submitter_id' => $ownerId, 'current_stage_id' => $stageId,
        ]);
        foreach (['accepted', 'accepted', 'declined'] as $index => $status) {
            DB::table('submission_reviewers')->insert([
                'id' => (string) Str::uuid(), 'submission_id' => $submissionId,
                'user_id' => $index === 0 ? $ownerId : $reviewerId,
                'stage_id' => $stageId, 'status' => $status,
            ]);
        }

        $this->actingAs($this->user(), 'sanctum')->getJson('/api/submissions/my-reviews')
            ->assertOk()->assertJsonCount(2, 'pending')->assertJsonCount(1, 'archived')
            ->assertJsonPath('archived.0.assignment_status', 'declined')
            ->assertJsonFragment(['reviewer' => ['id' => $reviewerId, 'name' => 'Reviewer']]);
    }
}
