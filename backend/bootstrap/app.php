<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Trust the upstream reverse proxy / load balancer that terminates TLS
        // (e.g. Azure Application Gateway, an external nginx SSL terminator).
        // This makes Laravel honour X-Forwarded-Proto/Host/Port so it treats
        // requests as HTTPS and generates correct https:// URLs (SSO redirect
        // URIs, e-mail links, secure cookies) even though the container itself
        // receives plain HTTP from the proxy.
        // SECURITY: the VM must only be reachable through the proxy — lock the
        // NSG / firewall so the app port is not exposed to the public directly.
        $middleware->trustProxies(at: '*', headers:
            Request::HEADER_X_FORWARDED_FOR |
            Request::HEADER_X_FORWARDED_HOST |
            Request::HEADER_X_FORWARDED_PORT |
            Request::HEADER_X_FORWARDED_PROTO
        );

        // Custom role middleware alias
        $middleware->alias([
            'auth' => \App\Http\Middleware\Authenticate::class,
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);

        // Append security headers to all API responses
        $middleware->appendToGroup('api', \App\Http\Middleware\SecureHeaders::class);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Check for overdue reviewers once per day at 08:00 server time.
        // NOTE: in Laravel 11 the schedule must be registered here (the legacy
        // App\Console\Kernel::schedule() method is no longer invoked).
        $schedule->command('reviews:check-overdue')->dailyAt('08:00');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Validation failed.',
                    'errors'  => $e->errors(),
                ], 422);
            }
        });
    })->create();
