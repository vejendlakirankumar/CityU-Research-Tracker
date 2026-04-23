<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StageDefinition extends Model
{
    protected $table = 'stage_definitions';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'workflow_id', 'name', 'order', 'stage_role_label', 'template_id',
        'is_gatekeeper', 'execution_type', 'approval_strategy', 'min_approvals',
        'is_anonymous', 'due_days', 'visibility_config', 'escalation_config',
        'decision_options', 'skip_condition', 'auto_assignment',
    ];

    protected function casts(): array
    {
        return [
            'is_gatekeeper'     => 'boolean',
            'is_anonymous'      => 'boolean',
            'visibility_config' => 'array',
            'escalation_config' => 'array',
            'decision_options'  => 'array',
            'skip_condition'    => 'array',
            'auto_assignment'   => 'array',
        ];
    }

    public function workflow()
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_id');
    }
}
