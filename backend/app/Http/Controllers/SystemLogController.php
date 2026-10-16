<?php

namespace App\Http\Controllers;

use App\Models\SystemLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'level' => ['nullable', 'in:info,warning,error'],
            'request_id' => ['nullable', 'uuid'],
            'submission_id' => ['nullable', 'uuid'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        if (!empty($filters['date_from']) && !empty($filters['date_to'])
            && $filters['date_to'] < $filters['date_from']) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'date_to' => 'The end date must be on or after the start date.',
            ]);
        }

        $query = SystemLog::query();
        foreach (['level', 'request_id', 'submission_id'] as $field) {
            if (!empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        return response()->json($query->orderByDesc('created_at')->orderByDesc('id')->paginate(50));
    }
}
