<?php

namespace App\Policies;

use App\Models\Submission;
use App\Models\SubmissionReviewer;
use App\Models\User;

class SubmissionPolicy
{
    /** Admin and coordinator can view all; submitter can view own. */
    public function viewAny(User $user): bool
    {
        return true; // All authenticated users can hit the list (scope filters results)
    }

    public function view(User $user, Submission $submission): bool
    {
        return $this->isAdminOrCoordinator($user)
            || $submission->submitter_id === $user->id
            || $this->isAssignedReviewer($user, $submission);
    }

    /** Students and admins can create submissions. */
    public function create(User $user): bool
    {
        return true; // Any authenticated user; business rules enforced in controller
    }

    /** Owner can edit drafts/revision_required; admin can always edit. */
    public function update(User $user, Submission $submission): bool
    {
        if ($this->isAdminOrCoordinator($user)) {
            return true;
        }

        return $submission->submitter_id === $user->id
            && $submission->isEditable();
    }

    /** Only admin can delete. */
    public function delete(User $user, Submission $submission): bool
    {
        return in_array('admin', $user->roles ?? []);
    }

    /** Owner can withdraw own DRAFT/SUBMITTED. */
    public function withdraw(User $user, Submission $submission): bool
    {
        if ($this->isAdminOrCoordinator($user)) {
            return true;
        }

        return $submission->submitter_id === $user->id
            && in_array($submission->status, [
                Submission::STATUS_DRAFT,
                Submission::STATUS_SUBMITTED,
            ]);
    }

    /** Owner can upload files on editable submissions. */
    public function uploadVersion(User $user, Submission $submission): bool
    {
        if ($this->isAdminOrCoordinator($user)) {
            return true;
        }

        return $submission->submitter_id === $user->id
            && $submission->isEditable();
    }

    /** Anyone who can view can download. */
    public function downloadFile(User $user, Submission $submission): bool
    {
        return $this->view($user, $submission);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function isAdminOrCoordinator(User $user): bool
    {
        $roles = $user->roles ?? [];
        return in_array('admin', $roles) || in_array('coordinator', $roles);
    }

    private function isAssignedReviewer(User $user, Submission $submission): bool
    {
        return SubmissionReviewer::where('submission_id', $submission->id)
            ->where('user_id', $user->id)
            ->exists();
    }
}
