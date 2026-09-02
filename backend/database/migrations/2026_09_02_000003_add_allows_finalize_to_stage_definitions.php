<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stage_definitions', function (Blueprint $table) {
            // When true, the stage's decider may end the workflow early on approval
            // instead of always advancing to the next stage.
            $table->boolean('allows_finalize')->default(false)->after('is_email_stage');
        });
    }

    public function down(): void
    {
        Schema::table('stage_definitions', function (Blueprint $table) {
            $table->dropColumn('allows_finalize');
        });
    }
};
