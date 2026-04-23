<?php

namespace App\Http\Controllers;

use App\Models\BackupCatalog;
use App\Models\IntegrationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    // ── List catalog ──────────────────────────────────────────────────────────

    /**
     * GET /api/system/backups
     */
    public function index(): JsonResponse
    {
        $backups = BackupCatalog::with('createdBy:id,name')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn($b) => $this->toResource($b));

        return response()->json(['data' => $backups]);
    }

    // ── Run backup ────────────────────────────────────────────────────────────

    /**
     * POST /api/system/backups
     * Performs a pg_dump, saves locally and optionally uploads to S3/Azure.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Build dump filename
        $ts       = now()->format('Y-m-d_H-i-s');
        $filename = "rrp_backup_{$ts}.sql.gz";
        $localDir = storage_path('app/backups');
        $localPath = "{$localDir}/{$filename}";

        if (!is_dir($localDir)) {
            mkdir($localDir, 0755, true);
        }

        // Run pg_dump (connects to the postgres container from within rrp_app)
        $host  = env('DB_HOST', 'postgres');
        $dbname = env('DB_DATABASE', 'rrp');
        $dbuser = env('DB_USERNAME', 'rrp_app');
        $dbpass = env('DB_PASSWORD', '');

        $cmd = "PGPASSWORD=" . escapeshellarg($dbpass)
             . " pg_dump -h " . escapeshellarg($host)
             . " -U " . escapeshellarg($dbuser)
             . " " . escapeshellarg($dbname)
             . " | gzip > " . escapeshellarg($localPath)
             . " 2>&1";

        $output = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0 || !file_exists($localPath)) {
            $err = implode("\n", $output);
            Log::error('Backup pg_dump failed', ['exit' => $exitCode, 'output' => $err]);
            return response()->json(['message' => 'Backup failed. Check server logs for details.'], 500);
        }

        $sizeBytes = filesize($localPath);
        $checksum  = hash_file('sha256', $localPath);

        // Create catalog entry (local first)
        $catalog = BackupCatalog::create([
            'filename'        => $filename,
            'storage_type'    => 'local',
            'storage_path'    => $localPath,
            'size_bytes'      => $sizeBytes,
            'checksum_sha256' => $checksum,
            'status'          => 'completed',
            'created_by'      => $user->id,
            'created_at'      => now(),
        ]);

        // ── Try S3 upload ─────────────────────────────────────────────────────
        $s3Cfg = IntegrationSetting::for('s3_backup');
        if ($s3Cfg->is_enabled && $s3Cfg->get('bucket')) {
            try {
                $s3Key = ($s3Cfg->get('prefix', 'backups/')) . $filename;
                $this->uploadToS3($localPath, $s3Key, $s3Cfg->settings);
                $catalog->update(['storage_type' => 's3', 'storage_path' => $s3Key]);
            } catch (\Throwable $e) {
                Log::error('Backup S3 upload failed', ['error' => $e->getMessage()]);
                // Keep local copy; don't fail the whole request
            }
        }

        // ── Try Azure upload ──────────────────────────────────────────────────
        $azCfg = IntegrationSetting::for('azure_backup');
        if ($azCfg->is_enabled && $azCfg->get('container')) {
            try {
                $this->uploadToAzureBlob($localPath, $filename, $azCfg->settings);
                $catalog->update(['storage_type' => 'azure', 'storage_path' => $filename]);
            } catch (\Throwable $e) {
                Log::error('Backup Azure upload failed', ['error' => $e->getMessage()]);
            }
        }

        return response()->json(['data' => $this->toResource($catalog->fresh('createdBy'))], 201);
    }

    // ── Download ──────────────────────────────────────────────────────────────

    /**
     * GET /api/system/backups/{id}/download
     */
    public function download(string $id): StreamedResponse|JsonResponse
    {
        $catalog = BackupCatalog::findOrFail($id);

        if ($catalog->storage_type === 'local') {
            if (!file_exists($catalog->storage_path)) {
                return response()->json(['message' => 'Backup file not found on disk.'], 404);
            }
            return response()->streamDownload(function () use ($catalog) {
                $fp = fopen($catalog->storage_path, 'rb');
                while (!feof($fp)) {
                    echo fread($fp, 65536);
                    flush();
                }
                fclose($fp);
            }, $catalog->filename, [
                'Content-Type'        => 'application/gzip',
                'Content-Disposition' => 'attachment; filename="' . $catalog->filename . '"',
            ]);
        }

        if ($catalog->storage_type === 's3') {
            // Generate presigned URL
            $s3Cfg = IntegrationSetting::for('s3_backup');
            try {
                $url = $this->s3PresignUrl($catalog->storage_path, $s3Cfg->settings);
                return response()->json(['download_url' => $url]);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Could not generate S3 download URL.'], 500);
            }
        }

        if ($catalog->storage_type === 'azure') {
            $azCfg = IntegrationSetting::for('azure_backup');
            try {
                $url = $this->azureSasUrl($catalog->storage_path, $azCfg->settings);
                return response()->json(['download_url' => $url]);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Could not generate Azure SAS URL.'], 500);
            }
        }

        return response()->json(['message' => 'Unknown storage type.'], 400);
    }

    // ── Restore ───────────────────────────────────────────────────────────────

    /**
     * POST /api/system/backups/{id}/restore
     * Restores the database from the selected backup file.
     * ⚠ This will DROP and recreate all tables. Use with extreme caution.
     */
    public function restore(Request $request, string $id): JsonResponse
    {
        $catalog = BackupCatalog::findOrFail($id);
        $user    = $request->user();

        $localPath = $catalog->storage_path;

        // If stored remotely, download to a temp file first
        if ($catalog->storage_type === 's3') {
            $tmp       = tempnam(sys_get_temp_dir(), 'rrp_restore_') . '.sql.gz';
            $s3Cfg     = IntegrationSetting::for('s3_backup');
            $this->downloadFromS3($catalog->storage_path, $tmp, $s3Cfg->settings);
            $localPath = $tmp;
        } elseif ($catalog->storage_type === 'azure') {
            $tmp       = tempnam(sys_get_temp_dir(), 'rrp_restore_') . '.sql.gz';
            $azCfg     = IntegrationSetting::for('azure_backup');
            $this->downloadFromAzureBlob($catalog->storage_path, $tmp, $azCfg->settings);
            $localPath = $tmp;
        }

        if (!file_exists($localPath)) {
            return response()->json(['message' => 'Backup file not accessible.'], 404);
        }

        // Verify checksum
        if ($catalog->checksum_sha256 && hash_file('sha256', $localPath) !== $catalog->checksum_sha256) {
            return response()->json(['message' => 'Backup file checksum mismatch — file may be corrupted.'], 422);
        }

        $host   = env('DB_HOST', 'postgres');
        $dbname = env('DB_DATABASE', 'rrp');
        $dbuser = env('DB_USERNAME', 'rrp_app');
        $dbpass = env('DB_PASSWORD', '');

        $cmd = "zcat " . escapeshellarg($localPath)
             . " | PGPASSWORD=" . escapeshellarg($dbpass)
             . " psql -h " . escapeshellarg($host)
             . " -U " . escapeshellarg($dbuser)
             . " " . escapeshellarg($dbname)
             . " 2>&1";

        $output   = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        // Clean up temp file
        if (isset($tmp) && file_exists($tmp)) {
            unlink($tmp);
        }

        if ($exitCode !== 0) {
            $err = implode("\n", $output);
            Log::error('Backup restore failed', ['exit' => $exitCode, 'output' => $err]);
            return response()->json(['message' => 'Restore failed. Check server logs for details.'], 500);
        }

        $catalog->update([
            'restored_at' => now(),
            'restored_by' => $user->id,
        ]);

        return response()->json(['message' => 'Database restored successfully from backup: ' . $catalog->filename]);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * DELETE /api/system/backups/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $catalog = BackupCatalog::findOrFail($id);

        // Delete local file if it exists
        if ($catalog->storage_type === 'local' && file_exists($catalog->storage_path)) {
            unlink($catalog->storage_path);
        }

        $catalog->delete();
        return response()->json(null, 204);
    }

    // ── Integration settings ──────────────────────────────────────────────────

    /**
     * GET /api/system/integrations/{key}
     */
    public function getIntegration(string $key): JsonResponse
    {
        $setting = IntegrationSetting::for($key);
        return response()->json($this->sanitizeSettings($key, $setting));
    }

    /**
     * PATCH /api/system/integrations/{key}
     */
    public function updateIntegration(Request $request, string $key): JsonResponse
    {
        $allowed = ['turnitin', 's3_storage', 'azure_blob', 's3_backup', 'azure_backup'];
        if (!in_array($key, $allowed)) {
            return response()->json(['message' => 'Unknown integration key.'], 404);
        }

        $data = $request->validate([
            'is_enabled' => ['sometimes', 'boolean'],
            'settings'   => ['sometimes', 'array'],
        ]);

        $setting = IntegrationSetting::for($key);

        if (isset($data['settings'])) {
            // Merge — don't overwrite keys not submitted (preserves secrets)
            $merged = array_merge($setting->settings ?? [], $data['settings']);
            $data['settings'] = $merged;
        }

        $data['updated_at'] = now();
        $setting->fill($data)->save();

        return response()->json($this->sanitizeSettings($key, $setting->fresh()));
    }

    /**
     * GET /api/system/integrations
     */
    public function listIntegrations(): JsonResponse
    {
        $keys = ['turnitin', 's3_storage', 'azure_blob', 's3_backup', 'azure_backup'];
        $result = [];
        foreach ($keys as $key) {
            $setting   = IntegrationSetting::for($key);
            $result[]  = $this->sanitizeSettings($key, $setting);
        }
        return response()->json(['data' => $result]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function toResource(BackupCatalog $b): array
    {
        return [
            'id'           => $b->id,
            'filename'     => $b->filename,
            'storage_type' => $b->storage_type,
            'storage_path' => $b->storage_path,
            'size_bytes'   => $b->size_bytes,
            'status'       => $b->status,
            'notes'        => $b->notes,
            'created_by'   => $b->createdBy ? ['id' => $b->createdBy->id, 'name' => $b->createdBy->name] : null,
            'restored_at'  => $b->restored_at?->toIso8601String(),
            'created_at'   => $b->created_at?->toIso8601String(),
        ];
    }

    /** Mask sensitive keys for API output */
    private function sanitizeSettings(string $key, IntegrationSetting $s): array
    {
        $settings = $s->settings ?? [];
        $secretKeys = ['api_key', 'secret_key', 'account_key', 'connection_string', 'sas_token', 'webhook_secret'];
        $masked = [];
        foreach ($settings as $k => $v) {
            $masked[$k] = in_array($k, $secretKeys) && !empty($v) ? '••••••••' : $v;
        }
        return [
            'key'        => $s->key,
            'is_enabled' => $s->is_enabled,
            'settings'   => $masked,
            'updated_at' => $s->updated_at?->toIso8601String(),
        ];
    }

    private function uploadToS3(string $localPath, string $key, array $cfg): void
    {
        $s3 = $this->makeS3Client($cfg);
        $s3->putObject([
            'Bucket'     => $cfg['bucket'],
            'Key'        => $key,
            'SourceFile' => $localPath,
        ]);
    }

    private function s3PresignUrl(string $key, array $cfg): string
    {
        $s3  = $this->makeS3Client($cfg);
        $cmd = $s3->getCommand('GetObject', ['Bucket' => $cfg['bucket'], 'Key' => $key]);
        return (string) $s3->createPresignedRequest($cmd, '+1 hour')->getUri();
    }

    private function downloadFromS3(string $key, string $localPath, array $cfg): void
    {
        $s3 = $this->makeS3Client($cfg);
        $s3->getObject(['Bucket' => $cfg['bucket'], 'Key' => $key, 'SaveAs' => $localPath]);
    }

    private function makeS3Client(array $cfg): \Aws\S3\S3Client
    {
        $params = [
            'version'     => 'latest',
            'region'      => $cfg['region'] ?? 'us-east-1',
            'credentials' => [
                'key'    => $cfg['access_key'],
                'secret' => $cfg['secret_key'],
            ],
        ];
        if (!empty($cfg['endpoint'])) {
            $params['endpoint']                = $cfg['endpoint'];
            $params['use_path_style_endpoint'] = true;
        }
        return new \Aws\S3\S3Client($params);
    }

    private function uploadToAzureBlob(string $localPath, string $blobName, array $cfg): void
    {
        [$accountName, $accountKey, $container] = $this->azureParams($cfg);
        $url     = "https://{$accountName}.blob.core.windows.net/{$container}/{$blobName}";
        $content = file_get_contents($localPath);
        $len     = strlen($content);
        $date    = gmdate('D, d M Y H:i:s') . ' GMT';
        $strToSign = "PUT\n\n\n{$len}\n\napplication/octet-stream\n\n\n\n\n\n\nx-ms-blob-type:BlockBlob\nx-ms-date:{$date}\nx-ms-version:2021-08-06\n/{$accountName}/{$container}/{$blobName}";
        $sig     = base64_encode(hash_hmac('sha256', $strToSign, base64_decode($accountKey), true));
        $headers = [
            "Authorization: SharedKey {$accountName}:{$sig}",
            "x-ms-date: {$date}",
            "x-ms-version: 2021-08-06",
            "x-ms-blob-type: BlockBlob",
            "Content-Type: application/octet-stream",
            "Content-Length: {$len}",
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS    => $content,
            CURLOPT_HTTPHEADER    => $headers,
            CURLOPT_RETURNTRANSFER => true,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 400) {
            throw new \RuntimeException("Azure Blob PUT failed: HTTP {$code} — {$resp}");
        }
    }

    private function downloadFromAzureBlob(string $blobName, string $localPath, array $cfg): void
    {
        [$accountName, $accountKey, $container] = $this->azureParams($cfg);
        $url     = "https://{$accountName}.blob.core.windows.net/{$container}/{$blobName}";
        $date    = gmdate('D, d M Y H:i:s') . ' GMT';
        $strToSign = "GET\n\n\n\n\n\n\n\n\n\n\n\nx-ms-date:{$date}\nx-ms-version:2021-08-06\n/{$accountName}/{$container}/{$blobName}";
        $sig     = base64_encode(hash_hmac('sha256', $strToSign, base64_decode($accountKey), true));
        $headers = [
            "Authorization: SharedKey {$accountName}:{$sig}",
            "x-ms-date: {$date}",
            "x-ms-version: 2021-08-06",
        ];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER    => $headers,
            CURLOPT_RETURNTRANSFER => true,
        ]);
        $content = curl_exec($ch);
        $code    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 400) {
            throw new \RuntimeException("Azure Blob GET failed: HTTP {$code}");
        }
        file_put_contents($localPath, $content);
    }

    private function azureSasUrl(string $blobName, array $cfg): string
    {
        [$accountName, $accountKey, $container] = $this->azureParams($cfg);
        $expiry = gmdate('Y-m-d\TH:i:s\Z', time() + 3600);
        $start  = gmdate('Y-m-d\TH:i:s\Z', time() - 60);
        $strToSign = implode("\n", [
            'r', $start, $expiry,
            "/blob/{$accountName}/{$container}/{$blobName}",
            '', '', '', '2021-08-06', '', '', '', '', '',
        ]);
        $sig = urlencode(base64_encode(hash_hmac('sha256', $strToSign, base64_decode($accountKey), true)));
        return "https://{$accountName}.blob.core.windows.net/{$container}/{$blobName}"
             . "?sv=2021-08-06&st={$start}&se={$expiry}&sr=b&sp=r&sig={$sig}";
    }

    private function azureParams(array $cfg): array
    {
        return [
            $cfg['account_name'] ?? '',
            $cfg['account_key']  ?? '',
            $cfg['container']    ?? 'backups',
        ];
    }
}
