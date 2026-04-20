<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Admins and coordinators can list users.
     */
    public function viewAny(User $actor): bool
    {
        return $actor->hasAnyRole(['admin', 'coordinator']);
    }

    /**
     * Admins and coordinators can view any user profile.
     */
    public function view(User $actor, User $target): bool
    {
        if ($actor->hasRole('admin')) return true;
        if ($actor->hasRole('coordinator')) return true;
        return $actor->id === $target->id;
    }

    /**
     * Only admins can create users.
     */
    public function create(User $actor): bool
    {
        return $actor->hasRole('admin');
    }

    /**
     * Admins can update anyone. Users can update themselves (non-role fields).
     */
    public function update(User $actor, User $target): bool
    {
        return $actor->hasRole('admin') || $actor->id === $target->id;
    }

    /**
     * Only admins can deactivate/delete users. Cannot delete self.
     */
    public function delete(User $actor, User $target): bool
    {
        return $actor->hasRole('admin') && $actor->id !== $target->id;
    }

    /**
     * Only admins can assign/change roles.
     */
    public function assignRoles(User $actor): bool
    {
        return $actor->hasRole('admin');
    }

    /**
     * Only admins can reset another user's password.
     */
    public function resetPassword(User $actor, User $target): bool
    {
        return $actor->hasRole('admin') && $actor->id !== $target->id;
    }
}
