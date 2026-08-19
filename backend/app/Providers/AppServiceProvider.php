<?php

namespace App\Providers;

use App\Models\Group;
use App\Models\Program;
use App\Models\Submission;
use App\Models\User;
use App\Policies\GroupPolicy;
use App\Policies\ProgramPolicy;
use App\Policies\SubmissionPolicy;
use App\Policies\UserPolicy;
use App\Mail\GraphTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Policy registrations
        Gate::policy(User::class,       UserPolicy::class);
        Gate::policy(Group::class,      GroupPolicy::class);
        Gate::policy(Submission::class, SubmissionPolicy::class);
        Gate::policy(Program::class,    ProgramPolicy::class);

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            return config('app.frontend_url')."/password-reset/$token?email={$notifiable->getEmailForPasswordReset()}";
        });

        // Microsoft Graph outbound mail driver ("graph"). Credentials come from
        // config/services.php (not raw env(), so they survive config:cache).
        Mail::extend('graph', function (array $config) {
            return new GraphTransport(
                (string) config('services.graph.tenant_id'),
                (string) config('services.graph.client_id'),
                (string) config('services.graph.client_secret'),
                config('services.graph.from_address'),
            );
        });
    }
}
