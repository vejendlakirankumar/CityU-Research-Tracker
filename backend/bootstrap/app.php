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
            'active-role' => \App\Http\Middleware\ResolveActiveRole::class,
        ]);

        // Append security headers to all API responses
        $middleware->appendToGroup('api', \App\Http\Middleware\SecureHeaders::class);
    })
    ->withSchedule(function (Schedule $schedule) {
        // Check for overdue reviewers once per day at 08:00 server time.
        // NOTE: in Laravel 11 the schedule must be registered here (the legacy
        // App\Console\Kernel::schedule() method is no longer invoked).
        $schedule->command('reviews:check-overdue')->dailyAt('08:00');
        // Remind reviewers whose deadline is approaching (default: 2 days out).
        $schedule->command('reviews:check-due-soon')->dailyAt('08:00');
        $schedule->call(fn () => \App\Models\SystemLog::where('created_at', '<', now()->subDays(30))->delete())
            ->daily()->name('prune-system-logs');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->report(function (\Throwable $e) {
            $request = request();
            if ($request->is('api/*')) {
                \App\Services\SystemDiagnostics::record($request, 'error', 'api.exception', [
                    'exception' => $e::class,
                    'source' => basename($e->getFile()),
                    'line' => $e->getLine(),
                ] + \App\Services\SystemDiagnostics::uploadContext($request));
            }
        });

        $exceptions->render(function (\Illuminate\Http\Exceptions\PostTooLargeException $e, $request) {
            if ($request->is('api/*')) {
                \App\Services\SystemDiagnostics::record($request, 'warning', 'upload.request_too_large',
                    \App\Services\SystemDiagnostics::uploadContext($request));
                return response()->json([
                    'message' => 'The upload exceeds the server request-size limit. Upload fewer files at a time, or ask an administrator to check PHP-FPM and proxy upload limits.',
                    'request_id' => \App\Services\SystemDiagnostics::requestId($request),
                ], 413);
            }
        });

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
                $requestId = null;
                if ($request->is('api/submissions/*/reviewers/*')) {
                    \App\Services\SystemDiagnostics::record($request, 'warning', 'reviewer.validation_failed', [
                        'failed_rules' => collect($e->validator->failed())->map(fn ($rules) => array_keys($rules))->all(),
                        'validation_errors' => $e->errors(),
                    ] + \App\Services\SystemDiagnostics::uploadContext($request));
                    $requestId = \App\Services\SystemDiagnostics::requestId($request);
                }
                return response()->json([
                    'message' => 'Validation failed.',
                    'errors'  => $e->errors(),
                    'request_id' => $requestId,
                ], 422);
            }
        });
        $exceptions->render(function (\Throwable $e, $request) {
            if ($request->is('api/*') && $request->attributes->has('diagnostic_request_id')) {
                $status = $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                    ? $e->getStatusCode() : 500;
                if ($status >= 500) {
                    return response()->json([
                        'message' => 'The server could not complete this request. Please contact an administrator with the reference below before retrying.',
                        'request_id' => \App\Services\SystemDiagnostics::requestId($request),
                    ], $status);
                }
            }
        });
    })->create();
