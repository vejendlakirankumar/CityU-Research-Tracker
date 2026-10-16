<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('request_id')->index();
            $table->string('level', 10)->index();
            $table->string('event', 80);
            $table->uuid('user_id')->nullable();
            $table->uuid('submission_id')->nullable()->index();
            $table->uuid('reviewer_id')->nullable();
            $table->string('route')->nullable();
            $table->json('context');
            $table->timestampTz('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_logs');
    }
};
