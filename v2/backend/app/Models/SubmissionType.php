<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SubmissionType extends Model
{
    protected $table = 'submission_types';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'slug', 'label', 'description', 'is_gated_review', 'is_blind_review',
        'allow_meetings', 'max_file_size_mb', 'allowed_extensions',
        'max_files', 'is_active', 'workflow_id',
    ];

    protected function casts(): array
    {
        return [
            'is_gated_review'    => 'boolean',
            'is_blind_review'    => 'boolean',
            'allow_meetings'     => 'boolean',
            'is_active'          => 'boolean',
            'allowed_extensions' => 'array',
        ];
    }

    public function submissions()
    {
        return $this->hasMany(Submission::class, 'submission_type_id');
    }

    public function workflow()
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_id');
    }

    /**
     * Groups that have access to submit under this category.
     * Empty = open to all authenticated users.
     */
    public function allowedGroups()
    {
        return $this->belongsToMany(Group::class, 'submission_type_groups', 'submission_type_id', 'group_id')
                    ->withPivot('created_at')
                    ->orderBy('name');
    }

    /**
     * Users directly assigned to this category.
     * Works alongside group-based access.
     */
    public function allowedUsers()
    {
        return $this->belongsToMany(User::class, 'submission_type_users', 'submission_type_id', 'user_id')
                    ->withPivot('created_at')
                    ->orderBy('name');
    }
}
