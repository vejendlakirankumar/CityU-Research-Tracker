<?php

namespace Database\Seeders;

use App\Models\StageDefinition;
use App\Models\SubmissionType;
use App\Models\WorkflowDefinition;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class SubmissionTypeSeeder extends Seeder
{
    public function run(): void
    {
        $workflows = [
            [
                'key' => 'dissertation',
                'name' => 'Dissertation',
                'revision_restart_policy' => 'FULL_RESTART',
                'final_status_on_pass' => 'ACCEPTED',
                'is_active' => true,
            ],
            [
                'key' => 'journal-public',
                'name' => 'Journal-public',
                'revision_restart_policy' => 'FULL_RESTART',
                'final_status_on_pass' => 'ACCEPTED',
                'is_active' => true,
            ],
        ];

        $workflowIds = [];
        foreach ($workflows as $workflow) {
            $row = WorkflowDefinition::firstOrNew(['name' => $workflow['name']]);
            if (!$row->exists) {
                $row->id = (string) Str::uuid();
            }

            $row->fill([
                'revision_restart_policy' => $workflow['revision_restart_policy'],
                'final_status_on_pass' => $workflow['final_status_on_pass'],
                'is_active' => $workflow['is_active'],
            ]);
            $row->save();

            $workflowIds[$workflow['key']] = $row->id;
        }

        $submissionTypes = [
            [
                'slug' => 'dis694e',
                'label' => 'Dissertation-Final',
                'description' => 'Doctoral students submit final dissertation document as part of the course 694E',
                'is_gated_review' => true,
                'is_blind_review' => false,
                'allow_meetings' => true,
                'max_file_size_mb' => 8,
                'allowed_extensions' => ['pdf', 'docx', 'doc'],
                'max_files' => 5,
                'is_active' => true,
                'workflow_key' => 'dissertation',
            ],
            [
                'slug' => 'dis694c',
                'label' => 'Dissertation-Proposal',
                'description' => 'Doctoral students submit dissertation proposal as part of the course 694C',
                'is_gated_review' => true,
                'is_blind_review' => false,
                'allow_meetings' => true,
                'max_file_size_mb' => 8,
                'allowed_extensions' => ['pdf', 'docx', 'doc'],
                'max_files' => 5,
                'is_active' => true,
                'workflow_key' => 'dissertation',
            ],
            [
                'slug' => 'dis694a',
                'label' => 'Dissertation-Prospectus',
                'description' => 'Doctorate students submits dissertation prospectus as part of course 694A',
                'is_gated_review' => true,
                'is_blind_review' => false,
                'allow_meetings' => true,
                'max_file_size_mb' => 8,
                'allowed_extensions' => ['pdf', 'docx', 'doc'],
                'max_files' => 5,
                'is_active' => true,
                'workflow_key' => 'dissertation',
            ],
            [
                'slug' => 'journal-public',
                'label' => 'Journal-Public',
                'description' => 'Anyone can submit journal document. It is always blind and gated review',
                'is_gated_review' => true,
                'is_blind_review' => true,
                'allow_meetings' => false,
                'max_file_size_mb' => 8,
                'allowed_extensions' => ['pdf', 'docx'],
                'max_files' => 5,
                'is_active' => true,
                'workflow_key' => 'journal-public',
            ],
        ];

        foreach ($submissionTypes as $type) {
            $workflowId = $workflowIds[$type['workflow_key']] ?? null;
            SubmissionType::updateOrCreate(
                ['slug' => $type['slug']],
                [
                    'label' => $type['label'],
                    'description' => $type['description'],
                    'is_gated_review' => $type['is_gated_review'],
                    'is_blind_review' => $type['is_blind_review'],
                    'allow_meetings' => $type['allow_meetings'],
                    'max_file_size_mb' => $type['max_file_size_mb'],
                    'allowed_extensions' => $type['allowed_extensions'],
                    'max_files' => $type['max_files'],
                    'is_active' => $type['is_active'],
                    'workflow_id' => $workflowId,
                ]
            );
        }

        $stages = [
            ['workflow_key' => 'dissertation', 'name' => 'Chair', 'order' => 1, 'is_gatekeeper' => true, 'due_days' => 7],
            ['workflow_key' => 'dissertation', 'name' => 'Committee', 'order' => 2, 'is_gatekeeper' => false, 'due_days' => 7],
            ['workflow_key' => 'dissertation', 'name' => 'ProgramDirector', 'order' => 3, 'is_gatekeeper' => false, 'due_days' => 7],
            ['workflow_key' => 'journal-public', 'name' => 'Coordinator', 'order' => 1, 'is_gatekeeper' => true, 'due_days' => 3],
            ['workflow_key' => 'journal-public', 'name' => 'Reviewers', 'order' => 2, 'is_gatekeeper' => false, 'due_days' => 7],
        ];

        foreach ($stages as $stage) {
            $workflowId = $workflowIds[$stage['workflow_key']] ?? null;
            if (!$workflowId) {
                continue;
            }

            StageDefinition::updateOrCreate(
                ['workflow_id' => $workflowId, 'order' => $stage['order']],
                [
                    'name' => $stage['name'],
                    'stage_role_label' => 'reviewer',
                    'template_id' => null,
                    'is_gatekeeper' => $stage['is_gatekeeper'],
                    'execution_type' => 'PARALLEL',
                    'approval_strategy' => 'ALL',
                    'min_approvals' => 1,
                    'is_anonymous' => false,
                    'due_days' => $stage['due_days'],
                    'visibility_config' => [],
                    'escalation_config' => [],
                    'decision_options' => ['APPROVE', 'REQUEST_CHANGES', 'REJECT'],
                    'skip_condition' => null,
                    'auto_assignment' => ['strategy' => 'MANUAL'],
                ]
            );
        }
    }
}
