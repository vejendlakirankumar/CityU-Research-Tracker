<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Server-side draft for a reviewer's decision so typed feedback and the
     * chosen decision survive navigating away before submitting. Cleared when
     * the reviewer finally submits their decision.
     */
    public function up(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->text('draft_comments')->nullable()->after('comments');
            $table->string('draft_decision')->nullable()->after('draft_comments');
            $table->timestampTz('draft_saved_at')->nullable()->after('draft_decision');
        });
    }

    public function down(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->dropColumn(['draft_comments', 'draft_decision', 'draft_saved_at']);
        });
    }
};
