<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairSubmissionCurrentStage extends Command
{
    protected $signature = 'submissions:repair-current-stage
                            {--dry-run : Show affected rows without applying updates}';

    protected $description = 'Repairs submissions.current_stage_id to match the first pending reviewer stage';

    public function handle(): int
    {
        $activeStatuses = ['IN_REVIEW', 'AWAITING_REVIEWERS'];

        $setSql = <<<'SQL'
WITH first_pending AS (
  SELECT
    sr.submission_id,
    (ARRAY_AGG(sr.stage_id ORDER BY sd."order"))[1] AS stage_id
  FROM submission_reviewers sr
  JOIN stage_definitions sd ON sd.id = sr.stage_id
  JOIN submissions s ON s.id = sr.submission_id
  WHERE sr.status <> 'declined'
    AND sr.decision IS NULL
    AND s.status IN ('IN_REVIEW', 'AWAITING_REVIEWERS')
  GROUP BY sr.submission_id
)
UPDATE submissions s
SET
  current_stage_id = fp.stage_id,
  current_stage_entered_at = CASE
    WHEN s.current_stage_id IS DISTINCT FROM fp.stage_id THEN now()
    ELSE s.current_stage_entered_at
  END
FROM first_pending fp
WHERE s.id = fp.submission_id
SQL;

        $firstPendingCount = (int) DB::selectOne(<<<'SQL'
WITH first_pending AS (
  SELECT sr.submission_id
  FROM submission_reviewers sr
  JOIN stage_definitions sd ON sd.id = sr.stage_id
  JOIN submissions s ON s.id = sr.submission_id
  WHERE sr.status <> 'declined'
    AND sr.decision IS NULL
    AND s.status IN ('IN_REVIEW', 'AWAITING_REVIEWERS')
  GROUP BY sr.submission_id
)
SELECT COUNT(*) AS count FROM first_pending
SQL)->count;

        $clearCount = DB::table('submissions')
            ->whereIn('status', $activeStatuses)
            ->whereNotExists(function ($q) {
                $q->selectRaw('1')
                    ->from('submission_reviewers as sr')
                    ->whereColumn('sr.submission_id', 'submissions.id')
                    ->where('sr.status', '<>', 'declined')
                    ->whereNull('sr.decision');
            })
            ->count();

        if ($this->option('dry-run')) {
            $this->info('Dry run only; no changes applied.');
            $this->line("Would set current stage on {$firstPendingCount} submissions.");
            $this->line("Would clear current stage on {$clearCount} submissions.");
            return self::SUCCESS;
        }

        DB::beginTransaction();

        try {
            $setUpdated = DB::affectingStatement($setSql);

            $clearUpdated = DB::table('submissions')
                ->whereIn('status', $activeStatuses)
                ->whereNotExists(function ($q) {
                    $q->selectRaw('1')
                        ->from('submission_reviewers as sr')
                        ->whereColumn('sr.submission_id', 'submissions.id')
                        ->where('sr.status', '<>', 'declined')
                        ->whereNull('sr.decision');
                })
                ->update([
                    'current_stage_id' => null,
                    'current_stage_entered_at' => null,
                ]);

            DB::commit();

            $this->info('Current stage repair completed.');
            $this->line("Set current stage on {$setUpdated} submissions.");
            $this->line("Cleared current stage on {$clearUpdated} submissions.");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Current stage repair failed: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
