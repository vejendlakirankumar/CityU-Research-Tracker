<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class BackupCatalog extends Model
{
    use HasUuids;

    protected $table      = 'backup_catalog';
    public $incrementing  = false;
    protected $keyType    = 'string';
    public $timestamps    = false;

    protected $fillable = [
        'filename', 'storage_type', 'storage_path', 'size_bytes',
        'checksum_sha256', 'status', 'notes', 'created_by',
        'restored_at', 'restored_by', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at'  => 'datetime',
            'restored_at' => 'datetime',
            'size_bytes'  => 'integer',
        ];
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function restoredBy()
    {
        return $this->belongsTo(User::class, 'restored_by');
    }
}
