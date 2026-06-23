<?php

$configuredOrigins = array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))));
$isProduction = env('APP_ENV', 'production') === 'production';

$defaultOrigins = $isProduction
    ? [env('APP_URL', 'https://localhost')]
    : [
        env('APP_URL', 'http://localhost:8080'),
        'http://localhost:5173',
        'http://localhost:8080',
    ];

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'sso/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $configuredOrigins ?: $defaultOrigins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 600,

    'supports_credentials' => true,

];
