<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'email'                 => $this->email,
            'name'                  => $this->name,
            'first_name'            => $this->first_name,
            'last_name'             => $this->last_name,
            'organization'          => $this->organization,
            'org_role'              => $this->org_role,
            'roles'                 => $this->roles ?? [],
            'program_id'            => $this->program_id,
            'program'               => $this->whenLoaded('program', fn() => [
                'id'   => $this->program->id,
                'name' => $this->program->name,
            ]),
            'groups'                => $this->whenLoaded('groups', fn() =>
                $this->groups->map(fn($g) => [
                    'id'         => $g->id,
                    'name'       => $g->name,
                    'type'       => $g->type,
                    'group_role' => $g->pivot->role,
                ])->values()
            ),
            'is_active'             => $this->is_active,
            'is_emergency_admin'    => $this->is_emergency_admin,
            'locked_at'             => $this->locked_at?->toIso8601String(),
            'failed_login_attempts' => $this->failed_login_attempts ?? 0,
            'last_login_at'         => $this->last_login_at?->toIso8601String(),
            'last_login_attempt_at' => $this->last_login_attempt_at?->toIso8601String(),
            'last_login_success'    => $this->last_login_success,
            'created_at'            => $this->created_at?->toIso8601String(),
        ];
    }
}
