<?php

namespace App\Http\Controllers;

use App\Models\IntegrationSetting;
use App\Models\Notification;
use App\Models\Submission;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Similarity / Plagiarism Check Controller.
 *
 * - If Turnitin integration is enabled: submits the document to Turnitin's
 *   Submissions API and returns the similarity report score.
 * - Otherwise: runs local Jaccard word-overlap similarity against other
 *   submissions of the same type.
 *
 * POST /api/submissions/{id}/similarity       → run check (returns job info or local results)
 * GET  /api/submissions/{id}/similarity       → get latest result (local only)
 * POST /api/system/turnitin/webhook           → receive Turnitin webhook callbacks
 */
class SimilarityController extends Controller
{
    // ── Run check ─────────────────────────────────────────────────────────────

    /**
     * POST /api/submissions/{id}/similarity
     */
    public function run(Request $request, string $id): JsonResponse
    {
        $submission = Submission::with(['submitter:id,name,email', 'documents'])->findOrFail($id);
        $user       = $request->user();

        $turnitin = IntegrationSetting::for('turnitin');

        if ($turnitin->is_enabled && !empty($turnitin->get('api_key'))) {
            return $this->runTurnitin($submission, $user, $turnitin);
        }

        return $this->runLocal($submission);
    }

    /**
     * GET /api/submissions/{id}/similarity
     * Returns the latest local similarity result for a submission.
     */
    public function result(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);

        // Check for Turnitin result stored in submission metadata
        $turnitin = IntegrationSetting::for('turnitin');
        if ($turnitin->is_enabled) {
            $turnitinScore = $submission->turnitin_score ?? null;
            $turnitinStatus = $submission->turnitin_status ?? null;
            if ($turnitinScore !== null || $turnitinStatus) {
                return response()->json([
                    'source'    => 'turnitin',
                    'status'    => $turnitinStatus ?? 'unknown',
                    'score'     => $turnitinScore,
                    'report_url'=> $submission->turnitin_report_url ?? null,
                ]);
            }
        }

