<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name', 255);
            $table->string('slug', 100)->unique();
            $table->string('type', 50)->default('department');
            // 'department' | 'faculty' | 'school' | 'custom'
            $table->uuid('parent_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::table('groups', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('groups')->nullOnDelete();
        });

        Schema::create('programs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name', 255);
            $table->string('school', 255);
            $table->uuid('program_director_id')->nullable();
            $table->uuid('group_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->foreign('program_director_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('group_id')->references('id')->on('groups')->nullOnDelete();
        });

        // Add FK from users to programs (deferred — programs must exist first)
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('program_id')->references('id')->on('programs')->nullOnDelete();
        });

        Schema::create('user_groups', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('group_id');
            $table->string('role', 50)->default('member');
            // 'member' | 'lead' | 'manager'
            $table->timestampTz('joined_at')->default(DB::raw('now()'));

            $table->primary(['user_id', 'group_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('group_id')->references('id')->on('groups')->cascadeOnDelete();
        });

        DB::statement('CREATE INDEX idx_user_groups_group ON user_groups(group_id)');
        DB::statement('CREATE INDEX idx_user_groups_user ON user_groups(user_id)');
    }

    public function down(): void
    {
        Schema::dropIfExists('user_groups');
        Schema::table('users', fn (Blueprint $t) => $t->dropForeign(['program_id']));
        Schema::dropIfExists('programs');
        Schema::dropIfExists('groups');
    }
};
