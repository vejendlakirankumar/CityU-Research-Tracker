<?php

namespace Database\Seeders;

use App\Models\Program;
use Illuminate\Database\Seeder;

class ProgramsSeeder extends Seeder
{
    public function run(): void
    {
        $programs = [
            ['school' => 'School of Technology and Computing', 'name' => 'Bachelor of Science in Applied Computer Science'],
            ['school' => 'School of Technology and Computing', 'name' => 'Bachelor of Science in Cybersecurity'],
            ['school' => 'School of Technology and Computing', 'name' => 'Bachelor of Science in Data Science'],
            ['school' => 'School of Technology and Computing', 'name' => 'Doctor of Information Technology'],
            ['school' => 'School of Technology and Computing', 'name' => 'Graduate Certificate in Data Mining and Analytics'],
            ['school' => 'School of Technology and Computing', 'name' => 'Graduate Certificate in Full-Stack Development'],
            ['school' => 'School of Technology and Computing', 'name' => 'Graduate Certificate in Systems Security'],
            ['school' => 'School of Technology and Computing', 'name' => 'Master of Science in Artificial Intelligence (MSAI)'],
            ['school' => 'School of Technology and Computing', 'name' => 'Master of Science in Computer Science'],
            ['school' => 'School of Technology and Computing', 'name' => 'Master of Science in Cybersecurity'],
            ['school' => 'School of Technology and Computing', 'name' => 'Master of Science in Data Science'],
            ['school' => 'School of Technology and Computing', 'name' => 'Undergraduate Certificate in Advancement of Computing - Cybersecurity'],
            ['school' => 'School of Technology and Computing', 'name' => 'Undergraduate Certificate in Advancement of Computing - Data Science'],
            ['school' => 'School of Technology and Computing', 'name' => 'Undergraduate Certificate in Foundations of Computing'],
            ['school' => 'School of Technology and Computing', 'name' => 'Undergraduate Certificate in Foundations of System Development'],
            ['school' => 'School of Technology and Computing', 'name' => 'Undergraduate Certificate in Fundamentals of Computing'],

            ['school' => 'School of Business Management', 'name' => 'Associate of Science in Business'],
            ['school' => 'School of Business Management', 'name' => 'Associate of Science in Management'],
            ['school' => 'School of Business Management', 'name' => 'Bachelor of Arts in Management'],
            ['school' => 'School of Business Management', 'name' => 'Bachelor of Science in Business Administration'],
            ['school' => 'School of Business Management', 'name' => 'Bachelor of Science in Business and Data Analytics'],
            ['school' => 'School of Business Management', 'name' => 'Bachelor of Science in Healthcare Administration'],
            ['school' => 'School of Business Management', 'name' => 'Bachelor of Science in Project Management'],
            ['school' => 'School of Business Management', 'name' => 'Doctor of Business Administration (DBA)'],
            ['school' => 'School of Business Management', 'name' => "Executive Master's in Business Administration (EMBA)"],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Change Leadership'],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Data Analytics'],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Human Resource Management'],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Lean Six Sigma'],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Marketing'],
            ['school' => 'School of Business Management', 'name' => 'Graduate Certificate in Project Management'],
            ['school' => 'School of Business Management', 'name' => 'Master in Technology and Product Management'],
            ['school' => 'School of Business Management', 'name' => 'Master of Business Administration (MBA)'],
            ['school' => 'School of Business Management', 'name' => 'Master of Science in Healthcare Administration'],
            ['school' => 'School of Business Management', 'name' => 'Master of Science in Human Resource Management'],
            ['school' => 'School of Business Management', 'name' => 'Master of Science in Management'],
            ['school' => 'School of Business Management', 'name' => 'Master of Science in Management and Leadership'],
            ['school' => 'School of Business Management', 'name' => 'Master of Science in Organizational Leadership'],
            ['school' => 'School of Business Management', 'name' => "Master's in Project Management"],
            ['school' => 'School of Business Management', 'name' => 'Postgraduate Certificate in Business Strategy, Technology, and Change'],
            ['school' => 'School of Business Management', 'name' => 'Postgraduate Certificate in Leadership, Diversity, and Innovation'],
            ['school' => 'School of Business Management', 'name' => 'Undergraduate Certificate in Project Management'],
        ];

        foreach ($programs as $program) {
            Program::updateOrCreate(
                ['name' => $program['name']],
                [
                    'school' => $program['school'],
                    'is_active' => true,
                ]
            );
        }
    }
}
