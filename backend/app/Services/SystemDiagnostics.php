<?php

namespace App\Services;

use App\Models\SystemLog;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class SystemDiagnostics
{
    public static function requestId(Request $request): string
    {
        if (!$request->attributes->has('diagnostic_request_id')) {
            $request->attributes->set('diagnostic_request_id', (string) Str::uuid());
        }

        return $request->attributes->get('diagnostic_request_id');
    }

    public static function record(Request $request, string $level, string $event, array $context = []): void
    {
        $submissionId = $request->route('submissionId') ?? $request->route('id');
        $reviewerId = $request->route('reviewerId');
        if (!$submissionId && preg_match('#^api/submissions/([^/]+)/reviewers/([^/]+)(?:/|$)#', $request->path(), $matches)) {
            $submissionId = $matches[1];
            $reviewerId = $matches[2];
        }
        $entry = [
            'id' => (string) Str::uuid(),
            'request_id' => self::requestId($request),
            'level' => $level,
            'event' => $event,
            'user_id' => Auth::guard()->hasUser() ? Auth::user()?->getAuthIdentifier() : null,
            'submission_id' => Str::isUuid($submissionId ?? '') ? $submissionId : null,
            'reviewer_id' => Str::isUuid($reviewerId ?? '') ? $reviewerId : null,
            'route' => $request->route()?->uri(),
            'context' => $context,
            'created_at' => now(),
        ];

        Log::log($level, $event, Arr::except($entry, ['id', 'created_at']));

        try {
            SystemLog::create($entry);
        } catch (QueryException $e) {
            // Diagnostics must not turn a completed upload into a failed request.
            Log::error('system_diagnostics.persistence_failed', [
                'request_id' => $entry['request_id'],
                'exception' => $e::class,
            ]);
        }
    }

    public static function uploadContext(Request $request): array
    {
        return [
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'max_file_uploads' => ini_get('max_file_uploads'),
            'content_length' => $request->server('CONTENT_LENGTH'),
            'files' => collect(Arr::flatten($request->allFiles()))
                ->filter(fn ($file) => $file instanceof UploadedFile)
                ->map(fn (UploadedFile $file) => [
                    'extension' => substr(strtolower($file->getClientOriginalExtension()), 0, 16),
                    'size' => $file->isValid() ? $file->getSize() : null,
                    'php_upload_error' => $file->getError(),
                ])->values()->all(),
        ];
    }
}
