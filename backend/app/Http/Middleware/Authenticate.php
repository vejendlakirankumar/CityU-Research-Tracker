<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;

class Authenticate extends Middleware
{
    /**
     * For API requests, never redirect to a login route.
     * Returning null makes Laravel throw AuthenticationException -> 401.
     */
    protected function redirectTo($request): ?string
    {
        if ($request->is('api/*')) {
            return null;
        }

        return route('login');
    }
}
