<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as mail and payment providers. This file provides the de facto location
    | for this type of information, allowing packages to have a conventional
    | file to locate the various service credentials.
    |
    */

    'ses' => [
        'key'    => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Microsoft Graph (outbound mail)
    |--------------------------------------------------------------------------
    |
    | Used by the custom "graph" mail transport (App\Mail\GraphTransport) to
    | send email through Microsoft 365 via the Graph API using the OAuth2
    | client-credentials flow. The app registration needs the application
    | permission Mail.Send (admin-consented). from_address must be a licensed
    | mailbox the app is allowed to send as.
    |
    | NOTE: values are read here (config time) so they survive `config:cache`.
    | Do NOT read GRAPH_* via env() at runtime — it returns null once config
    | is cached.
    |
    */
    'graph' => [
        'tenant_id'     => env('GRAPH_TENANT_ID'),
        'client_id'     => env('GRAPH_CLIENT_ID'),
        'client_secret' => env('GRAPH_CLIENT_SECRET'),
        'from_address'  => env('GRAPH_FROM_ADDRESS'),
    ],

];
