<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Submission types are fully configurable via the admin UI.
 * This seeder is intentionally empty — no hardcoded types.
 */
class SubmissionTypeSeeder extends Seeder
{
    public function run(): void
    {
        // No hardcoded submission types.
        // Use Admin > Submission Categories to create and manage types.
    }
}


class SubmissionTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            [
                'id'                 => Str::uuid()->toString(),
                'slug'               => 'dissertation-proposal',
                'label'              => 'Dissertation Proposal',
                'description'        => 'PhD dissertation proposal requiring program director approval and committee review.',
                'is_gated_review'    => true,
                'is_blind_review'    => false,
                'allow_meetings'     => true,
                'max_file_size_mb'   => 10,
                'allowed_extensions' => ['pdf', 'docx'],
                'max_files'          => 3,
                'is_active'          => true,
            ],
            [
                'id'                 => Str::uuid()->toString(),
                'slug'               => 'capstone-project',
                'label'              => 'Capstone Project',
                'description'        => 'Graduate capstone project submission for faculty review.',
                'is_gated_review'    => false,
                'is_blind_review'    => false,
                'allow_meetings'     => false,
                'max_file_size_mb'   => 8,
                'allowed_extensions' => ['pdf', 'docx', 'pptx'],
                'max_files'          => 5,
                'is_active'          => true,
            ],
            [
                'id'                 => Str::uuid()->toString(),
                'slug'               => 'journal-publication',
                'label'              => 'Journal Publication',
                'description'        => 'Research article for peer-reviewed journal submission.',
                'is_gated_review'    => false,
                'is_blind_review'    => true,
                'allow_meetings'     => false,
                'max_file_size_mb'   => 5,
                'allowed_extensions' => ['pdf', 'docx'],
                'max_files'          => 2,
                'is_active'          => true,
            ],
            [
                'id'                 => Str::uuid()->toString(),
                'slug'               => 'research-grant',
                'label'              => 'Research Grant',
                'description'        => 'External or internal research grant application requiring multi-criteria committee review.',
                'is_gated_review'    => true,
                'is_blind_review'    => false,
                'allow_meetings'     => true,
                'max_file_size_mb'   => 15,
                'allowed_extensions' => ['pdf', 'docx', 'xlsx'],
                'max_files'          => 5,
                'is_active'          => true,
            ],
        ];

        foreach ($types as $type) {
            SubmissionType::firstOrCreate(
                ['slug' => $type['slug']],
                $type,
            );
        }
    }
}
