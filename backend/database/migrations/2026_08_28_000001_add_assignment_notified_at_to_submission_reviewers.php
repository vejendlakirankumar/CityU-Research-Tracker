<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            // Stamped when the reviewer has been sent the "you have been assigned"
            // email, so finalizing assignments again does not re-notify them.
            $table->timestamp('assignment_notified_at')->nullable()->after('reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->dropColumn('assignment_notified_at');
        });
    }
};
