<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkflowDefinition extends Model
{
    protected $table = 'workflow_definitions';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'name',
        'revision_restart_policy', 'final_status_on_pass', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function submissionTypes()
    {
        return $this->hasMany(SubmissionType::class, 'workflow_id');
    }

    public function stages()
    {
        return $this->hasMany(StageDefinition::class, 'workflow_id')->orderBy('order');
    }

    public function workflowRuns()
    {
        return $this->hasMany(WorkflowRun::class, 'workflow_definition_id');
    }
}
