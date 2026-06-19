<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'email' => 'admin@cityu.edu',
                'name' => 'Admin User',
                'roles' => ['admin'],
            ],
            [
                'email' => 'coordinator@cityu.edu',
                'name' => 'Coordinator User',
                'roles' => ['coordinator'],
            ],
            [
                'email' => 'reviewer@cityu.edu',
                'name' => 'Reviewer User',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'student@cityu.edu',
                'name' => 'Student User',
                'roles' => ['student'],
            ],
            [
                'email' => 'committee1@cityu.edu',
                'name' => 'Committee 1',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'committee2@cityu.edu',
                'name' => 'Committee 2',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'committee3@cityu.edu',
                'name' => 'Committee 3',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'reviewer1@cityu.edu',
                'name' => 'Reviewer 1',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'reviewer2@cityu.edu',
                'name' => 'Reviewer 2',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'reviewer3@cityu.edu',
                'name' => 'Reviewer 3',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'director1@cityu.edu',
                'name' => 'Director 1',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'director2@cityu.edu',
                'name' => 'Director 2',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'director3@cityu.edu',
                'name' => 'Director 3',
                'roles' => ['reviewer'],
            ],
            [
                'email' => 'coordinator1@cityu.edu',
                'name' => 'Coordinator 1',
                'roles' => ['coordinator'],
            ],
            [
                'email' => 'coordinator2@cityu.edu',
                'name' => 'Coordinator 2',
                'roles' => ['coordinator'],
            ],
            [
                'email' => 'coordinator3@cityu.edu',
                'name' => 'Coordinator 3',
                'roles' => ['coordinator'],
            ],
            [
                'email' => 'student1@cityu.edu',
                'name' => 'Student 1',
                'roles' => ['student'],
            ],
            [
                'email' => 'student2@cityu.edu',
                'name' => 'Student 2',
                'roles' => ['student'],
            ],
            [
                'email' => 'student3@cityu.edu',
                'name' => 'Student 3',
                'roles' => ['student'],
            ],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'password_hash' => Hash::make('admin12345'),
                    'roles' => $user['roles'],
                    'is_active' => true,
                ]
            );
        }

        User::syncEmergencyAdmin();
    }
}
