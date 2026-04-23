<?php

namespace App\Http\Controllers;

use App\Models\ReviewerPool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReviewerPoolController extends Controller
{
    /**
     * GET /api/admin/reviewer-pools?submission_type_id=X
     * Returns all pool entries for a submission type.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'submission_type_id' => ['required', 'uuid', 'exists:submission_types,id'],
        ]);

        $pools = ReviewerPool::with('user:id,name,email,first_name,last_name,org_role')
            ->where('submission_type_id', $request->submission_type_id)
            ->orderBy('stage_id')
            ->orderBy('added_at')
            ->get();

        return response()->json(['data' => $pools]);
    }

    /**
     * POST /api/admin/reviewer-pools
     * Add a reviewer to the default pool for a submission type + stage.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'submission_type_id' => ['required', 'uuid', 'exists:submission_types,id'],
            'user_id'            => ['required', 'uuid', 'exists:users,id'],
            'stage_id'           => ['required', 'uuid', 'exists:stage_definitions,id'],
        ]);

        $pool = ReviewerPool::firstOrCreate(
            [
                'submission_type_id' => $data['submission_type_id'],
                'user_id'            => $data['user_id'],
                'stage_id'           => $data['stage_id'],
            ],
            ['id' => Str::uuid()->toString()]
        );

        $pool->load('user:id,name,email,first_name,last_name,org_role');

        return response()->json(['data' => $pool], 201);
    }

    /**
     * DELETE /api/admin/reviewer-pools/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $pool = ReviewerPool::findOrFail($id);
        $pool->delete();
        return response()->json(null, 204);
    }
}
