<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecureHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-XSS-Protection', '0');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        $response->headers->set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-origin');
        $response->headers->set('Origin-Agent-Cluster', '?1');
        // style-src keeps 'unsafe-inline' because the SPA (React inline styles + Tailwind
        // runtime styles) requires it — inline style *attributes* cannot use nonces/hashes.
        // Everything else is locked to 'self'. form-action, frame-src and
        // upgrade-insecure-requests harden against form hijacking, framing and mixed content.
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            . "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
            . "form-action 'self'; frame-src 'none'; frame-ancestors 'none'; "
            . "object-src 'none'; base-uri 'self'; upgrade-insecure-requests"
        );
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
