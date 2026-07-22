<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Allow a reviewer to attach an annotated document alongside their decision.
 *
 * When a reviewer downloads the submission, marks it up / adds comments, and then
 * approves or rejects, they can upload the annotated file. The stored path is served
 * back to the submitter (subject to the same visibility rules as reviewer comments)
 * so the researcher can view or download the marked-up document.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->string('annotated_document_path')->nullable()->after('comments');
            $table->string('annotated_document_name')->nullable()->after('annotated_document_path');
            $table->timestampTz('annotated_document_uploaded_at')->nullable()->after('annotated_document_name');
        });
    }

    public function down(): void
    {
        Schema::table('submission_reviewers', function (Blueprint $table) {
            $table->dropColumn([
                'annotated_document_path',
                'annotated_document_name',
                'annotated_document_uploaded_at',
            ]);
        });
    }
};
