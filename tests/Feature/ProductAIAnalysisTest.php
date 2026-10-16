<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductAIAnalysisTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_can_analyze_a_product_image_and_receive_normalized_suggestions(): void
    {
        Role::findOrCreate('seller');
        $user = User::factory()->create();
        $user->assignRole('seller');
        $category = Category::create([
            'name' => 'Shoes',
            'slug' => 'shoes-'.uniqid(),
            'image' => null,
        ]);
            config(['services.ollama.base_url' => 'http://127.0.0.1:11434']);
            config(['services.ollama.vision_model' => 'qwen2.5vl:3b']);

            Http::fake([
                'http://127.0.0.1:11434/api/chat' => Http::response([
                    'message' => [
                        'content' => json_encode([
                            'name' => 'Trail Runner',
                            'category' => 'Shoes',
                            'brand' => 'Northline',
                            'colors' => ['Black'],
                            'options' => [['name' => 'Size', 'values' => ['8', '9']]],
                        ]),
                    ],
                ]),
            ]);

            $response = $this->actingAs($user, 'web')->post('/seller/products/ai-analyze', [
                'image' => $this->productImage(),
            ]);

            $response->assertOk()
                ->assertJsonPath('success', true)
                ->assertJsonPath('data.name', 'Trail Runner')
                ->assertJsonPath('data.brand', 'Northline')
                ->assertJsonPath('data.category_id', $category->id)
                ->assertJsonPath('data.options.0.name', 'Size')
                ->assertJsonPath('data.options.0.values.1', '9');

            Http::assertSent(fn ($request) => str_contains($request->url(), 'http://127.0.0.1:11434/api/chat')
                && isset($request['model'])
                && $request['model'] === 'qwen2.5vl:3b'
                && $request['options']['num_ctx'] === 2048
                && $request['options']['num_predict'] === 512);
        }

        public function test_ollama_permission_errors_return_actionable_guidance(): void
        {
            Role::findOrCreate('seller');
            $user = User::factory()->create();
            $user->assignRole('seller');
            config(['services.ollama.base_url' => 'http://127.0.0.1:11434']);
            config(['services.ollama.vision_model' => 'qwen2.5vl:3b']);

            Http::fake([
                'http://127.0.0.1:11434/api/chat' => Http::response([
                    'error' => 'model not found',
                ], 404),
            ]);

            $response = $this->actingAs($user, 'web')->post('/seller/products/ai-analyze', [
                'image' => $this->productImage(),
            ]);

            $response->assertUnprocessable()
                ->assertJsonPath('success', false)
                ->assertJsonPath('message', 'Ollama could not find the configured vision model. Pull the model locally or update OLLAMA_VISION_MODEL.');
        }

    private function productImage(): UploadedFile
    {
        return new UploadedFile(
            base_path('public/images/sneakers/sneaker-top.jpg'),
            'trail-runner.jpg',
            'image/jpeg',
            null,
            true,
        );
    }
}