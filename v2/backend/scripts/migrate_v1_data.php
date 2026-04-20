#!/usr/bin/env php
<?php
/**
 * v1 → v2 Data Migration Script
 *
 * Reads the v1 JSON data files and inserts records into the v2 PostgreSQL database.
 * Run from the v2 backend directory:
 *
 *   php scripts/migrate_v1_data.php [--dry-run] [--v1-data=/path/to/v1/data]
 *
 * Options:
 *   --dry-run          Print what would be imported without writing to DB
 *   --v1-data=PATH     Path to the v1 data/ directory (default: ../../../data)
 *   --skip-users       Skip user migration
 *   --skip-submissions Skip submission migration
 *   --skip-files       Skip file copy
 */

// ── Bootstrap ─────────────────────────────────────────────────────────────────

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Submission;
use App\Models\SubmissionType;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

// ── CLI args ──────────────────────────────────────────────────────────────────

$opts = getopt('', ['dry-run', 'v1-data:', 'skip-users', 'skip-submissions', 'skip-files']);
$DRY_RUN = isset($opts['dry-run']);
$V1_DATA = $opts['v1-data'] ?? realpath(__DIR__ . '/../../../../') . '/data';
$SKIP_USERS = isset($opts['skip-users']);
$SKIP_SUBMISSIONS = isset($opts['skip-submissions']);
$SKIP_FILES = isset($opts['skip-files']);

$V2_UPLOADS = storage_path('app/uploads');

function log_line(string $msg, string $level = 'INFO'): void {
    echo sprintf("[%s] %s %s\n", date('H:i:s'), $level, $msg);
}

function abort(string $msg): never {
    log_line($msg, 'ERROR');
    exit(1);
}

if (!is_dir($V1_DATA)) {
    abort("v1 data directory not found: $V1_DATA");
}

log_line("v1 data path : $V1_DATA");
log_line("v2 uploads   : $V2_UPLOADS");
log_line("Dry run      : " . ($DRY_RUN ? 'YES' : 'NO'));
log_line("---");

// ── Status mapping ────────────────────────────────────────────────────────────

const STATUS_MAP = [
    'draft'             => 'DRAFT',
    'submitted'         => 'SUBMITTED',
    'under_review'      => 'IN_REVIEW',
    'revision_required' => 'REVISION_REQUIRED',
    'approved'          => 'ACCEPTED',
    'conditionally_approved' => 'CONDITIONALLY_ACCEPTED',
    'rejected'          => 'REJECTED',
    'withdrawn'         => 'WITHDRAWN',
];

// ── Load v1 JSON data ─────────────────────────────────────────────────────────

$submissionsFile = "$V1_DATA/submissions.json";
$reviewersFile   = "$V1_DATA/reviewers.json";
$configFile      = "$V1_DATA/config.json";

$v1Submissions = file_exists($submissionsFile) ? json_decode(file_get_contents($submissionsFile), true) : [];
$v1Reviewers   = file_exists($reviewersFile)   ? json_decode(file_get_contents($reviewersFile),   true) : [];
$v1Config      = file_exists($configFile)      ? json_decode(file_get_contents($configFile),      true) : [];

log_line("v1 submissions : " . count($v1Submissions));
log_line("v1 reviewers   : " . count($v1Reviewers));

// ── Migrate users (reviewers) ─────────────────────────────────────────────────

$reviewerIdMap = []; // v1 reviewer id/email → v2 user id

if (!$SKIP_USERS) {
    log_line("--- Migrating reviewers as users ---");
    foreach ($v1Reviewers as $r) {
        $email = strtolower(trim($r['email'] ?? ''));
        $name  = trim($r['name'] ?? $email);

        if (!$email) {
            log_line("Skipping reviewer with no email", 'WARN');
            continue;
        }

        $existing = User::where('email', $email)->first();
        if ($existing) {
            log_line("  User $email already exists (id={$existing->id}), skipping create");
            $reviewerIdMap[$email] = $existing->id;
            continue;
        }

        $parts     = explode(' ', $name, 2);
        $firstName = $parts[0];
        $lastName  = $parts[1] ?? '';
        $tempPass  = Str::random(16);

        if (!$DRY_RUN) {
            $user = User::create([
                'id'         => Str::uuid(),
                'name'       => $name,
                'first_name' => $firstName,
                'last_name'  => $lastName,
                'email'      => $email,
                'password'   => Hash::make($tempPass),
                'is_active'  => true,
            ]);
            $user->syncRoles(['reviewer']);
            $reviewerIdMap[$email] = $user->id;
            log_line("  Created user $email (temp password printed below)");
            log_line("    TEMP PASSWORD for $email : $tempPass", 'CRED');
        } else {
            log_line("  [DRY] Would create user $email");
        }
    }
    log_line("Reviewer migration done. " . count($reviewerIdMap) . " mapped.");
}

