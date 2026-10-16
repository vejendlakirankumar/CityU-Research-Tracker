<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->unsignedInteger('reviewer_feedback_max_file_size_mb')->default(25);
            $table->unsignedInteger('reviewer_feedback_max_files')->default(10);
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['reviewer_feedback_max_file_size_mb', 'reviewer_feedback_max_files']);
        });
    }
};
