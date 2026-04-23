<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── Notifications ─────────────────────────────────────────────────────
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('user_id');
            $table->string('type', 100);
            $table->jsonb('data')->default('{}');
            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('emailed_at')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        DB::statement('CREATE INDEX idx_notifications_user ON notifications(user_id, read_at)');
        DB::statement('CREATE INDEX idx_notifications_created ON notifications(created_at DESC)');

        Schema::create('notification_preferences', function (Blueprint $table) {
            $table->uuid('user_id')->primary();
            $table->jsonb('preferences')->default('{}');
            $table->timestampTz('updated_at')->default(DB::raw('now()'));

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        // ── Audit logs (immutable) ────────────────────────────────────────────
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('submission_id')->nullable();
            $table->uuid('actor_id')->nullable();
            $table->string('action', 100);
            $table->jsonb('before_state')->nullable();
            $table->jsonb('after_state')->nullable();
            $table->jsonb('data')->default('{}');
            $table->string('ip_address', 45)->nullable();   // inet as varchar (IPv4/IPv6)
            $table->string('user_agent', 500)->nullable();
            $table->string('request_id', 100)->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('submission_id')->references('id')->on('submissions')->nullOnDelete();
            $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();
        });

        DB::statement('CREATE INDEX idx_audit_submission ON audit_logs(submission_id, created_at DESC)');
        DB::statement('CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC)');
        DB::statement('CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC)');
        DB::statement('CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING');
        DB::statement('CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING');

        // ── Password history ──────────────────────────────────────────────────
        Schema::create('password_history', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('user_id');
            $table->string('password_hash', 255);
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        DB::statement('CREATE INDEX idx_password_history_user ON password_history(user_id, created_at DESC)');

        // ── Webhooks ──────────────────────────────────────────────────────────
        Schema::create('webhook_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('url', 2000);
            $table->jsonb('events');
            $table->string('secret_enc', 1000)->nullable();
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });

        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('webhook_subscription_id');
            $table->string('event_type', 100);
            $table->jsonb('payload');
            $table->integer('attempt')->default(1);
            $table->string('status', 20)->default('PENDING');
            // PENDING | DELIVERED | FAILED | RETRYING
            $table->integer('response_code')->nullable();
            $table->text('response_body')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->timestampTz('delivered_at')->nullable();

            $table->foreign('webhook_subscription_id')
                  ->references('id')->on('webhook_subscriptions')->cascadeOnDelete();
        });

        DB::statement('CREATE INDEX idx_webhook_deliveries_sub ON webhook_deliveries(webhook_subscription_id, created_at DESC)');
        DB::statement("CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('PENDING','RETRYING')");

        // ── Config overrides ──────────────────────────────────────────────────
        Schema::create('config_overrides', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('scope', 20);
            // 'submission_type' | 'stage'
            $table->uuid('scope_id');
            $table->string('config_key', 100);
            $table->jsonb('config_value');
            $table->uuid('updated_by')->nullable();
            $table->timestampTz('updated_at')->default(DB::raw('now()'));

            $table->unique(['scope', 'scope_id', 'config_key']);
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        DB::statement('CREATE INDEX idx_config_overrides_scope ON config_overrides(scope, scope_id)');
    }

    public function down(): void
    {
        Schema::dropIfExists('config_overrides');
        Schema::dropIfExists('webhook_deliveries');
        Schema::dropIfExists('webhook_subscriptions');
        Schema::dropIfExists('password_history');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notifications');
    }
};
