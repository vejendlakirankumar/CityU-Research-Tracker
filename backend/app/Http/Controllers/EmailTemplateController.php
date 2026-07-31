<?php

namespace App\Http\Controllers;

use App\Models\EmailTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailTemplateController extends Controller
{
    /**
     * GET /api/admin/email-templates
     */
    public function index(): JsonResponse
    {
        $templates = EmailTemplate::orderBy('name')
            ->get()
            ->map(fn (EmailTemplate $t) => $this->toResource($t));

        return response()->json([
            'data'      => $templates,
            'variables' => EmailTemplate::availableVariables(),
        ]);
    }

    /**
     * POST /api/admin/email-templates
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'subject'   => ['required', 'string', 'max:500'],
            'body_html' => ['required', 'string'],
            'body_text' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        $data['created_by'] = $request->user()->id;
        $template = EmailTemplate::create($data);

        return response()->json(['data' => $this->toResource($template)], 201);
    }

    /**
     * PATCH /api/admin/email-templates/{email_template}
     */
    public function update(Request $request, EmailTemplate $emailTemplate): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:255'],
            'subject'   => ['sometimes', 'string', 'max:500'],
            'body_html' => ['sometimes', 'string'],
            'body_text' => ['sometimes', 'nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $emailTemplate->update($data);

        return response()->json(['data' => $this->toResource($emailTemplate)]);
    }

    /**
     * DELETE /api/admin/email-templates/{email_template}
     */
    public function destroy(EmailTemplate $emailTemplate): JsonResponse
    {
        $emailTemplate->delete();

        return response()->json(null, 204);
    }

    private function toResource(EmailTemplate $t): array
    {
        return [
            'id'         => $t->id,
            'name'       => $t->name,
            'subject'    => $t->subject,
            'body_html'  => $t->body_html,
            'body_text'  => $t->body_text,
            'is_active'  => (bool) $t->is_active,
            'updated_at' => $t->updated_at?->toISOString(),
        ];
    }
}
