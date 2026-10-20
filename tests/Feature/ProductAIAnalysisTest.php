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

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.api_key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-3.6-flash',
        ]);
    }

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

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent' => Http::response([
                'candidates' => [[
                    'content' => [
                        'parts' => [[
                            'text' => json_encode([
                                'name' => 'Trail Runner',
                                'category' => 'Shoes',
                                'brand' => 'Northline',
                                'colors' => ['Black'],
                                'options' => [['name' => 'Size', 'values' => ['8', '9']]],
                            ]),
                        ]],
                    ],
                ]],
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

        Http::assertSent(fn ($request) => str_contains($request->url(), 'generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent')
            && $request->hasHeader('x-goog-api-key', 'test-gemini-key')
            && $request['generationConfig']['responseMimeType'] === 'application/json'
            && $request['contents'][0]['parts'][0]['text'] !== ''
            && $request['contents'][0]['parts'][1]['inline_data']['mime_type'] === 'image/jpeg');
    }

    public function test_gemini_api_errors_return_actionable_guidance(): void
    {
        Role::findOrCreate('seller');
        $user = User::factory()->create();
        $user->assignRole('seller');

        Http::fake([
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent' => Http::response([
                'error' => ['message' => 'The configured Gemini model is unavailable.'],
            ], 404),
        ]);

        $response = $this->actingAs($user, 'web')->post('/seller/products/ai-analyze', [
            'image' => $this->productImage(),
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'The configured Gemini model is unavailable.');
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