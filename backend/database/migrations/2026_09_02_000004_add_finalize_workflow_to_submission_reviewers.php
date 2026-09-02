<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            // Records the decider's choice to finalize the workflow at a decision-gate stage.
            $table->boolean('finalize_workflow')->default(false)->after('decision');
        });
    }

    public function down(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->dropColumn('finalize_workflow');
        });
    }
};
