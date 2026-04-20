<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Create submission_authors table.
 *
 * A submission can have multiple authors. The person who creates the
 * submission is always added as the corresponding author (is_corresponding = true).
 * Additional co-authors can be added by email:
 *   - If the email matches an existing user → user_id is populated immediately.
 *   - If not → an invite_token is generated and an invitation email is sent.
 *     When the invited person registers, user_id is set and joined_at is recorded.
 *
 * author_order determines the display order (1 = first/corresponding author).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_authors', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id');
            $table->uuid('user_id')->nullable();    // null = pending invite
            $table->string('name', 255);            // stored explicitly (even if user exists)
            $table->string('email', 255);
            $table->string('affiliation', 500)->nullable();
            $table->boolean('is_corresponding')->default(false);
            $table->integer('author_order')->default(1);
            $table->string('invite_token', 64)->nullable()->unique();
            $table->timestampTz('invited_at')->nullable();
            $table->timestampTz('joined_at')->nullable();  // set when invite accepted
            $table->timestampTz('added_at')->default(DB::raw('now()'));

            // One entry per email per submission
            $table->unique(['submission_id', 'email']);

            $table->foreign('submission_id')
                  ->references('id')->on('submissions')
                  ->cascadeOnDelete();

            $table->foreign('user_id')
                  ->references('id')->on('users')
                  ->nullOnDelete();
        });

        DB::statement('CREATE INDEX idx_sub_authors_submission ON submission_authors(submission_id, author_order)');
        DB::statement('CREATE INDEX idx_sub_authors_user ON submission_authors(user_id)');
        DB::statement('CREATE INDEX idx_sub_authors_email ON submission_authors(email)');
        DB::statement('CREATE INDEX idx_sub_authors_token ON submission_authors(invite_token) WHERE invite_token IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_authors');
    }
};
