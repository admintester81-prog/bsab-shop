<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\SharingAgentProductsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SharingAgentProductsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_products_reference_their_shop_for_seller_id(): void
    {
        $existingSeller = User::factory()->create();
        Shop::create([
            'id' => 50,
            'user_id' => $existingSeller->id,
            'name' => 'Existing shop',
            'slug' => 'existing-shop',
        ]);

        $this->seed(SharingAgentProductsSeeder::class);

        $shop = Shop::query()->where('slug', 'sharingagent')->firstOrFail();
        $this->assertDatabaseHas('products', [
            'shop_id' => $shop->id,
            'seller_id' => $shop->id,
        ]);
        $this->assertSame(20, $shop->products()->count());

        $agriculture = Category::query()->where('slug', 'agriculture')->firstOrFail();
        $this->assertSame(10, $agriculture->children()->count());
        $this->assertSame(
            'Seeds & Seedlings',
            Category::query()->where('slug', 'seeds-seedlings')->value('name'),
        );
        $this->assertDatabaseHas('products', [
            'shop_id' => $shop->id,
            'name' => 'Hybrid Tomato Seeds',
            'category_id' => Category::query()->where('slug', 'seeds-seedlings')->value('id'),
        ]);
        $this->assertSame(
            0,
            $shop->products()->whereHas('category', fn ($query) => $query->whereNull('parent_id'))->count(),
        );

        $shop->products()->with(['images', 'variants.optionValues'])->get()->each(function ($product): void {
            $this->assertCount(5, $product->images);
            $this->assertSame(1, $product->images->where('is_primary', true)->count());
            $this->assertCount(3, $product->variants);
            $this->assertCount(3, $product->variants->pluck('name')->unique());
            $this->assertTrue($product->variants->every(fn ($variant) => $variant->optionValues->isNotEmpty()));
        });

        $this->seed(SharingAgentProductsSeeder::class);

        $shop->products()->get()->each(function ($product): void {
            $this->assertSame(5, $product->images()->count());
            $this->assertSame(3, $product->variants()->count());
        });
    }
}
