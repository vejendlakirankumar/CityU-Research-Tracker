<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'slug'        => $this->slug,
            'type'        => $this->type,
            'is_active'   => $this->is_active,
            'users_count' => $this->users_count ?? null,
            'parent_id'   => $this->parent_id,
            'parent'      => $this->whenLoaded('parent', fn() => [
                'id'   => $this->parent->id,
                'name' => $this->parent->name,
            ]),
            'children'    => $this->whenLoaded('children', fn() =>
                $this->children->map(fn($c) => [
                    'id'   => $c->id,
                    'name' => $c->name,
                    'type' => $c->type,
                ])->values()
            ),
            'members'     => $this->whenLoaded('users', fn() =>
                $this->users->map(fn($u) => [
                    'id'         => $u->id,
                    'name'       => $u->name,
                    'email'      => $u->email,
                    'roles'      => $u->roles,
                    'group_role' => $u->pivot->role,
                    'joined_at'  => $u->pivot->joined_at,
                ])->values()
            ),
            'created_at'  => $this->created_at?->toIso8601String(),
            'updated_at'  => $this->updated_at?->toIso8601String(),
        ];
    }
}
