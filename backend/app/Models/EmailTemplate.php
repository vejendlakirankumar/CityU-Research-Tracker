<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailTemplate extends Model
{
    use HasUuids;

    protected $table = 'email_templates';

    protected $fillable = [
        'name', 'subject', 'body_html', 'body_text', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Variables that may be used inside a template subject/body. Substituted at send time.
     */
    public static function availableVariables(): array
    {
        return [
            '{{student_name}}',
            '{{submission_title}}',
            '{{submission_id}}',
            '{{sender_name}}',
            '{{portal_url}}',
        ];
    }
}
