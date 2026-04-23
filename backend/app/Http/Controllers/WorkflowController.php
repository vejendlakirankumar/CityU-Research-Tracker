<?php

namespace App\Http\Controllers;

use App\Models\WorkflowDefinition;
use App\Models\StageDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class WorkflowController extends Controller
{
    // ── Workflow Definitions ──────────────────────────────────────────────────

    /**
     * GET /api/admin/workflows
     */
    public function index(Request $request): JsonResponse
    {
        $query = WorkflowDefinition::with(['stages' => fn($q) => $q->orderBy('order')])
            ->when($request->filled('search'), function ($q) use ($request) {
                $q->where('name', 'ilike', '%' . $request->search . '%');
            })
            ->orderBy('name');

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
     * GET /api/admin/workflows/{id}
     */
    public function show(string $id): JsonResponse
    {
        $workflow = WorkflowDefinition::with([
            'stages' => fn($q) => $q->orderBy('order'),
        ])->findOrFail($id);

        return response()->json(['data' => $workflow]);
    }

    /**
     * POST /api/admin/workflows
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                      => ['required', 'string', 'max:255'],
            'revision_restart_policy'   => ['in:FULL_RESTART,RESUME_FROM_REVISION'],
            'final_status_on_pass'      => ['in:ACCEPTED,CONDITIONALLY_ACCEPTED'],
            'is_active'                 => ['boolean'],
            'stages'                    => ['sometimes', 'array'],
            'stages.*.name'             => ['required', 'string', 'max:255'],
            'stages.*.stage_role_label' => ['required', 'string', 'max:255'],
            'stages.*.order'            => ['required', 'integer', 'min:1'],
            'stages.*.execution_type'   => ['in:PARALLEL,SEQUENTIAL'],
            'stages.*.approval_strategy'=> ['in:ALL,MAJORITY,ANY'],
            'stages.*.min_approvals'    => ['integer', 'min:1'],
            'stages.*.is_gatekeeper'    => ['boolean'],
            'stages.*.is_anonymous'     => ['boolean'],
            'stages.*.due_days'         => ['integer', 'min:1'],
            'stages.*.decision_options' => ['array'],
            'stages.*.auto_assignment'  => ['array'],
        ]);

        $workflow = WorkflowDefinition::create([
            'id'                      => Str::uuid()->toString(),
            'name'                    => $data['name'],
            'revision_restart_policy' => $data['revision_restart_policy'] ?? 'FULL_RESTART',
            'final_status_on_pass'    => $data['final_status_on_pass'] ?? 'ACCEPTED',
            'is_active'               => $data['is_active'] ?? true,
        ]);

        if (!empty($data['stages'])) {
            $this->syncStages($workflow, $data['stages']);
        }

        $workflow->load(['stages' => fn($q) => $q->orderBy('order')]);

        return response()->json(['data' => $workflow], 201);
    }

    /**
     * PATCH /api/admin/workflows/{id}
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $workflow = WorkflowDefinition::findOrFail($id);

        $data = $request->validate([
            'name'                      => ['sometimes', 'string', 'max:255'],
            'revision_restart_policy'   => ['in:FULL_RESTART,RESUME_FROM_REVISION'],
            'final_status_on_pass'      => ['in:ACCEPTED,CONDITIONALLY_ACCEPTED'],
            'is_active'                 => ['boolean'],
            'stages'                    => ['sometimes', 'array'],
            'stages.*.id'               => ['sometimes', 'uuid'],
            'stages.*.name'             => ['required', 'string', 'max:255'],
            'stages.*.stage_role_label' => ['required', 'string', 'max:255'],
            'stages.*.order'            => ['required', 'integer', 'min:1'],
            'stages.*.execution_type'   => ['in:PARALLEL,SEQUENTIAL'],
            'stages.*.approval_strategy'=> ['in:ALL,MAJORITY,ANY'],
            'stages.*.min_approvals'    => ['integer', 'min:1'],
            'stages.*.is_gatekeeper'    => ['boolean'],
            'stages.*.is_anonymous'     => ['boolean'],
            'stages.*.due_days'         => ['integer', 'min:1'],
            'stages.*.decision_options' => ['array'],
            'stages.*.auto_assignment'  => ['array'],
        ]);

        $workflow->update(array_filter(array_intersect_key($data, array_flip([
            'name', 'revision_restart_policy', 'final_status_on_pass', 'is_active',
        ])), fn($v) => $v !== null));

        if (array_key_exists('stages', $data)) {
            $this->syncStages($workflow, $data['stages']);
        }

        $workflow->load(['stages' => fn($q) => $q->orderBy('order')]);

        return response()->json(['data' => $workflow->fresh(['stages'])]);
    }

    /**
     * DELETE /api/admin/workflows/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $workflow = WorkflowDefinition::findOrFail($id);
        // Soft-deactivate if in-use, hard delete otherwise
        if ($workflow->workflowRuns()->exists()) {
            $workflow->update(['is_active' => false]);
            return response()->json(['message' => 'Workflow deactivated (has active runs).']);
        }
        $workflow->stages()->delete();
        $workflow->delete();
        return response()->json(null, 204);
    }

    // ── Stages ────────────────────────────────────────────────────────────────

    /**
     * POST /api/admin/workflows/{id}/stages
     * Add a stage to a workflow.
     */
    public function addStage(Request $request, string $id): JsonResponse
    {
        $workflow = WorkflowDefinition::findOrFail($id);

        $data = $request->validate([
            'name'             => ['required', 'string', 'max:255'],
            'stage_role_label' => ['required', 'string', 'max:255'],
            'order'            => ['required', 'integer', 'min:1'],
            'execution_type'   => ['in:PARALLEL,SEQUENTIAL'],
            'approval_strategy'=> ['in:ALL,MAJORITY,ANY'],
            'min_approvals'    => ['integer', 'min:1'],
            'is_gatekeeper'    => ['boolean'],
            'is_anonymous'     => ['boolean'],
            'due_days'         => ['integer', 'min:1'],
            'decision_options' => ['array'],
            'auto_assignment'  => ['array'],
        ]);

        $stage = $this->createStage($workflow->id, $data);

        return response()->json(['data' => $stage], 201);
    }

    /**
     * PATCH /api/admin/workflows/{workflowId}/stages/{stageId}
     */
    public function updateStage(Request $request, string $workflowId, string $stageId): JsonResponse
    {
        $stage = StageDefinition::where('workflow_id', $workflowId)->findOrFail($stageId);

        $data = $request->validate([
            'name'             => ['sometimes', 'string', 'max:255'],
            'stage_role_label' => ['sometimes', 'string', 'max:255'],
            'order'            => ['sometimes', 'integer', 'min:1'],
            'execution_type'   => ['in:PARALLEL,SEQUENTIAL'],
            'approval_strategy'=> ['in:ALL,MAJORITY,ANY'],
            'min_approvals'    => ['integer', 'min:1'],
            'is_gatekeeper'    => ['boolean'],
            'is_anonymous'     => ['boolean'],
            'due_days'         => ['integer', 'min:1'],
            'decision_options' => ['array'],
            'auto_assignment'  => ['array'],
        ]);

        $stage->update($data);

        return response()->json(['data' => $stage->fresh()]);
    }

    /**
     * DELETE /api/admin/workflows/{workflowId}/stages/{stageId}
     */
    public function deleteStage(string $workflowId, string $stageId): JsonResponse
    {
        $stage = StageDefinition::where('workflow_id', $workflowId)->findOrFail($stageId);
        $stage->delete();
        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function syncStages(WorkflowDefinition $workflow, array $stages): void
    {
        $incoming = collect($stages);
        $incomingIds = $incoming->pluck('id')->filter()->all();

        // Delete stages not in incoming set
        $workflow->stages()->whereNotIn('id', $incomingIds)->delete();

        foreach ($stages as $stageData) {
            if (!empty($stageData['id'])) {
                $stage = StageDefinition::find($stageData['id']);
                if ($stage) {
                    $stage->update($this->stageFields($stageData));
                    continue;
                }
            }
            $this->createStage($workflow->id, $stageData);
        }
    }

    private function createStage(string $workflowId, array $data): StageDefinition
    {
        return StageDefinition::create([
            'id'               => Str::uuid()->toString(),
            'workflow_id'      => $workflowId,
            ...$this->stageFields($data),
        ]);
    }

    private function stageFields(array $data): array
    {
        return array_filter([
            'name'              => $data['name'] ?? null,
            'order'             => $data['order'] ?? null,
            'stage_role_label'  => $data['stage_role_label'] ?? null,
            'is_gatekeeper'     => $data['is_gatekeeper'] ?? false,
            'execution_type'    => $data['execution_type'] ?? 'PARALLEL',
            'approval_strategy' => $data['approval_strategy'] ?? 'ALL',
            'min_approvals'     => $data['min_approvals'] ?? 1,
            'is_anonymous'      => $data['is_anonymous'] ?? false,
            'due_days'          => $data['due_days'] ?? 7,
            'decision_options'  => $data['decision_options'] ?? ['APPROVE', 'REQUEST_CHANGES', 'REJECT'],
            'auto_assignment'   => $data['auto_assignment'] ?? ['strategy' => 'MANUAL'],
            'visibility_config' => $data['visibility_config'] ?? [],
            'escalation_config' => $data['escalation_config'] ?? [],
        ], fn($v) => $v !== null);
    }
}
