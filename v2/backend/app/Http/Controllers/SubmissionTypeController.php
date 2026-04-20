<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\SubmissionType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SubmissionTypeController extends Controller
{
    /**
     * GET /api/admin/submission-types
     * Lists all types (including inactive) for admin config.
     * Also used by GET /api/submission-types (active only, any auth'd user).
     */
    public function index(Request $request): JsonResponse
    {
        $query = SubmissionType::withCount('submissions')
            ->with(['workflow:id,name', 'workflow.stages' => fn($q) => $q->orderBy('order')])
            ->orderBy('label');

        // Non-admin endpoint: active only
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);

            $user = Auth::user();
            $userGroupIds = $user?->groups()->pluck('groups.id')->toArray() ?? [];
            $userId = $user?->id;

            // Check whether this user has ANY explicit assignment (direct user OR via group).
            // If they do, show ONLY their explicitly assigned categories.
            // If they have no assignments at all, show only the fully-open categories.
            $hasAnyAssignment = $userId && SubmissionType::where('is_active', true)
                ->where(function ($q) use ($userGroupIds, $userId) {
                    $q->whereHas('allowedUsers', fn($u) => $u->where('users.id', $userId));
                    if (!empty($userGroupIds)) {
                        $q->orWhereHas('allowedGroups', fn($g) => $g->whereIn('groups.id', $userGroupIds));
                    }
                })
                ->exists();

            if ($hasAnyAssignment) {
                // User is explicitly assigned → show only their categories
                $query->where(function ($q) use ($userGroupIds, $userId) {
                    $q->whereHas('allowedUsers', fn($u) => $u->where('users.id', $userId));
                    if (!empty($userGroupIds)) {
                        $q->orWhereHas('allowedGroups', fn($g) => $g->whereIn('groups.id', $userGroupIds));
                    }
                });
            } else {
                // No assignments → only show truly open categories (no restrictions)
                $query->whereDoesntHave('allowedGroups')
                      ->whereDoesntHave('allowedUsers');
            }
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(fn($q) => $q->where('label', 'ilike', $term)
                ->orWhere('slug', 'ilike', $term));
        }

        if ($request->boolean('all')) {
            return response()->json(['data' => $query->get()]);
        }

        $perPage = min((int) $request->get('per_page', 20), 100);
        $items = $query->paginate($perPage);

        return response()->json([
            'data' => $items->items(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page'    => $items->lastPage(),
                'per_page'     => $items->perPage(),
                'total'        => $items->total(),
            ],
        ]);
    }

    /**
     * GET /api/admin/submission-types/{id}
     */
    public function show(string $id): JsonResponse
    {
        $type = SubmissionType::with([
            'workflow',
            'workflow.stages' => fn($q) => $q->orderBy('order'),
            'allowedGroups:id,name,slug',
        ])->findOrFail($id);
        return response()->json(['data' => $type]);
    }

    /**
     * POST /api/admin/submission-types
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label'              => ['required', 'string', 'max:255'],
            'slug'               => ['required', 'string', 'max:255', 'regex:/^[a-z0-9\-]+$/', Rule::unique('submission_types', 'slug')],
            'description'        => ['nullable', 'string'],
            'is_gated_review'    => ['boolean'],
            'is_blind_review'    => ['boolean'],
            'allow_meetings'     => ['boolean'],
            'max_file_size_mb'   => ['integer', 'min:1', 'max:500'],
            'allowed_extensions' => ['required', 'array', 'min:1'],
            'allowed_extensions.*' => ['string', 'lowercase', 'max:10'],
            'max_files'          => ['integer', 'min:1', 'max:50'],
            'is_active'          => ['boolean'],
            'workflow_id'        => ['nullable', 'uuid', 'exists:workflow_definitions,id'],
        ]);

        $type = SubmissionType::create([
            'id' => Str::uuid()->toString(),
            ...$data,
        ]);

        return response()->json(['data' => $type], 201);
    }

    /**
     * PATCH /api/admin/submission-types/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);

        $data = $request->validate([
            'label'              => ['sometimes', 'string', 'max:255'],
            'slug'               => ['sometimes', 'string', 'max:255', 'regex:/^[a-z0-9\-]+$/', Rule::unique('submission_types', 'slug')->ignore($id)],
            'description'        => ['nullable', 'string'],
            'is_gated_review'    => ['boolean'],
            'is_blind_review'    => ['boolean'],
            'allow_meetings'     => ['boolean'],
            'max_file_size_mb'   => ['integer', 'min:1', 'max:500'],
            'allowed_extensions' => ['sometimes', 'array', 'min:1'],
            'allowed_extensions.*' => ['string', 'lowercase', 'max:10'],
            'max_files'          => ['integer', 'min:1', 'max:50'],
            'is_active'          => ['boolean'],
            'workflow_id'        => ['nullable', 'uuid', 'exists:workflow_definitions,id'],
        ]);

        $type->update($data);

        return response()->json(['data' => $type->fresh()]);
    }

    /**
     * DELETE /api/admin/submission-types/{id}
     * Deactivates if has submissions; hard-deletes if none.
     */
    public function destroy(string $id): JsonResponse
    {
        $type = SubmissionType::withCount('submissions')->findOrFail($id);

        if ($type->submissions_count > 0) {
            $type->update(['is_active' => false]);
            return response()->json(['message' => 'Submission type deactivated (has existing submissions).']);
        }

        $type->delete();
        return response()->json(null, 204);
    }

    // ── Group access management ───────────────────────────────────────────────

    /**
     * GET /api/admin/submission-types/{id}/groups
     * Returns the groups that have access to this category.
     */
    public function getGroups(string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);
        return response()->json([
            'data' => $type->allowedGroups()->get(['groups.id', 'groups.name', 'groups.slug']),
        ]);
    }

    /**
     * PUT /api/admin/submission-types/{id}/groups
     * Replaces the entire allowed-groups list.
     * Send empty array [] to make the category open to all.
     */
    public function syncGroups(Request $request, string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);

        $data = $request->validate([
            'group_ids'   => ['present', 'array'],
            'group_ids.*' => ['uuid', 'exists:groups,id'],
        ]);

        $type->allowedGroups()->sync($data['group_ids']);

        return response()->json([
            'data' => $type->allowedGroups()->get(['groups.id', 'groups.name', 'groups.slug']),
        ]);
    }

    // ── User access management ────────────────────────────────────────────────

    /**
     * GET /api/admin/submission-types/{id}/users
     * Returns the users directly assigned to this category.
     */
    public function getUsers(string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);
        return response()->json([
            'data' => $type->allowedUsers()->get(['users.id', 'users.name', 'users.email', 'users.roles']),
        ]);
    }

    /**
     * PUT /api/admin/submission-types/{id}/users
     * Replaces the entire allowed-users list.
     * Send empty array [] to remove all direct user assignments.
     */
    public function syncUsers(Request $request, string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);

        $data = $request->validate([
            'user_ids'   => ['present', 'array'],
            'user_ids.*' => ['uuid', 'exists:users,id'],
        ]);

        $type->allowedUsers()->sync($data['user_ids']);

        return response()->json([
            'data' => $type->allowedUsers()->get(['users.id', 'users.name', 'users.email', 'users.roles']),
        ]);
    }
}
