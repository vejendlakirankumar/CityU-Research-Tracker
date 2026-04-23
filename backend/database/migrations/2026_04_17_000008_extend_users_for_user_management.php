<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 255)->nullable()->after('email');
            $table->string('last_name', 255)->nullable()->after('first_name');
            $table->string('organization', 255)->nullable()->after('last_name');
            $table->string('org_role', 100)->nullable()->after('organization');
            $table->unsignedSmallInteger('failed_login_attempts')->default(0)->after('is_active');
            $table->timestampTz('locked_at')->nullable()->after('failed_login_attempts');
            $table->timestampTz('last_login_attempt_at')->nullable()->after('last_login_at');
            $table->boolean('last_login_success')->nullable()->after('last_login_attempt_at');
            $table->boolean('is_emergency_admin')->default(false)->after('last_login_success');
        });

        // Populate first_name / last_name from existing name column
        DB::statement("
            UPDATE users
            SET
                first_name = split_part(name, ' ', 1),
                last_name  = NULLIF(trim(substring(name from position(' ' in name))), '')
            WHERE name IS NOT NULL
        ");

        // Create the emergency admin user
        $existing = DB::table('users')->where('is_emergency_admin', true)->first();
        if (!$existing) {
            $id = DB::selectOne("SELECT gen_random_uuid() AS id")->id;
            DB::table('users')->insert([
                'id'                   => $id,
                'email'                => 'emergency.admin@system.local',
                'name'                 => 'Emergency Admin',
                'first_name'           => 'Emergency',
                'last_name'            => 'Admin',
                'password_hash'        => Hash::make('admin12345'),
                'roles'                => json_encode(['admin']),
                'is_active'            => false, // will be activated by sync logic on first check
                'is_emergency_admin'   => true,
                'failed_login_attempts'=> 0,
                'created_at'           => now(),
                'updated_at'           => now(),
            ]);

            // Activate it only if no other admin exists yet
            $otherAdmins = DB::table('users')
                ->where('is_emergency_admin', false)
                ->whereRaw("roles @> ?", [json_encode(['admin'])])
                ->where('is_active', true)
                ->count();

            if ($otherAdmins === 0) {
                DB::table('users')
                    ->where('id', $id)
                    ->update(['is_active' => true]);
            }
        }
    }

    public function down(): void
    {
        // Remove emergency admin
        DB::table('users')->where('is_emergency_admin', true)->delete();

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'first_name', 'last_name', 'organization', 'org_role',
                'failed_login_attempts', 'locked_at',
                'last_login_attempt_at', 'last_login_success',
                'is_emergency_admin',
            ]);
        });
    }
};