        return $this->runLocal($submission);
    }

    /**
     * POST /api/system/turnitin/webhook
     * Receives Turnitin similarity report webhook callback.
     */
    public function webhook(Request $request): JsonResponse
    {
        $turnitin = IntegrationSetting::for('turnitin');

        // Verify webhook secret — reject the request when no secret is configured,
        // since accepting unsigned webhooks would allow anyone to spoof Turnitin events.
        $secret = $turnitin->get('webhook_secret');
        if (!$secret) {
            Log::warning('Turnitin webhook received but no webhook_secret is configured — rejecting request.');
            return response()->json(['message' => 'Webhook not configured.'], 401);
        }

        $sig      = $request->header('X-Turnitin-Signature');
        $expected = hash_hmac('sha256', $request->getContent(), $secret);
        if (!hash_equals($expected, (string) $sig)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $payload  = $request->json()->all();
        $submId   = $payload['metadata']['submission_id'] ?? null;
        $score    = $payload['overall_match_percentage'] ?? null;
        $reportUrl = $payload['viewer_url'] ?? null;
        $status   = $payload['status'] ?? 'unknown';

        if ($submId) {
            $sub = Submission::find($submId);
            if ($sub) {
                // Store turnitin results in submission (extra columns added via migration)
                \DB::table('submissions')
                    ->where('id', $submId)
                    ->update([
                        'turnitin_score'      => $score,
                        'turnitin_status'     => $status,
                        'turnitin_report_url' => $reportUrl,
                        'turnitin_checked_at' => now(),
                    ]);

                // Notify admins/coordinators
                $admins = User::whereJsonContains('roles', 'admin')
                    ->orWhereJsonContains('roles', 'coordinator')
                    ->get();

                app(NotificationService::class)->notify($admins->all(), Notification::TYPE_SIMILARITY_READY, [
                    'submission_id'    => $submId,
                    'submission_title' => $sub->title,
                    'score'            => $score,
                    'source'           => 'turnitin',
                ]);
            }
        }

        return response()->json(['message' => 'Webhook received.']);
    }

    // ── Private: Turnitin submission ──────────────────────────────────────────

    private function runTurnitin(Submission $submission, User $user, IntegrationSetting $cfg): JsonResponse
    {
        $apiKey = $cfg->get('api_key');
        $apiUrl = rtrim($cfg->get('api_url', 'https://api.turnitin.com'), '/');

        try {
            // Step 1: Create a Turnitin submission
            $response = Http::withHeaders([
                'Authorization' => "Bearer {$apiKey}",
                'Content-Type'  => 'application/json',
                'X-Turnitin-Integration-Name'    => 'RRP',
                'X-Turnitin-Integration-Version' => '2.0',
            ])->post("{$apiUrl}/api/v1/submissions", [
                'owner'                     => $user->id,
                'title'                     => $submission->title,
                'submitter'                 => $user->id,
                'owner_default_permission_set' => 'LEARNER',
                'submitter_default_permission_set' => 'INSTRUCTOR',
                'extract_text_only'         => false,
                'metadata' => [
                    'owners' => [['id' => $user->id, 'given_name' => $user->first_name ?? '', 'family_name' => $user->last_name ?? '', 'email' => $user->email]],
                    'submitter' => ['id' => $user->id, 'given_name' => $user->first_name ?? '', 'family_name' => $user->last_name ?? '', 'email' => $user->email],
                    'submission_id' => $submission->id,   // passed back in webhook
                ],
            ]);

            if (!$response->successful()) {
                Log::error('Turnitin create submission failed', ['status' => $response->status(), 'body' => $response->body()]);
                return response()->json(['message' => 'Turnitin API error: ' . $response->json('message', 'Unknown error')], 502);
            }

            $turnitinId = $response->json('id');

            // Step 2: Upload the text content
            $textContent = strip_tags($submission->title . "\n\n" . ($submission->abstract ?? ''));
            $filename    = "submission_{$submission->id}.txt";

            $uploadResponse = Http::withHeaders([
                'Authorization'  => "Bearer {$apiKey}",
                'Content-Type'   => 'binary/octet-stream',
                'Content-Disposition' => "inline; filename=\"{$filename}\"",
                'X-Turnitin-Integration-Name'    => 'RRP',
                'X-Turnitin-Integration-Version' => '2.0',
            ])->withBody($textContent, 'binary/octet-stream')
              ->put("{$apiUrl}/api/v1/submissions/{$turnitinId}/original");

            if (!$uploadResponse->successful()) {
                Log::error('Turnitin upload failed', ['status' => $uploadResponse->status()]);
                return response()->json(['message' => 'Turnitin upload error.'], 502);
            }

            // Step 3: Request similarity report generation
            Http::withHeaders([
                'Authorization' => "Bearer {$apiKey}",
                'X-Turnitin-Integration-Name'    => 'RRP',
                'X-Turnitin-Integration-Version' => '2.0',
            ])->put("{$apiUrl}/api/v1/submissions/{$turnitinId}/similarity", [
                'generation_settings' => [
                    'search_repositories'     => ['SUBMITTED_WORK', 'INTERNET', 'PUBLICATION'],
                    'submission_auto_excludes' => true,
                    'auto_exclude_self_matching_scope' => 'ALL',
                    'priority'                => 'HIGH',
                ],
            ]);

            // Mark submission as processing
            \DB::table('submissions')
                ->where('id', $submission->id)
                ->update(['turnitin_status' => 'processing', 'turnitin_checked_at' => now()]);

            return response()->json([
                'source'        => 'turnitin',
                'status'        => 'processing',
                'turnitin_id'   => $turnitinId,
                'message'       => 'Similarity check submitted to Turnitin. Results will be available via webhook.',
            ]);

        } catch (\Throwable $e) {
            Log::error('Turnitin error', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Turnitin request failed: ' . $e->getMessage()], 500);
        }
    }

    // ── Private: Local Jaccard similarity ────────────────────────────────────

    private function runLocal(Submission $submission): JsonResponse
    {
        $targetText  = strtolower(strip_tags($submission->title . ' ' . ($submission->abstract ?? '')));
        $targetWords = array_filter(array_unique(preg_split('/\W+/', $targetText)), fn($w) => strlen($w) > 3);
        $targetSet   = array_flip($targetWords);

        if (count($targetWords) < 5) {
            return response()->json([
                'source'  => 'local',
                'data'    => [],
                'message' => 'Insufficient text for similarity check.',
            ]);
        }

        $candidates = Submission::where('id', '!=', $submission->id)
            ->whereNotNull('submission_type_id')
            ->where('submission_type_id', $submission->submission_type_id)
            ->whereNotIn('status', ['DRAFT', 'WITHDRAWN', 'ARCHIVED'])
            ->with('submitter:id,name')
            ->limit(300)
            ->get();

        $results = [];
        foreach ($candidates as $c) {
            $cText  = strtolower(strip_tags($c->title . ' ' . ($c->abstract ?? '')));
            $cWords = array_filter(array_unique(preg_split('/\W+/', $cText)), fn($w) => strlen($w) > 3);
            $cSet   = array_flip($cWords);

            $intersect = count(array_intersect_key($targetSet, $cSet));
            $union     = count(array_unique(array_merge(array_keys($targetSet), array_keys($cSet))));
            $score     = $union > 0 ? round(($intersect / $union) * 100, 1) : 0;

            if ($score >= 20) {
                $results[] = [
                    'submission_id'    => $c->id,
                    'reference_number' => $c->reference_number,
                    'title'            => $c->title,
                    'submitter_name'   => $c->submitter?->name,
                    'status'           => $c->status,
                    'score'            => $score,
                    'created_at'       => $c->created_at?->toDateString(),
                ];
            }
        }

        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);
        $results = array_slice($results, 0, 10);

        return response()->json([
            'source'          => 'local',
            'data'            => $results,
            'total_compared'  => $candidates->count(),
        ]);
    }
}
