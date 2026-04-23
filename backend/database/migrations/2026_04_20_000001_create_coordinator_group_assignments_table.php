<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coordinator_group_assignments', function (Blueprint $table) {
            $table->uuid('coordinator_id');
            $table->uuid('group_id');
            $table->timestampTz('assigned_at')->useCurrent();

            $table->primary(['coordinator_id', 'group_id']);

            $table->foreign('coordinator_id')
                  ->references('id')->on('users')
                  ->cascadeOnDelete();

            $table->foreign('group_id')
                  ->references('id')->on('groups')
                  ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coordinator_group_assignments');
    }
};
