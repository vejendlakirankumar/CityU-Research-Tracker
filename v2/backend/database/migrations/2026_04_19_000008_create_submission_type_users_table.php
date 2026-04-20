<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_type_users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('submission_type_id')
                  ->constrained('submission_types')
                  ->cascadeOnDelete();
            $table->foreignUuid('user_id')
                  ->constrained('users')
                  ->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['submission_type_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_type_users');
    }
};
