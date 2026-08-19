<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Full seed for local / UAT environments: all application configuration
     * and reference data, PLUS demo users.
     *
     * Production must seed configuration only (no demo users) with:
     *   php artisan db:seed --class=AppConfigSeeder --force
     */
    public function run(): void
    {
        // Application configuration + reference data (idempotent, production-safe):
        //   organization_settings, email_settings, password_policy, stage_templates,
        //   feature_flags, notification_templates, workflows/submission_types/stage_definitions,
        //   programs.
        $this->call(AppConfigSeeder::class);

        // Demo users — UAT / local only. Never run on production.
        $this->call(UsersSeeder::class);

        // Groups are created via the admin UI after first login.
        // The emergency admin account is provisioned automatically by User::syncEmergencyAdmin().
    }
}
