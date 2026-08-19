<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds ALL application configuration and reference data required for a
 * functioning portal — safe to run on production. Every write is idempotent
 * (insertOrIgnore / updateOrInsert / updateOrCreate keyed on natural keys),
 * so it never overwrites values an operator has already changed and never
 * creates duplicates on re-run.
 *
 * This intentionally does NOT create demo users (see UsersSeeder — UAT only).
 *
 * Run on production / any fresh install with:
 *   php artisan db:seed --class=AppConfigSeeder --force
 */
class AppConfigSeeder extends Seeder
{
    public function run(): void
    {
        // ── Organization settings (singleton row) ────────────────────────────
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

        // ── Email settings (singleton row; log driver until SMTP configured) ──
        DB::table('email_settings')->insertOrIgnore([[
            'id'           => 1,
            'driver'       => 'log',
            'from_address' => 'noreply@cityurrp.example.com',
            'from_name'    => 'CityU Research Review Portal',
            'created_at'   => now(),
            'updated_at'   => now(),
        ]]);

        // ── Password policy (singleton row) ──────────────────────────────────
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

        // ── System stage templates (reusable workflow building blocks) ───────
        $stageTemplates = [
            ['name' => 'Single Blind Peer Review', 'description' => 'Two anonymous reviewers assess the submission',     'stage_role_label' => 'Peer Reviewer',   'execution_type' => 'PARALLEL',   'approval_strategy' => 'ALL',      'min_approvals' => 2, 'is_anonymous' => true,  'due_days' => 14],
            ['name' => 'Supervisor Approval',      'description' => 'Supervisor approves before the submission proceeds', 'stage_role_label' => 'Supervisor',      'execution_type' => 'SEQUENTIAL', 'approval_strategy' => 'ALL',      'min_approvals' => 1, 'is_anonymous' => false, 'due_days' => 7],
            ['name' => 'Ethics Board Review',      'description' => 'Ethics committee reviews for human/animal subjects', 'stage_role_label' => 'Ethics Reviewer', 'execution_type' => 'PARALLEL',   'approval_strategy' => 'MAJORITY', 'min_approvals' => 2, 'is_anonymous' => false, 'due_days' => 21],
            ['name' => 'Coordinator Final Check',  'description' => 'Coordinator performs final eligibility check',       'stage_role_label' => 'Coordinator',     'execution_type' => 'SEQUENTIAL', 'approval_strategy' => 'ALL',      'min_approvals' => 1, 'is_anonymous' => false, 'due_days' => 3],
        ];

        $decisionOptions = json_encode([
            ['value' => 'APPROVE',         'label' => 'Approve',         'outcome' => 'APPROVED'],
            ['value' => 'REQUEST_CHANGES', 'label' => 'Request Changes', 'outcome' => 'REVISION'],
            ['value' => 'REJECT',          'label' => 'Reject',          'outcome' => 'REJECTED'],
        ]);

        foreach ($stageTemplates as $tmpl) {
            // Keyed on name so re-runs update in place instead of duplicating.
            DB::table('stage_templates')->updateOrInsert(
                ['name' => $tmpl['name']],
                array_merge($tmpl, [
                    'decision_options'  => $decisionOptions,
                    'visibility_config' => '{}',
                    'escalation_config' => '{}',
                    'is_system'         => true,
                    'updated_at'        => now(),
                ])
            );
        }

        // ── Delegated config/reference seeders (each idempotent) ─────────────
        $this->call([
            FeatureFlagsSeeder::class,          // portal on/off toggles
            NotificationTemplatesSeeder::class, // email notification templates
            SubmissionTypeSeeder::class,        // workflows, submission types, stage definitions
            ProgramsSeeder::class,              // academic programs reference list
        ]);
    }
}
