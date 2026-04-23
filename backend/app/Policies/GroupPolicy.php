<?php

namespace App\Policies;

use App\Models\Group;
use App\Models\User;

class GroupPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasAnyRole(['admin', 'coordinator']);
    }

    public function view(User $actor, Group $group): bool
    {
        return $actor->hasAnyRole(['admin', 'coordinator']);
    }

    public function create(User $actor): bool
    {
        return $actor->hasRole('admin');
    }

    public function update(User $actor, Group $group): bool
    {
        return $actor->hasRole('admin');
    }

    public function delete(User $actor, Group $group): bool
    {
        return $actor->hasRole('admin');
    }

    public function manageMembers(User $actor, Group $group): bool
    {
        return $actor->hasRole('admin');
    }
}
