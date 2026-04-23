<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_type_groups', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));

            $table->uuid('submission_type_id');
            $table->foreign('submission_type_id')
                  ->references('id')->on('submission_types')
                  ->onDelete('cascade');

            $table->uuid('group_id');
            $table->foreign('group_id')
                  ->references('id')->on('groups')
                  ->onDelete('cascade');

            $table->timestamp('created_at')->useCurrent();

            $table->unique(['submission_type_id', 'group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_type_groups');
    }
};
