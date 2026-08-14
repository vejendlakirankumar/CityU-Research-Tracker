<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ResearchTemplate extends Model
{
    protected $table = 'research_templates';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'name', 'description', 'filename', 'path', 'mime_type', 'size_bytes', 'uploaded_by',
    ];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    /**
     * Submission categories this template is attached to.
     */
    public function submissionTypes(): BelongsToMany
    {
        return $this->belongsToMany(
            SubmissionType::class,
            'research_template_submission_type',
            'research_template_id',
            'submission_type_id'
        )->withPivot('created_at')->orderBy('label');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
