<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('research_templates', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('filename');
            $table->string('path');
            $table->string('mime_type')->nullable();
            $table->bigInteger('size_bytes')->default(0);
            $table->uuid('uploaded_by')->nullable();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('research_template_submission_type', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));

            $table->uuid('research_template_id');
            $table->foreign('research_template_id')
                  ->references('id')->on('research_templates')
                  ->onDelete('cascade');

            $table->uuid('submission_type_id');
            $table->foreign('submission_type_id')
                  ->references('id')->on('submission_types')
                  ->onDelete('cascade');

            $table->timestamp('created_at')->useCurrent();

            $table->unique(['research_template_id', 'submission_type_id'], 'rt_st_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('research_template_submission_type');
        Schema::dropIfExists('research_templates');
    }
};
