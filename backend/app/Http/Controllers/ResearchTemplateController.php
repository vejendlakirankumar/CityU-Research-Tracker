<?php

namespace App\Http\Controllers;

use App\Models\ResearchTemplate;
use App\Models\SubmissionType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ResearchTemplateController extends Controller
{
    /**
     * GET /api/admin/research-templates
     * Lists all templates with their attached submission categories.
     */
    public function index(): JsonResponse
    {
        $templates = ResearchTemplate::with('submissionTypes:id,label,slug')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $templates]);
    }

    /**
     * POST /api/admin/research-templates
     * Uploads a new template file.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'file'        => ['required', 'file', 'max:51200', // 50 MB
                              'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,rtf,odt,zip'],
            'submission_type_ids'   => ['sometimes', 'array'],
            'submission_type_ids.*' => ['uuid', 'exists:submission_types,id'],
        ]);

        $file = $request->file('file');
        $originalName = basename($file->getClientOriginalName());
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName) ?: 'template';
        $extension = strtolower($file->getClientOriginalExtension());

        $storedName = (string) Str::uuid() . ($extension ? ".{$extension}" : '');
        $path = $file->storeAs('research-templates', $storedName);

        $template = ResearchTemplate::create([
            'id'          => (string) Str::uuid(),
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
            'filename'    => $safeName,
            'path'        => $path,
            'mime_type'   => $file->getClientMimeType(),
            'size_bytes'  => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        if (!empty($data['submission_type_ids'])) {
            $template->submissionTypes()->sync($data['submission_type_ids']);
        }

        return response()->json([
            'data' => $template->load('submissionTypes:id,label,slug'),
        ], 201);
    }

    /**
     * PATCH /api/admin/research-templates/{id}
     * Updates metadata and optionally replaces the file.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $template = ResearchTemplate::findOrFail($id);

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'file'        => ['sometimes', 'file', 'max:51200',
                              'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,rtf,odt,zip'],
        ]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $originalName = basename($file->getClientOriginalName());
            $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName) ?: 'template';
            $extension = strtolower($file->getClientOriginalExtension());
            $storedName = (string) Str::uuid() . ($extension ? ".{$extension}" : '');

            if ($template->path && Storage::exists($template->path)) {
                Storage::delete($template->path);
            }

            $template->path       = $file->storeAs('research-templates', $storedName);
            $template->filename   = $safeName;
            $template->mime_type  = $file->getClientMimeType();
            $template->size_bytes = $file->getSize();
        }

        if (array_key_exists('name', $data))        $template->name = $data['name'];
        if (array_key_exists('description', $data)) $template->description = $data['description'];

        $template->save();

        return response()->json([
            'data' => $template->load('submissionTypes:id,label,slug'),
        ]);
    }

    /**
     * DELETE /api/admin/research-templates/{id}
     */
    public function destroy(string $id): JsonResponse
    {
        $template = ResearchTemplate::findOrFail($id);

        if ($template->path && Storage::exists($template->path)) {
            Storage::delete($template->path);
        }

        $template->delete();

        return response()->json(null, 204);
    }

    /**
     * PUT /api/admin/research-templates/{id}/submission-types
     * Replaces the set of categories this template is attached to.
     */
    public function syncSubmissionTypes(Request $request, string $id): JsonResponse
    {
        $template = ResearchTemplate::findOrFail($id);

        $data = $request->validate([
            'submission_type_ids'   => ['present', 'array'],
            'submission_type_ids.*' => ['uuid', 'exists:submission_types,id'],
        ]);

        $template->submissionTypes()->sync($data['submission_type_ids']);

        return response()->json([
            'data' => $template->load('submissionTypes:id,label,slug'),
        ]);
    }

    /**
     * GET /api/research-templates/{id}/download
     * Downloads the template file. Available to any authenticated user.
     */
    public function download(string $id): mixed
    {
        $template = ResearchTemplate::findOrFail($id);

        if (! $template->path || ! Storage::exists($template->path)) {
            return response()->json(['message' => 'Template file not found.'], 404);
        }

        return Storage::download($template->path, $template->filename);
    }

    /**
     * GET /api/submission-types/{id}/templates
     * Templates attached to a category (researcher-facing).
     */
    public function forSubmissionType(string $id): JsonResponse
    {
        $type = SubmissionType::findOrFail($id);

        return response()->json([
            'data' => $type->templates()->get([
                'research_templates.id',
                'research_templates.name',
                'research_templates.description',
                'research_templates.filename',
                'research_templates.size_bytes',
            ]),
        ]);
    }
}
