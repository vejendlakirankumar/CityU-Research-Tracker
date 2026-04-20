<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_meetings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('submission_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('stage_id')->nullable()->constrained('stage_definitions')->nullOnDelete();
            $table->foreignUuid('requested_by')->constrained('users');
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('proposed_at')->nullable();
            $table->enum('status', ['requested', 'confirmed', 'cancelled', 'completed'])->default('requested');
            $table->timestamp('confirmed_at')->nullable();
            $table->string('meeting_link', 500)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_meetings');
    }
};
