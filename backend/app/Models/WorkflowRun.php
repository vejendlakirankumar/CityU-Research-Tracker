<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkflowRun extends Model
{
    protected $table = 'workflow_runs';
    public $incrementing = false;
    protected $keyType = 'string';

    /**
     * Explicit fillable list — prevents mass-assignment of internal columns
     * (status, completed_at) from user-controlled input.
     */
    protected $fillable = [
        'submission_id',
        'workflow_definition_id',
        'version_number',
        'status',
        'started_at',
        'completed_at',
    ];

    public function workflowDefinition()
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }
}
