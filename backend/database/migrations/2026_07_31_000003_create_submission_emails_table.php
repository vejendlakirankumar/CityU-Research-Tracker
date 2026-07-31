<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_emails', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('stage_id')->nullable();
            $table->uuid('template_id')->nullable();
            $table->uuid('sender_id')->nullable();
            $table->string('recipient_email', 255);
            $table->string('recipient_name', 255)->nullable();
            $table->string('subject', 500);
            $table->text('body_html');
            $table->text('body_text')->nullable();
            $table->string('status', 20)->default('sent');
            $table->text('error')->nullable();
            $table->timestampTz('sent_at')->nullable();
            $table->timestampsTz();

            $table->foreign('submission_id')->references('id')->on('submissions')->cascadeOnDelete();
            $table->foreign('stage_id')->references('id')->on('stage_definitions')->nullOnDelete();
            $table->foreign('template_id')->references('id')->on('email_templates')->nullOnDelete();
            $table->foreign('sender_id')->references('id')->on('users')->nullOnDelete();
            $table->index('submission_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_emails');
    }
};
