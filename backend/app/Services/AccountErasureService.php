<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * AccountErasureService
 *
 * Implements GDPR "right to erasure" for a user account. Permanently and
 * irreversibly removes the user together with every record that contains
 * their personal data:
 *   - the user row, profile, settings and credentials
 *   - all submissions authored by the user (and every child record)
 *   - the user's activity on other submissions (reviews, messages,
 *     annotations, meetings, authorship, assignments)
 *   - uploaded document files belonging to the user's submissions
 *
 * The workflow tables include a handful of "immutable" tables protected by
 * PostgreSQL rules (audit_logs, review_decisions, gated_releases). Those
 * rules are temporarily disabled inside the transaction so the personal
 * data they hold can be erased, then re-enabled before the transaction
 * commits.
 */
class AccountErasureService
{
    /**
     * Build a read-only summary of everything that would be erased. Used by
     * the admin UI to review a user's footprint before confirming deletion.
     *
     * @return array{user: array, submissions: array<int, array>, counts: array<string, int>}
     */
    public function preview(User $user): array
    {
        $userId = $user->id;

        $submissions = DB::table('submissions')
            ->where('submitter_id', $userId)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'status', 'created_at']);

        $submissionIds = $submissions->pluck('id')->all();

        $counts = [
            'submissions'          => count($submissionIds),
            'submission_versions'  => $this->count('submission_versions', 'submission_id', $submissionIds, 'created_by', $userId),
            'documents'            => $this->documentFileCount($submissionIds),
            'reviews_by_user'      => DB::table('submission_reviewers')->where('user_id', $userId)->count(),
            'review_decisions'     => $this->count('review_decisions', 'submission_id', $submissionIds, 'reviewer_id', $userId),
            'messages'             => $this->count('submission_messages', 'submission_id', $submissionIds, 'sender_id', $userId),
            'annotations'          => $this->count('document_annotations', 'submission_id', $submissionIds, 'annotator_id', $userId),
            'authorships'          => $this->count('submission_authors', 'submission_id', $submissionIds, 'user_id', $userId),
            'meetings'             => $this->count('submission_meetings', 'submission_id', $submissionIds, 'requested_by', $userId),
            'appeals'              => $this->count('appeal_requests', 'submission_id', $submissionIds, 'submitter_id', $userId),
            'emails'               => empty($submissionIds) ? 0 : DB::table('submission_emails')->whereIn('submission_id', $submissionIds)->count(),
            'notifications'        => DB::table('notifications')->where('user_id', $userId)->count(),
            'audit_entries'        => $this->count('audit_logs', 'submission_id', $submissionIds, 'actor_id', $userId),
            'group_memberships'    => DB::table('user_groups')->where('user_id', $userId)->count(),
        ];

        return [
            'user' => [
                'id'           => $user->id,
                'name'         => $user->name,
                'email'        => $user->email,
                'first_name'   => $user->first_name,
                'last_name'    => $user->last_name,
                'organization' => $user->organization,
                'org_role'     => $user->org_role,
                'roles'        => $user->roles,
                'is_active'    => $user->is_active,
                'created_at'   => $user->created_at,
                'last_login_at'=> $user->last_login_at,
            ],
            'submissions' => $submissions->map(fn ($s) => [
                'id'         => $s->id,
                'title'      => $s->title,
                'status'     => $s->status,
                'created_at' => $s->created_at,
            ])->all(),
            'counts' => $counts,
        ];
    }

    /**
     * Permanently erase the user and all associated personal data.
     *
     * @return array<string, int> Number of rows removed per table.
     */
    public function erase(User $user): array
    {
        $userId = $user->id;
        $deleted = [];

        // Resolve submission ids and file paths BEFORE the transaction so we can
        // clean storage only after a successful commit.
        $submissionIds = DB::table('submissions')->where('submitter_id', $userId)->pluck('id')->all();

        $annotatedPaths = DB::table('submission_reviewers')
            ->where(function ($q) use ($submissionIds, $userId) {
                if (!empty($submissionIds)) {
                    $q->whereIn('submission_id', $submissionIds);
                }
                $q->orWhere('user_id', $userId);
            })
            ->whereNotNull('annotated_document_path')
            ->pluck('annotated_document_path')
            ->all();

        DB::transaction(function () use ($userId, $submissionIds, &$deleted) {
            // Temporarily lift the immutability rules that would otherwise block
            // deletion of personal data held in the audit / decision tables.
            $this->toggleImmutableRules(false);

            try {
                $runIds = empty($submissionIds) ? []
                    : DB::table('workflow_runs')->whereIn('submission_id', $submissionIds)->pluck('id')->all();

                $stageInstanceIds = empty($runIds) ? []
                    : DB::table('stage_instances')->whereIn('workflow_run_id', $runIds)->pluck('id')->all();

                // ── Deepest children first ──────────────────────────────────
                $deleted['escalation_logs']    = $this->del('escalation_logs', 'stage_instance_id', $stageInstanceIds);
                $deleted['review_decisions']   = $this->delMulti('review_decisions', [
                    ['submission_id', $submissionIds],
                    ['stage_instance_id', $stageInstanceIds],
                    ['reviewer_id', $userId],
                ]);
                $deleted['gated_releases']     = $this->delMulti('gated_releases', [
                    ['submission_id', $submissionIds],
                    ['workflow_run_id', $runIds],
                    ['released_by', $userId],
                ]);
                $deleted['stage_assignments']  = $this->delMulti('stage_assignments', [
                    ['stage_instance_id', $stageInstanceIds],
                    ['user_id', $userId],
                    ['assigned_by', $userId],
                ]);
                $deleted['workflow_runs']      = $this->del('workflow_runs', 'id', $runIds);

                $deleted['document_annotations'] = $this->delMulti('document_annotations', [
                    ['submission_id', $submissionIds],
                    ['annotator_id', $userId],
                ]);
                $deleted['submission_emails']  = $this->del('submission_emails', 'submission_id', $submissionIds);
                $deleted['submission_messages']= $this->delMulti('submission_messages', [
                    ['submission_id', $submissionIds],
                    ['sender_id', $userId],
                ]);
                $deleted['submission_authors'] = $this->delMulti('submission_authors', [
                    ['submission_id', $submissionIds],
                    ['user_id', $userId],
                ]);
                $deleted['submission_reviewers'] = $this->delMulti('submission_reviewers', [
                    ['submission_id', $submissionIds],
                    ['user_id', $userId],
                    ['assigned_by', $userId],
                ]);
                $deleted['submission_meetings'] = $this->delMulti('submission_meetings', [
                    ['submission_id', $submissionIds],
                    ['requested_by', $userId],
                ]);
                $deleted['meetings']           = $this->delMulti('meetings', [
                    ['submission_id', $submissionIds],
                    ['created_by', $userId],
                ]);
                $deleted['appeal_requests']    = $this->delMulti('appeal_requests', [
                    ['submission_id', $submissionIds],
                    ['submitter_id', $userId],
                ]);
                $deleted['audit_logs']         = $this->delMulti('audit_logs', [
                    ['submission_id', $submissionIds],
                    ['actor_id', $userId],
                ]);
                $deleted['submission_versions'] = $this->delMulti('submission_versions', [
                    ['submission_id', $submissionIds],
                    ['created_by', $userId],
                ]);
                $deleted['submissions']        = $this->del('submissions', 'id', $submissionIds);

                // ── User-scoped records ─────────────────────────────────────
                $deleted['reviewer_pools']          = $this->del('reviewer_pools', 'user_id', $userId);
                $deleted['notifications']           = $this->del('notifications', 'user_id', $userId);
                $deleted['notification_preferences']= $this->del('notification_preferences', 'user_id', $userId);
                $deleted['password_history']        = $this->del('password_history', 'user_id', $userId);
                $deleted['user_groups']             = $this->del('user_groups', 'user_id', $userId);
                $deleted['coordinator_group_assignments'] = $this->del('coordinator_group_assignments', 'coordinator_id', $userId);
                $deleted['user_sso_identities']     = $this->del('user_sso_identities', 'user_id', $userId);
                $deleted['personal_access_tokens']  = DB::table('personal_access_tokens')
                    ->where('tokenable_type', User::class)
                    ->where('tokenable_id', $userId)
                    ->delete();

                // Remove the user while the immutable rules are still DISABLED.
                // audit_logs.actor_id is ON DELETE SET NULL, so deleting the user
                // makes PostgreSQL run an internal UPDATE on audit_logs to null the
                // reference. If the no_update_audit rule were active it would rewrite
                // that referential-integrity query to "DO INSTEAD NOTHING" and the
                // delete would fail with "referential integrity query on users ...
                // gave unexpected result". Remaining nullable FKs (announcements,
                // custom_roles, email_templates, config_overrides, programs, etc.)
                // are set to NULL automatically by their ON DELETE SET NULL rules.
                $deleted['users'] = DB::table('users')->where('id', $userId)->delete();
            } finally {
                // Always restore the immutability guarantees.
                $this->toggleImmutableRules(true);
            }
        });

        // Purge uploaded documents only after the DB transaction has committed.
        $this->deleteFiles($submissionIds, $annotatedPaths);

        return array_filter($deleted, fn ($n) => $n > 0);
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private function toggleImmutableRules(bool $enable): void
    {
        $verb = $enable ? 'ENABLE' : 'DISABLE';
        $rules = [
            ['audit_logs', 'no_delete_audit'],
            ['audit_logs', 'no_update_audit'],
            ['review_decisions', 'no_delete_decisions'],
            ['gated_releases', 'no_delete_releases'],
        ];
        foreach ($rules as [$table, $rule]) {
            DB::statement("ALTER TABLE {$table} {$verb} RULE {$rule}");
        }
    }

    /**
     * Delete rows where a single column matches the given value(s).
     */
    private function del(string $table, string $column, string|array $value): int
    {
        if (is_array($value)) {
            if (empty($value)) {
                return 0;
            }
            return DB::table($table)->whereIn($column, $value)->delete();
        }
        return DB::table($table)->where($column, $value)->delete();
    }

    /**
     * Delete rows matching ANY of the given [column, value] conditions.
     *
     * @param array<int, array{0: string, 1: string|array}> $conditions
     */
    private function delMulti(string $table, array $conditions): int
    {
        $query = DB::table($table);
        $applied = false;

        $query->where(function ($q) use ($conditions, &$applied) {
            foreach ($conditions as [$column, $value]) {
                if (is_array($value)) {
                    if (empty($value)) {
                        continue;
                    }
                    $q->orWhereIn($column, $value);
                    $applied = true;
                } else {
                    $q->orWhere($column, $value);
                    $applied = true;
                }
            }
        });

        return $applied ? $query->delete() : 0;
    }

    /**
     * Count rows matching a submission-scoped column OR a user-scoped column.
     */
    private function count(string $table, string $subCol, array $submissionIds, string $userCol, string $userId): int
    {
        return DB::table($table)
            ->where(function ($q) use ($subCol, $submissionIds, $userCol, $userId) {
                if (!empty($submissionIds)) {
                    $q->whereIn($subCol, $submissionIds);
                }
                $q->orWhere($userCol, $userId);
            })
            ->count();
    }

    private function documentFileCount(array $submissionIds): int
    {
        if (empty($submissionIds)) {
            return 0;
        }
        $versions = DB::table('submission_versions')
            ->whereIn('submission_id', $submissionIds)
            ->pluck('document_paths');

        $total = 0;
        foreach ($versions as $paths) {
            $decoded = is_string($paths) ? json_decode($paths, true) : $paths;
            if (is_array($decoded)) {
                $total += count($decoded);
            }
        }
        return $total;
    }

    private function deleteFiles(array $submissionIds, array $annotatedPaths): void
    {
        foreach ($submissionIds as $sid) {
            try {
                Storage::deleteDirectory("uploads/{$sid}");
            } catch (\Throwable $e) {
                // Best-effort cleanup; DB record is already gone.
            }
        }
        foreach (array_filter($annotatedPaths) as $path) {
            try {
                if (Storage::exists($path)) {
                    Storage::delete($path);
                }
            } catch (\Throwable $e) {
                // Best-effort cleanup.
            }
        }
    }
}
