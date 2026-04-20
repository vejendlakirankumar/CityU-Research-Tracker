<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class OrganizationSetting extends Model
{
    protected $table = 'organization_settings';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = [
        'org_name', 'portal_name', 'org_short_name', 'logo_path', 'favicon_path',
        'primary_color', 'accent_color', 'timezone', 'locale',
        'date_format', 'footer_text', 'support_email',
        'allow_public_registration', 'archive_after_days',
        'max_file_size_mb_global', 'backup_retention_days',
    ];

    protected function casts(): array
    {
        return [
            'allow_public_registration' => 'boolean',
        ];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'org_name' => 'Research Review Portal',
        ]);
    }
}
