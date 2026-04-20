<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'id'            => Str::uuid()->toString(),
            'name'          => fake()->name(),
            'first_name'    => fake()->firstName(),
            'last_name'     => fake()->lastName(),
            'email'         => fake()->unique()->safeEmail(),
            'password_hash' => bcrypt('password'),
            'roles'         => json_encode(['student']),
            'is_active'     => true,
        ];
    }

    public function admin(): static
    {
        return $this->state(['roles' => json_encode(['admin'])]);
    }

    public function reviewer(): static
    {
        return $this->state(['roles' => json_encode(['reviewer'])]);
    }

    public function student(): static
    {
        return $this->state(['roles' => json_encode(['student'])]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
