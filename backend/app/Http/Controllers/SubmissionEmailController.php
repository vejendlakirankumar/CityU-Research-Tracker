<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\EmailSetting;
use App\Models\EmailTemplate;
use App\Models\StageDefinition;
use App\Models\Submission;
use App\Models\SubmissionEmail;
use App\Models\SubmissionReviewer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SubmissionEmailController extends Controller
{
    /**
     * GET /api/submissions/{id}/email-templates
     * Active admin-created templates, available only to people who can send on an email stage.
     */
    public function templates(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('view', $submission);

        if (!$this->canSendEmail($request->user(), $submission)) {
            return response()->json(['message' => 'Not authorized to send emails for this submission.'], 403);
        }

        $templates = EmailTemplate::where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (EmailTemplate $t) => [
                'id'        => $t->id,
                'name'      => $t->name,
                'subject'   => $t->subject,
                'body_html' => $t->body_html,
                'body_text' => $t->body_text,
            ]);

        return response()->json(['data' => $templates]);
    }

    /**
     * GET /api/submissions/{id}/emails
     * Recorded emails sent for this submission.
     */
    public function index(Request $request, string $id): JsonResponse
    {
        $submission = Submission::findOrFail($id);
        $this->authorize('view', $submission);

        if (!$this->canViewEmails($request->user(), $submission)) {
            return response()->json(['data' => []]);
        }

        $emails = SubmissionEmail::where('submission_id', $id)
            ->with('sender:id,name')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (SubmissionEmail $e) => $this->toResource($e));

        return response()->json(['data' => $emails]);
    }

    /**
     * POST /api/submissions/{id}/emails
     * Send an email to the submitter (student) and record it on the submission.
     */
    public function store(Request $request, string $id): JsonResponse
    {
        $submission = Submission::with('submitter')->findOrFail($id);
        $this->authorize('view', $submission);

        $user = $request->user();
        if (!$this->canSendEmail($user, $submission)) {
            return response()->json([
                'message' => 'Only the reviewer assigned to this stage can send emails, and only once the workflow has reached this stage.',
            ], 403);
        }

        $data = $request->validate([
            'template_id' => ['nullable', 'uuid', 'exists:email_templates,id'],
            'stage_id'    => ['nullable', 'uuid'],
            'subject'     => ['required', 'string', 'max:500'],
            'body_html'   => ['required', 'string'],
        ]);

        $recipient = $submission->submitter;
        if (!$recipient || !$recipient->email) {
            return response()->json(['message' => 'The submitter has no email address on file.'], 422);
        }

        $vars     = $this->buildVars($submission, $recipient, $user);
        $subject  = strtr($data['subject'], $vars);
        $bodyHtml = strtr($data['body_html'], $vars);
        $bodyText = trim(strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>'], "\n", $bodyHtml)));

        $setting = EmailSetting::current();
        $status  = 'sent';
        $error   = null;

        try {
            config(['mail.mailers.dynamic_email' => $setting->toMailerConfig()]);
            config(['mail.from.address' => $setting->from_address]);
            config(['mail.from.name'    => $setting->from_name]);

            Mail::mailer('dynamic_email')->html($bodyHtml, function ($message) use ($recipient, $subject, $setting) {
                $message->to($recipient->email, $recipient->name)->subject($subject);
                if ($setting->reply_to) {
                    $message->replyTo($setting->reply_to);
                }
            });
        } catch (\Throwable $e) {
            $status = 'failed';
            $error  = $e->getMessage();
            Log::warning('Stage email send failed', ['submission' => $id, 'error' => $error]);
        }

        $record = SubmissionEmail::create([
            'submission_id'   => $id,
            'stage_id'        => $data['stage_id'] ?? null,
            'template_id'     => $data['template_id'] ?? null,
            'sender_id'       => $user->id,
            'recipient_email' => $recipient->email,
            'recipient_name'  => $recipient->name,
            'subject'         => $subject,
            'body_html'       => $bodyHtml,
            'body_text'       => $bodyText,
            'status'          => $status,
            'error'           => $error,
            'sent_at'         => $status === 'sent' ? now() : null,
        ]);

        AuditLog::create([
            'submission_id' => $id,
            'actor_id'      => $user->id,
            'action'        => 'EMAIL_SENT',
            'after_state'   => [
                'recipient'   => $recipient->email,
                'subject'     => $subject,
                'stage_id'    => $data['stage_id'] ?? null,
                'template_id' => $data['template_id'] ?? null,
                'status'      => $status,
            ],
        ]);

        $record->load('sender:id,name');

        $payload = ['data' => $this->toResource($record)];
        if ($status === 'failed') {
            $payload['message'] = 'The email could not be delivered and was recorded as failed. Please check the SMTP configuration in Settings.';
            return response()->json($payload, 422);
        }

        return response()->json($payload, 201);
    }

    /**
     * A user may SEND a stage email only when:
     *   - the workflow has reached an email stage (it is the submission's
     *     current stage), and
     *   - the user is a reviewer assigned to that current stage.
     * Admins/coordinators assign reviewers but do not send stage emails.
     */
    private function canSendEmail($user, Submission $submission): bool
    {
        $stageId = $submission->current_stage_id;
        if (!$stageId) {
            return false;
        }

        $currentStage = StageDefinition::find($stageId);
        if (!$currentStage || !$currentStage->is_email_stage) {
            return false;
        }

        return SubmissionReviewer::where('submission_id', $submission->id)
            ->where('user_id', $user->id)
            ->where('stage_id', $stageId)
            ->exists();
    }

    /**
     * A user may VIEW the recorded stage emails if they are an admin/coordinator
     * (oversight) or a reviewer assigned to any email stage of the submission.
     */
    private function canViewEmails($user, Submission $submission): bool
    {
        if ($user->hasAnyRole(['admin', 'coordinator'])) {
            return true;
        }

        $emailStageIds = StageDefinition::where('is_email_stage', true)->pluck('id');
        if ($emailStageIds->isEmpty()) {
            return false;
        }

        return SubmissionReviewer::where('submission_id', $submission->id)
            ->where('user_id', $user->id)
            ->whereIn('stage_id', $emailStageIds)
            ->exists();
    }

    private function buildVars(Submission $submission, $recipient, $user): array
    {
        $portal = config('app.frontend_url') ?: config('app.url');

        return [
            '{{student_name}}'     => $recipient->name ?? '',
            '{{submission_title}}' => $submission->title ?? '',
            '{{submission_id}}'    => $submission->id,
            '{{sender_name}}'      => $user->name ?? '',
            '{{portal_url}}'       => $portal ?? '',
        ];
    }

    private function toResource(SubmissionEmail $e): array
    {
        return [
            'id'              => $e->id,
            'stage_id'        => $e->stage_id,
            'template_id'     => $e->template_id,
            'sender'          => $e->sender ? ['id' => $e->sender->id, 'name' => $e->sender->name] : null,
            'recipient_email' => $e->recipient_email,
            'recipient_name'  => $e->recipient_name,
            'subject'         => $e->subject,
            'body_html'       => $e->body_html,
            'body_text'       => $e->body_text,
            'status'          => $e->status,
            'error'           => $e->error,
            'sent_at'         => $e->sent_at?->toISOString(),
            'created_at'      => $e->created_at->toISOString(),
        ];
    }
}
