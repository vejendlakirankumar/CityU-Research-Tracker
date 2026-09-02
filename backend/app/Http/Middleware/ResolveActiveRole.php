<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies the caller's selected role (X-Active-Role header) to the authenticated
 * user so every downstream authorization check — route `role:` middleware,
 * policies, controllers, query scopes — sees only that single role instead of
 * the union of all assigned roles. Runs after auth:sanctum so the user exists.
 */
class ResolveActiveRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user) {
            $user->applyActiveRole($request->header('X-Active-Role'));
        }

        return $next($request);
    }
}
