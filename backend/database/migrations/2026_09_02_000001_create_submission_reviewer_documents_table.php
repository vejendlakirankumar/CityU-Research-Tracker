<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reviewer-uploaded feedback documents. Replaces the single-file
     * annotated_document_* columns on submission_reviewers with a one-to-many
     * list so a reviewer can send several files back to the chair (annotations,
     * handbook copy, examples, etc.). The legacy single columns are retained for
     * existing rows and surfaced alongside these in the API payload.
     */
    public function up(): void
    {
        Schema::create('submission_reviewer_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_reviewer_id');
            $table->string('path');
            $table->string('name');
            $table->unsignedBigInteger('size')->nullable();
            $table->timestampTz('uploaded_at')->nullable();
            $table->timestampsTz();

            $table->foreign('submission_reviewer_id')
                  ->references('id')->on('submission_reviewers')
                  ->cascadeOnDelete();
            $table->index('submission_reviewer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_reviewer_documents');
    }
};
