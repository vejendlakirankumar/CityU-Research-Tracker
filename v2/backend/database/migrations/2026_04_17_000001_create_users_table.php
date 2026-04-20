<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enable pgcrypto for gen_random_uuid()
        DB::statement('CREATE EXTENSION IF NOT EXISTS pgcrypto');

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('email', 255)->unique();
            $table->string('name', 255);
            $table->string('password_hash', 255);
            // Core global roles only: admin | coordinator | reviewer | student
            $table->jsonb('roles')->default('[]');
            $table->uuid('program_id')->nullable();    // FK added after programs table
            $table->boolean('is_active')->default(true);
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampsTz();
        });

        DB::statement('CREATE INDEX idx_users_email ON users(email)');
        DB::statement("CREATE INDEX idx_users_roles ON users USING GIN(roles)");
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
