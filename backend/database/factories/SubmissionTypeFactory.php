<?php

namespace Database\Factories;

use App\Models\SubmissionType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class SubmissionTypeFactory extends Factory
{
    protected $model = SubmissionType::class;

    public function definition(): array
    {
        $label = fake()->words(3, true);
        return [
            'id'          => Str::uuid()->toString(),
            'slug'        => Str::slug($label) . '-' . Str::random(4),
            'label'       => ucwords($label),
            'description' => fake()->sentence(),
            'is_active'   => true,
        ];
    }
}
