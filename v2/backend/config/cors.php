<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'sso/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('APP_URL', 'http://localhost:8080'),
        'http://localhost:5173',   // Vite dev server
        'http://localhost:8080',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
