<?php

namespace App\Http\Controllers;

use App\Http\Resources\GroupResource;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GroupController extends Controller
{
    /**
     * GET /api/groups
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Group::class);

        $groups = Group::with(['parent', 'children'])
            ->when($request->input('search'), function ($q, $search) {
                $q->whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($search) . '%']);
            })
            ->when($request->input('type'), fn($q, $type) => $q->where('type', $type))
            ->when($request->has('is_active'), function ($q) use ($request) {
                $q->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
            })
            ->withCount('users')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => GroupResource::collection($groups->items()),
            'meta' => [
                'total'        => $groups->total(),
                'per_page'     => $groups->perPage(),
                'current_page' => $groups->currentPage(),
                'last_page'    => $groups->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/groups/{group}
     */
    public function show(Group $group): JsonResponse
    {
        $this->authorize('view', $group);
        $group->load(['parent', 'children', 'users.program'])->loadCount('users');

        return response()->json(new GroupResource($group));
    }

    /**
     * POST /api/groups
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Group::class);

        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'slug'      => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9\-]+$/', 'unique:groups,slug'],
            'type'      => ['required', Rule::in(['department', 'faculty', 'school', 'custom'])],
            'parent_id' => ['nullable', 'uuid', 'exists:groups,id'],
            'is_active' => ['boolean'],
        ]);

        // Auto-generate slug if not provided
        if (empty($data['slug'])) {
            $data['slug'] = $this->uniqueSlug($data['name']);
        }

        $group = Group::create($data);

        AuditLog::create([
            'actor_id'    => $request->user()->id,
            'action'      => 'GROUP_CREATED',
            'target_type' => 'group',
            'target_id'   => $group->id,
            'after_state' => ['name' => $group->name, 'type' => $group->type],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'request_id'  => $request->header('X-Request-Id'),
        ]);

        return response()->json(new GroupResource($group->load('parent')), 201);
    }

    /**
     * PATCH /api/groups/{group}
     */
    public function update(Request $request, Group $group): JsonResponse
    {
        $this->authorize('update', $group);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'slug'      => ['sometimes', 'string', 'max:100', 'regex:/^[a-z0-9\-]+$/', Rule::unique('groups')->ignore($group->id)],
            'type'      => ['sometimes', Rule::in(['department', 'faculty', 'school', 'custom'])],
            'parent_id' => ['sometimes', 'nullable', 'uuid', 'exists:groups,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Prevent circular parent
        if (isset($data['parent_id']) && $data['parent_id'] === $group->id) {
            return response()->json(['message' => 'A group cannot be its own parent.'], 422);
        }

        $before = $group->only(['name', 'slug', 'type', 'is_active']);
        $group->update($data);

        AuditLog::create([
            'actor_id'     => $request->user()->id,
            'action'       => 'GROUP_UPDATED',
            'target_type'  => 'group',
            'target_id'    => $group->id,
            'before_state' => $before,
            'after_state'  => $group->only(['name', 'slug', 'type', 'is_active']),
            'ip_address'   => $request->ip(),
            'user_agent'   => $request->userAgent(),
            'request_id'   => $request->header('X-Request-Id'),
        ]);

        return response()->json(new GroupResource($group->load('parent')));
    }

    /**
     * DELETE /api/groups/{group}
     */
    public function destroy(Request $request, Group $group): JsonResponse
    {
        $this->authorize('delete', $group);

        if ($group->users()->exists()) {
            return response()->json(['message' => 'Cannot delete a group that has members. Remove all members first.'], 422);
        }

        if ($group->children()->exists()) {
            return response()->json(['message' => 'Cannot delete a group that has sub-groups.'], 422);
        }

        AuditLog::create([
            'actor_id'     => $request->user()->id,
            'action'       => 'GROUP_DELETED',
            'target_type'  => 'group',
            'target_id'    => $group->id,
            'before_state' => ['name' => $group->name],
            'ip_address'   => $request->ip(),
            'user_agent'   => $request->userAgent(),
            'request_id'   => $request->header('X-Request-Id'),
        ]);

        $group->delete();

        return response()->json(['message' => 'Group deleted.']);
    }

    // ── Membership management ─────────────────────────────────────────────────

    /**
     * GET /api/groups/{group}/members
     */
    public function members(Group $group): JsonResponse
    {
        $this->authorize('view', $group);

        $members = $group->users()->with('program')->get()->map(function ($user) {
            return [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'roles'      => $user->roles,
                'is_active'  => $user->is_active,
                'group_role' => $user->pivot->role,
                'joined_at'  => $user->pivot->joined_at,
            ];
        });

        return response()->json(['data' => $members]);
    }

    /**
     * POST /api/groups/{group}/members
     * Add a user (or batch of users) to the group.
     */
    public function addMembers(Request $request, Group $group): JsonResponse
    {
        $this->authorize('manageMembers', $group);

        $data = $request->validate([
            'user_ids'   => ['required', 'array', 'min:1'],
            'user_ids.*' => ['required', 'uuid', 'exists:users,id'],
            'role'       => ['nullable', Rule::in(['member', 'lead', 'manager'])],
        ]);

        $role = $data['role'] ?? 'member';
        $added = [];

        foreach ($data['user_ids'] as $userId) {
            // Skip already-members
            if (!$group->users()->where('user_id', $userId)->exists()) {
                $group->users()->attach($userId, ['role' => $role]);
                $added[] = $userId;
            }
        }

        AuditLog::create([
            'actor_id'    => $request->user()->id,
            'action'      => 'GROUP_MEMBERS_ADDED',
            'target_type' => 'group',
            'target_id'   => $group->id,
            'after_state' => ['added' => $added, 'role' => $role],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'request_id'  => $request->header('X-Request-Id'),
        ]);

        return response()->json([
            'message' => count($added) . ' member(s) added.',
            'added'   => $added,
        ]);
    }

    /**
     * PATCH /api/groups/{group}/members/{user}
     * Update a member's role within the group.
     */
    public function updateMember(Request $request, Group $group, User $user): JsonResponse
    {
        $this->authorize('manageMembers', $group);

        $data = $request->validate([
            'role' => ['required', Rule::in(['member', 'lead', 'manager'])],
        ]);

        $group->users()->updateExistingPivot($user->id, ['role' => $data['role']]);

        return response()->json(['message' => 'Member role updated.']);
    }

    /**
     * DELETE /api/groups/{group}/members/{user}
     * Remove a user from the group.
     */
    public function removeMember(Request $request, Group $group, User $user): JsonResponse
    {
        $this->authorize('manageMembers', $group);

        $group->users()->detach($user->id);

        AuditLog::create([
            'actor_id'    => $request->user()->id,
            'action'      => 'GROUP_MEMBER_REMOVED',
            'target_type' => 'group',
            'target_id'   => $group->id,
            'after_state' => ['removed_user' => $user->email],
            'ip_address'  => $request->ip(),
            'user_agent'  => $request->userAgent(),
            'request_id'  => $request->header('X-Request-Id'),
        ]);

        return response()->json(['message' => 'Member removed.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $i = 1;
        while (Group::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }
        return $slug;
    }
}
