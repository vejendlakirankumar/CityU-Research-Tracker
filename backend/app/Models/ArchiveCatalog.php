<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class ArchiveCatalog extends Model
{
    use HasUuids;

    protected $table      = 'archive_catalog';
    public $incrementing  = false;
    protected $keyType    = 'string';
    public $timestamps    = false;

    protected $fillable = [
        'submission_id', 'archived_by', 'storage_type', 'storage_path',
        'size_bytes', 'archive_reason', 'restored_at', 'restored_by', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at'  => 'datetime',
            'restored_at' => 'datetime',
            'size_bytes'  => 'integer',
        ];
    }

    public function submission()
    {
        return $this->belongsTo(Submission::class, 'submission_id');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    public function restoredBy()
    {
        return $this->belongsTo(User::class, 'restored_by');
    }
}
