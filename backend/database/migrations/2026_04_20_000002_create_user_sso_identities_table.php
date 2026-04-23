<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sso_identities', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('provider_id')->constrained('sso_providers')->cascadeOnDelete();
            $table->string('provider_sub');         // The IdP's subject identifier
            $table->string('provider_email')->nullable(); // Email from IdP at link time
            $table->timestampTz('linked_at')->useCurrent();

            $table->unique(['provider_id', 'provider_sub']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sso_identities');
    }
};
