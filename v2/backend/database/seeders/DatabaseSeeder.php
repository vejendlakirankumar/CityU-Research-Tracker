<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Organization settings ────────────────────────────────────────────
        DB::table('organization_settings')->insertOrIgnore([[
            'id'             => 1,
            'org_name'       => 'City University Research Review Portal',
            'org_short_name' => 'CityU RRP',
            'primary_color'  => '#1E40AF',
            'timezone'       => 'Asia/Hong_Kong',
            'locale'         => 'en',
            'date_format'    => 'YYYY-MM-DD',
            'support_email'  => 'rrp-support@example.com',
            'created_at'     => now(),
            'updated_at'     => now(),
        ]]);

        // ── Email settings (log driver for dev) ──────────────────────────────
        DB::table('email_settings')->insertOrIgnore([[
            'id'           => 1,
            'driver'       => 'log',
            'from_address' => 'noreply@cityurrp.example.com',
            'from_name'    => 'CityU Research Review Portal',
            'created_at'   => now(),
            'updated_at'   => now(),
        ]]);

        // ── Password policy ──────────────────────────────────────────────────
        DB::table('password_policy')->insertOrIgnore([[
            'id'                       => 1,
            'min_length'               => 12,
            'require_uppercase'        => true,
            'require_number'           => true,
            'require_special'          => true,
            'expiry_days'              => null,
            'history_count'            => 5,
            'max_login_attempts'       => 5,
            'lockout_duration_minutes' => 15,
            'session_timeout_minutes'  => 480,
            'require_2fa'              => false,
        ]]);

        // ── Feature flags ────────────────────────────────────────────────────
        $flags = [
            ['key' => 'sso_enabled',             'value' => false, 'description' => 'Enable SSO login button'],
            ['key' => 'public_registration',      'value' => false, 'description' => 'Allow self-registration'],
            ['key' => 'webhooks_enabled',         'value' => false, 'description' => 'Enable webhook delivery'],
            ['key' => 'allow_appeals',            'value' => true,  'description' => 'Allow appeal requests'],
            ['key' => 'allow_meetings',           'value' => true,  'description' => 'Enable meeting scheduling'],
            ['key' => 'realtime_notifications',   'value' => false, 'description' => 'Enable WebSocket (Reverb) notifications'],
            ['key' => 'reviewer_pool_enabled',    'value' => true,  'description' => 'Enable reviewer pool management'],
            ['key' => 'audit_log_enabled',        'value' => true,  'description' => 'Log all audit events'],
            ['key' => 'file_storage_s3',          'value' => false, 'description' => 'Use S3 for file storage (else local)'],
        ];

        foreach ($flags as $flag) {
            DB::table('feature_flags')->updateOrInsert(
                ['key' => $flag['key']],
                $flag
            );
        }

        // ── Notification templates ────────────────────────────────────────────
        $templates = [
            [
                'event_type' => 'SUBMISSION_RECEIVED',
                'subject'    => 'Submission Received: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your submission "<strong>{{submission_title}}</strong>" has been received and is under review.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" has been received.",
            ],
            [
                'event_type' => 'STAGE_ASSIGNED',
                'subject'    => 'Review Assignment: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>You have been assigned to review "<strong>{{submission_title}}</strong>".</p><p>Due date: {{due_date}}</p>',
                'body_text'  => "Dear {{user_name}},\n\nYou have been assigned to review \"{{submission_title}}\".\nDue: {{due_date}}",
            ],
            [
                'event_type' => 'REVISION_REQUIRED',
                'subject'    => 'Revision Required: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your submission "<strong>{{submission_title}}</strong>" requires revision. Please review the comments and resubmit.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" requires revision.",
            ],
            [
                'event_type' => 'SUBMISSION_ACCEPTED',
                'subject'    => 'Submission Accepted: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Congratulations! Your submission "<strong>{{submission_title}}</strong>" has been accepted.</p>',
                'body_text'  => "Dear {{user_name}},\n\nCongratulations! Your submission \"{{submission_title}}\" has been accepted.",
            ],
            [
                'event_type' => 'SUBMISSION_REJECTED',
                'subject'    => 'Submission Outcome: {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>After careful review, your submission "<strong>{{submission_title}}</strong>" was not accepted at this time.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour submission \"{{submission_title}}\" was not accepted.",
            ],
            [
                'event_type' => 'STAGE_OVERDUE',
                'subject'    => 'Action Required: Review Overdue for {{submission_title}}',
                'body_html'  => '<p>Dear {{user_name}},</p><p>Your review of "<strong>{{submission_title}}</strong>" is now overdue. Please submit your review at your earliest convenience.</p>',
                'body_text'  => "Dear {{user_name}},\n\nYour review of \"{{submission_title}}\" is overdue.",
            ],
            [
                'event_type' => 'APPEAL_SUBMITTED',
                'subject'    => 'Appeal Received for {{submission_title}}',
                'body_html'  => '<p>An appeal has been submitted for "<strong>{{submission_title}}</strong>" and is awaiting coordinator review.</p>',
                'body_text'  => "An appeal has been submitted for \"{{submission_title}}\".",
            ],
        ];

        foreach ($templates as $template) {
            DB::table('notification_templates')->updateOrInsert(
                ['event_type' => $template['event_type']],
                array_merge($template, [
                    'id'         => (string) Str::uuid(),
                    'is_active'  => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        // ── Stage templates ───────────────────────────────────────────────────
        $stageTemplates = [
            [
                'name'              => 'Single Blind Peer Review',
                'description'       => 'Two anonymous reviewers assess the submission',
                'stage_role_label'  => 'Peer Reviewer',
                'execution_type'    => 'PARALLEL',
                'approval_strategy' => 'ALL',
                'min_approvals'     => 2,
                'is_anonymous'      => true,
                'due_days'          => 14,
                'is_system'         => true,
            ],
            [
                'name'              => 'Supervisor Approval',
                'description'       => 'Supervisor approves before the submission proceeds',
                'stage_role_label'  => 'Supervisor',
                'execution_type'    => 'SEQUENTIAL',
                'approval_strategy' => 'ALL',
                'min_approvals'     => 1,
                'is_anonymous'      => false,
                'due_days'          => 7,
                'is_system'         => true,
            ],
            [
                'name'              => 'Ethics Board Review',
                'description'       => 'Ethics committee reviews for human/animal subjects',
                'stage_role_label'  => 'Ethics Reviewer',
                'execution_type'    => 'PARALLEL',
                'approval_strategy' => 'MAJORITY',
                'min_approvals'     => 2,
                'is_anonymous'      => false,
                'due_days'          => 21,
                'is_system'         => true,
            ],
            [
                'name'              => 'Coordinator Final Check',
                'description'       => 'Coordinator performs final eligibility check',
                'stage_role_label'  => 'Coordinator',
                'execution_type'    => 'SEQUENTIAL',
                'approval_strategy' => 'ALL',
                'min_approvals'     => 1,
                'is_anonymous'      => false,
                'due_days'          => 3,
                'is_system'         => true,
            ],
        ];

        foreach ($stageTemplates as $tmpl) {
            DB::table('stage_templates')->insertOrIgnore(
                array_merge($tmpl, [
                    'id'         => (string) Str::uuid(),
                    'decision_options' => json_encode([
                        ['value' => 'APPROVE', 'label' => 'Approve', 'outcome' => 'APPROVED'],
                        ['value' => 'REQUEST_CHANGES', 'label' => 'Request Changes', 'outcome' => 'REVISION'],
                        ['value' => 'REJECT', 'label' => 'Reject', 'outcome' => 'REJECTED'],
                    ]),
                    'visibility_config' => '{}',
                    'escalation_config' => '{}',
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ])
            );
        }

        // ── Groups ────────────────────────────────────────────────────────────
        $facultyId = (string) Str::uuid();
        $deptId    = (string) Str::uuid();

        DB::table('groups')->insertOrIgnore([
            [
                'id'        => $facultyId,
                'name'      => 'Faculty of Science',
                'slug'      => 'faculty-of-science',
                'type'      => 'faculty',
                'parent_id' => null,
                'is_active' => true,
                'created_at'=> now(),
                'updated_at'=> now(),
            ],
            [
                'id'        => $deptId,
                'name'      => 'Department of Computer Science',
                'slug'      => 'dept-cs',
                'type'      => 'department',
                'parent_id' => $facultyId,
                'is_active' => true,
                'created_at'=> now(),
                'updated_at'=> now(),
            ],
        ]);

        // ── Users ─────────────────────────────────────────────────────────────
        $adminId      = (string) Str::uuid();
        $coordId1     = (string) Str::uuid();
        $coordId2     = (string) Str::uuid();
        $reviewerId1  = (string) Str::uuid();
        $reviewerId2  = (string) Str::uuid();
        $reviewerId3  = (string) Str::uuid();
        $studentId1   = (string) Str::uuid();
        $studentId2   = (string) Str::uuid();
        $studentId3   = (string) Str::uuid();

        $usersToInsert = [
            [
                'id'            => $adminId,
                'email'         => 'admin@rrp.local',
                'name'          => 'Portal Administrator',
                'password_hash' => Hash::make('Admin@RRP2026!'),
                'roles'         => json_encode(['admin']),
                'is_active'     => true,
            ],
            [
                'id'            => $coordId1,
                'email'         => 'coordinator1@rrp.local',
                'name'          => 'Alice Coordinator',
                'password_hash' => Hash::make('Coord@RRP2026!'),
                'roles'         => json_encode(['coordinator']),
                'is_active'     => true,
            ],
            [
                'id'            => $coordId2,
                'email'         => 'coordinator2@rrp.local',
                'name'          => 'Bob Coordinator',
                'password_hash' => Hash::make('Coord@RRP2026!'),
                'roles'         => json_encode(['coordinator']),
                'is_active'     => true,
            ],
            [
                'id'            => $reviewerId1,
                'email'         => 'reviewer1@rrp.local',
                'name'          => 'Dr. Carol Reviewer',
                'password_hash' => Hash::make('Review@RRP2026!'),
                'roles'         => json_encode(['reviewer']),
                'is_active'     => true,
            ],
            [
                'id'            => $reviewerId2,
                'email'         => 'reviewer2@rrp.local',
                'name'          => 'Dr. Dave Reviewer',
                'password_hash' => Hash::make('Review@RRP2026!'),
                'roles'         => json_encode(['reviewer']),
                'is_active'     => true,
            ],
            [
                'id'            => $reviewerId3,
                'email'         => 'reviewer3@rrp.local',
                'name'          => 'Dr. Eve Reviewer',
                'password_hash' => Hash::make('Review@RRP2026!'),
                'roles'         => json_encode(['reviewer']),
                'is_active'     => true,
            ],
            [
                'id'            => $studentId1,
                'email'         => 'student1@rrp.local',
                'name'          => 'Frank Student',
                'password_hash' => Hash::make('Student@RRP2026!'),
                'roles'         => json_encode(['student']),
                'is_active'     => true,
            ],
            [
                'id'            => $studentId2,
                'email'         => 'student2@rrp.local',
                'name'          => 'Grace Student',
                'password_hash' => Hash::make('Student@RRP2026!'),
                'roles'         => json_encode(['student']),
                'is_active'     => true,
            ],
            [
                'id'            => $studentId3,
                'email'         => 'student3@rrp.local',
                'name'          => 'Henry Student',
                'password_hash' => Hash::make('Student@RRP2026!'),
                'roles'         => json_encode(['student']),
                'is_active'     => true,
            ],
        ];

        foreach ($usersToInsert as &$u) {
            $u['created_at'] = now();
            $u['updated_at'] = now();
        }
        unset($u);

        DB::table('users')->insertOrIgnore($usersToInsert);

        // ── Programs ──────────────────────────────────────────────────────────
        $progId1 = (string) Str::uuid();
        $progId2 = (string) Str::uuid();

        DB::table('programs')->insertOrIgnore([
            [
                'id'                  => $progId1,
                'name'                => 'MSc Computer Science',
                'school'              => 'School of Science',
                'program_director_id' => $coordId1,
                'group_id'            => $deptId,
                'is_active'           => true,
                'created_at'          => now(),
                'updated_at'          => now(),
            ],
            [
                'id'                  => $progId2,
                'name'                => 'PhD Computational Biology',
                'school'              => 'School of Science',
                'program_director_id' => $coordId2,
                'group_id'            => $deptId,
                'is_active'           => true,
                'created_at'          => now(),
                'updated_at'          => now(),
            ],
        ]);

        // Assign students to programs
        DB::table('users')
            ->whereIn('id', [$studentId1, $studentId2])
            ->update(['program_id' => $progId1]);
        DB::table('users')
            ->where('id', $studentId3)
            ->update(['program_id' => $progId2]);

        // ── User group memberships ─────────────────────────────────────────────
        $groupMembers = [
            ['user_id' => $coordId1,   'group_id' => $deptId, 'role' => 'coordinator'],
            ['user_id' => $reviewerId1, 'group_id' => $deptId, 'role' => 'reviewer'],
            ['user_id' => $reviewerId2, 'group_id' => $deptId, 'role' => 'reviewer'],
        ];

        foreach ($groupMembers as $member) {
            DB::table('user_groups')->insertOrIgnore(
                array_merge($member, ['joined_at' => now()])
            );
        }
    }
}
