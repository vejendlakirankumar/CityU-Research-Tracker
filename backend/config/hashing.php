<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Hash Driver
    |--------------------------------------------------------------------------
    | Argon2id is the current strongest password hashing algorithm (winner of
    | the Password Hashing Competition). It provides resistance against both
    | GPU-based brute-force and side-channel attacks.
    |
    | Supported: "bcrypt", "argon", "argon2id"
    */

    'driver' => env('HASH_DRIVER', 'argon2id'),

    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => true,
    ],

    'argon' => [
        'memory'    => 65536,
        'threads'   => 1,
        'time'      => 4,
        'verify'    => false,   // argon2id driver reads THIS section; false allows legacy bcrypt passwords
    ],

    'argon2id' => [
        'memory'    => 65536,   // 64 MB — strong protection against GPU attacks
        'threads'   => 1,
        'time'      => 4,       // 4 iterations
        'verify'    => false,   // Allow checking legacy bcrypt hashes during migration
    ],

];