// ── Migrate submissions ───────────────────────────────────────────────────────

$imported = 0;
$skipped  = 0;
$errors   = 0;

if (!$SKIP_SUBMISSIONS) {
    log_line("--- Migrating submissions ---");

    // Ensure at least one submission type exists
    $defaultType = SubmissionType::where('is_active', true)->first();
    if (!$defaultType) {
        abort("No active SubmissionType found. Run seeders first: php artisan db:seed");
    }

    foreach ($v1Submissions as $s) {
        $v1Id     = $s['id'] ?? null;
        $title    = $s['title'] ?? 'Untitled Submission';
        $v1Status = strtolower($s['status'] ?? 'draft');
        $v2Status = STATUS_MAP[$v1Status] ?? 'DRAFT';
        $email    = strtolower(trim($s['submitter_email'] ?? $s['email'] ?? ''));
        $created  = $s['created_at'] ?? $s['date'] ?? now()->toDateTimeString();

        // Find or create submitter
        $submitter = $email ? User::where('email', $email)->first() : null;
        if (!$submitter && $email) {
            if (!$DRY_RUN) {
                $parts    = explode(' ', ($s['submitter_name'] ?? $email), 2);
                $tempPass = Str::random(16);
                $submitter = User::create([
                    'id'         => Str::uuid(),
                    'name'       => $s['submitter_name'] ?? $email,
                    'first_name' => $parts[0],
                    'last_name'  => $parts[1] ?? '',
                    'email'      => $email,
                    'password'   => Hash::make($tempPass),
                    'is_active'  => true,
                ]);
                $submitter->syncRoles(['student']);
                log_line("  Auto-created submitter $email | TEMP: $tempPass", 'CRED');
            }
        }

        // Match submission type by label
        $typeLabel    = $s['type'] ?? $s['submission_type'] ?? null;
        $submType     = $typeLabel
            ? SubmissionType::where('label', 'ilike', "%$typeLabel%")->first() ?? $defaultType
            : $defaultType;

        // Check for duplicates by v1 legacy_id
        if (!$DRY_RUN) {
            $dup = DB::table('submissions')
                ->where('legacy_id', $v1Id)
                ->exists();
            if ($dup) {
                log_line("  Skipping duplicate legacy_id=$v1Id");
                $skipped++;
                continue;
            }
        }

        try {
            if (!$DRY_RUN) {
                $sub = DB::table('submissions')->insertGetId([
                    'id'                  => Str::uuid(),
                    'legacy_id'           => $v1Id,
                    'title'               => $title,
                    'submitter_id'        => $submitter?->id,
                    'submission_type_id'  => $submType->id,
                    'status'              => $v2Status,
                    'abstract'            => $s['abstract'] ?? $s['description'] ?? null,
                    'created_at'          => $created,
                    'updated_at'          => $s['updated_at'] ?? $created,
                ]);
                $imported++;
                log_line("  Imported: $title [$v2Status]");
            } else {
                log_line("  [DRY] Would import: $title [$v1Status → $v2Status]");
                $imported++;
            }
        } catch (\Throwable $e) {
            log_line("  ERROR importing $title: " . $e->getMessage(), 'ERROR');
            $errors++;
        }
    }
    log_line("Submissions done: imported=$imported skipped=$skipped errors=$errors");
}

// ── Copy uploaded files ───────────────────────────────────────────────────────

if (!$SKIP_FILES) {
    $uploadsDir = "$V1_DATA/uploads";
    if (is_dir($uploadsDir)) {
        log_line("--- Copying upload files ---");
        $dirs = array_filter(glob("$uploadsDir/*"), 'is_dir');
        $copied = 0;
        foreach ($dirs as $subDir) {
            $refCode = basename($subDir);
            // Find v2 submission by legacy_id or title matching the folder name
            $sub = DB::table('submissions')
                ->where('legacy_id', $refCode)
                ->orWhere('title', 'ilike', "%$refCode%")
                ->first();

            $destDir = $sub ? "$V2_UPLOADS/{$sub->id}/v1" : "$V2_UPLOADS/v1-legacy/$refCode";

            if (!$DRY_RUN) {
                if (!is_dir($destDir)) {
                    mkdir($destDir, 0755, true);
                }
                foreach (glob("$subDir/*") as $file) {
                    $dest = "$destDir/" . basename($file);
                    copy($file, $dest);
                    log_line("  Copied " . basename($file) . " → $dest");
                    $copied++;
                }
            } else {
                log_line("  [DRY] Would copy $subDir → $destDir");
                $copied++;
            }
        }
        log_line("File copy done: $copied files.");
    } else {
        log_line("No uploads directory at $uploadsDir, skipping file copy.", 'WARN');
    }
}

log_line("=== Migration complete ===");
