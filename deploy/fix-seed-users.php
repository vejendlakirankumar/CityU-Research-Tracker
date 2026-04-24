<?php
/**
 * deploy/fix-seed-users.php
 *
 * One-time script to update seed user emails and passwords to match
 * the documented defaults (user@cityu.edu / admin12345).
 *
 * Usage (run inside the app container):
 *   docker exec -w /var/www/html rrp_app php deploy/fix-seed-users.php
 */

$base = '/var/www/html';
require $base . '/vendor/autoload.php';

$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$updates = [
    ['old' => 'admin@rrp.local',        'new' => 'admin@cityu.edu',        'pass' => 'admin12345'],
    ['old' => 'coordinator1@rrp.local',  'new' => 'coordinator@cityu.edu',  'pass' => 'admin12345'],
    ['old' => 'coordinator2@rrp.local',  'new' => 'coordinator2@cityu.edu', 'pass' => 'admin12345'],
    ['old' => 'reviewer1@rrp.local',     'new' => 'reviewer@cityu.edu',     'pass' => 'admin12345'],
    ['old' => 'reviewer2@rrp.local',     'new' => 'reviewer2@cityu.edu',    'pass' => 'admin12345'],
    ['old' => 'reviewer3@rrp.local',     'new' => 'reviewer3@cityu.edu',    'pass' => 'admin12345'],
    ['old' => 'student1@rrp.local',      'new' => 'student@cityu.edu',      'pass' => 'admin12345'],
    ['old' => 'student2@rrp.local',      'new' => 'student2@cityu.edu',     'pass' => 'admin12345'],
    ['old' => 'student3@rrp.local',      'new' => 'student3@cityu.edu',     'pass' => 'admin12345'],
];

foreach ($updates as $u) {
    $affected = DB::table('users')
        ->where('email', $u['old'])
        ->update([
            'email'         => $u['new'],
            'password_hash' => Hash::make($u['pass']),
            'updated_at'    => now(),
        ]);
    echo ($affected ? "Updated : {$u['old']} -> {$u['new']}\n" : "Not found: {$u['old']} (skipped)\n");
}

echo "\nDone. Clearing config/route cache...\n";
passthru('php artisan config:clear 2>&1');
echo "Complete.\n";
