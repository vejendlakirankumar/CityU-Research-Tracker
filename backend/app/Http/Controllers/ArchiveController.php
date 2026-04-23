<?php

namespace App\Http\Controllers;

use App\Models\ArchiveCatalog;
use App\Models\IntegrationSetting;
use App\Models\OrganizationSetting;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ArchiveController extends Controller
{
    /**
     * GET /api/system/archives
     * Lists the archive catalog.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->get('per_page', 25), 100);
        $archives = ArchiveCatalog::with([
            'submission:id,title,reference_number,status',
            'archivedBy:id,name',
        ])
        ->orderBy('created_at', 'desc')
        ->paginate($perPage);

        return response()->json([
            'data' => $archives->map(fn($a) => $this->toResource($a)),
            'meta' => [
                'current_page' => $archives->currentPage(),
                'last_page'    => $archives->lastPage(),
                'total'        => $archives->total(),
            ],
        ]);
    }

    /**
     * POST /api/system/archives/run
     * Archives submissions older than configured age and not already archived.
     * Stores archive metadata as JSON in configured storage.
     */
    public function run(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = OrganizationSetting::current();
        $ageDays = $org->archive_after_days ?? 365;

        $data = $request->validate([
            'storage_type' => ['sometimes', 'in:local,s3,azure'],
            'reason'       => ['sometimes', 'string', 'max:100'],
        ]);

        $storageType = $data['storage_type'] ?? 'local';
        $reason      = $data['reason'] ?? 'age';

        // Find submissions to archive: ACCEPTED/REJECTED/WITHDRAWN, older than archive_after_days,
        // not already in archive_catalog
        $cutoff = now()->subDays($ageDays);

        $alreadyArchived = ArchiveCatalog::pluck('submission_id')->toArray();

        $submissions = Submission::whereIn('status', ['ACCEPTED', 'REJECTED', 'WITHDRAWN'])
            ->where('created_at', '<', $cutoff)
            ->whereNotIn('id', $alreadyArchived)
            ->with(['submitter:id,name,email', 'submissionType:id,slug,label'])
            ->get();

        if ($submissions->isEmpty()) {
            return response()->json(['message' => 'No submissions eligible for archiving.', 'archived_count' => 0]);
        }

        $archived = 0;
        foreach ($submissions as $sub) {
            // Serialize submission data to JSON
            $archiveData = json_encode([
                'id'              => $sub->id,
                'reference_number'=> $sub->reference_number,
                'title'           => $sub->title,
                'abstract'        => $sub->abstract,
                'status'          => $sub->status,
                'submitter'       => $sub->submitter?->only(['id', 'name', 'email']),
                'submission_type' => $sub->submissionType?->only(['id', 'slug', 'label']),
                'created_at'      => $sub->created_at?->toIso8601String(),
                'archived_at'     => now()->toIso8601String(),
            ], JSON_PRETTY_PRINT);

            $archiveFilename = "archive_{$sub->id}_{$sub->status}_{$sub->created_at->format('Ymd')}.json";
            $sizeByes        = strlen($archiveData);
            $storagePath     = null;

            try {
                $storagePath = $this->storeArchiveData($archiveData, $archiveFilename, $storageType);
            } catch (\Throwable $e) {
                Log::error("Archive store failed for submission {$sub->id}", ['error' => $e->getMessage()]);
            }

            ArchiveCatalog::create([
                'submission_id' => $sub->id,
                'archived_by'   => $user->id,
                'storage_type'  => $storageType,
                'storage_path'  => $storagePath ?? $archiveFilename,
                'size_bytes'    => $sizeByes,
                'archive_reason'=> $reason,
                'created_at'    => now(),
            ]);

            // Mark submission as ARCHIVED
            $sub->update(['status' => 'ARCHIVED']);
            $archived++;
        }

        return response()->json([
            'message'        => "Archived {$archived} submission(s).",
            'archived_count' => $archived,
        ]);
    }

    /**
     * POST /api/system/archives/{id}/restore
     * Marks an archived submission as ACCEPTED (restores its status to pre-archive).
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $catalog = ArchiveCatalog::with('submission')->findOrFail($id);
        $user    = $request->user();

        if (!$catalog->submission) {
            return response()->json(['message' => 'Original submission no longer exists.'], 404);
        }

        $catalog->submission->update(['status' => 'ACCEPTED']);
        $catalog->update([
            'restored_at' => now(),
            'restored_by' => $user->id,
        ]);

        return response()->json(['message' => 'Submission restored from archive.', 'data' => $this->toResource($catalog->fresh(['submission', 'archivedBy']))]);
    }

    /**
     * GET /api/system/archives/settings
     * Returns current archive configuration (age, storage type flags).
     */
    public function getSettings(): JsonResponse
    {
        $org = OrganizationSetting::current();
        return response()->json([
            'archive_after_days'   => $org->archive_after_days ?? 365,
            's3_enabled'           => IntegrationSetting::for('s3_storage')->is_enabled,
            'azure_enabled'        => IntegrationSetting::for('azure_blob')->is_enabled,
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function storeArchiveData(string $data, string $filename, string $storageType): string
    {
        if ($storageType === 'local') {
            $dir = storage_path('app/archives');
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            file_put_contents("{$dir}/{$filename}", $data);
            return "{$dir}/{$filename}";
        }

        if ($storageType === 's3') {
            $cfg = IntegrationSetting::for('s3_storage');
            $key = 'archives/' . $filename;
            $s3  = $this->makeS3Client($cfg->settings);
            $s3->putObject([
                'Bucket' => $cfg->get('bucket'),
                'Key'    => $key,
                'Body'   => $data,
            ]);
            return $key;
        }

        if ($storageType === 'azure') {
            $cfg = IntegrationSetting::for('azure_blob');
            $this->uploadStringToAzure($data, "archives/{$filename}", $cfg->settings);
            return "archives/{$filename}";
        }

        return $filename;
    }

    private function makeS3Client(array $cfg): \Aws\S3\S3Client
    {
        $params = [
            'version'     => 'latest',
            'region'      => $cfg['region'] ?? 'us-east-1',
            'credentials' => ['key' => $cfg['access_key'], 'secret' => $cfg['secret_key']],
        ];
        if (!empty($cfg['endpoint'])) {
            $params['endpoint'] = $cfg['endpoint'];
            $params['use_path_style_endpoint'] = true;
        }
        return new \Aws\S3\S3Client($params);
    }

    private function uploadStringToAzure(string $content, string $blobName, array $cfg): void
    {
        $accountName = $cfg['account_name'] ?? '';
        $accountKey  = $cfg['account_key']  ?? '';
        $container   = $cfg['container']    ?? 'archives';
        $url         = "https://{$accountName}.blob.core.windows.net/{$container}/{$blobName}";
        $len         = strlen($content);
        $date        = gmdate('D, d M Y H:i:s') . ' GMT';
        $strToSign   = "PUT\n\n\n{$len}\n\napplication/json\n\n\n\n\n\n\nx-ms-blob-type:BlockBlob\nx-ms-date:{$date}\nx-ms-version:2021-08-06\n/{$accountName}/{$container}/{$blobName}";
        $sig         = base64_encode(hash_hmac('sha256', $strToSign, base64_decode($accountKey), true));
        $headers     = [
            "Authorization: SharedKey {$accountName}:{$sig}",
            "x-ms-date: {$date}",
            "x-ms-version: 2021-08-06",
            "x-ms-blob-type: BlockBlob",
            "Content-Type: application/json",
            "Content-Length: {$len}",
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_POSTFIELDS => $content, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 400) throw new \RuntimeException("Azure Blob PUT failed: HTTP {$code}");
    }

    private function toResource(ArchiveCatalog $a): array
    {
        return [
            'id'             => $a->id,
            'submission_id'  => $a->submission_id,
            'submission'     => $a->submission ? [
                'id'               => $a->submission->id,
                'title'            => $a->submission->title,
                'reference_number' => $a->submission->reference_number,
                'status'           => $a->submission->status,
            ] : null,
            'storage_type'   => $a->storage_type,
            'storage_path'   => $a->storage_path,
            'size_bytes'     => $a->size_bytes,
            'archive_reason' => $a->archive_reason,
            'archived_by'    => $a->archivedBy ? ['id' => $a->archivedBy->id, 'name' => $a->archivedBy->name] : null,
            'restored_at'    => $a->restored_at?->toIso8601String(),
            'created_at'     => $a->created_at?->toIso8601String(),
        ];
    }
}
