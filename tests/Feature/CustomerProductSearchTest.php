<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerProductSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_products_page_receives_the_search_query_from_the_url(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');

        $response = $this->actingAs($customer)
            ->get(route('customer.products', ['q' => 'phone case']));

        $response->assertOk()->assertSee('phone case');
    }

    public function test_search_api_returns_only_published_matching_products_and_applies_price_filters(): void
    {
        config(['services.gemini.api_key' => null]);
        $matching = $this->makeProduct('Men jacket', 499, 399);
        $other = $this->makeProduct('Canvas tote bag', 180);
        $other->update(['stock_quantity' => 0]);
        $unpublished = $this->makeProduct('Men jacket draft', 250);
        $unpublished->update(['status' => 'pending', 'is_approved' => false]);

        $this->getJson('/api/products/search?q=jacket&price_range=251-500')
            ->assertOk()
            ->assertJsonPath('products.total', 1)
            ->assertJsonPath('products.data.0.id', $matching->id)
            ->assertJsonPath('products.data.0.discount_percentage', 20);

        $this->getJson('/api/products/search?'.http_build_query(['q' => 'jacket for men']))
            ->assertOk()
            ->assertJsonPath('products.total', 1)
            ->assertJsonPath('products.data.0.id', $matching->id);

        $this->getJson('/api/products/search?q=jacket&category='.$matching->category()->value('slug').'&seller='.$matching->shop_id.'&discount=true')
            ->assertOk()
            ->assertJsonPath('products.total', 1)
            ->assertJsonPath('products.data.0.id', $matching->id);

        $this->getJson('/api/products/search?q=tote')
            ->assertOk()
            ->assertJsonPath('products.total', 1)
            ->assertJsonPath('products.data.0.id', $other->id);

        $this->getJson('/api/products/search?q=tote&availability=false&discount=false')
            ->assertOk()
            ->assertJsonPath('products.total', 1)
            ->assertJsonPath('products.data.0.id', $other->id);

        $this->getJson('/api/products/search?q=tote&availability=true')
            ->assertOk()
            ->assertJsonPath('products.total', 0);
    }

    public function test_authenticated_customer_can_save_read_and_clear_search_history(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');

        $this->actingAs($customer)
            ->postJson('/api/customer/search-history', ['query' => 'jacket'])
            ->assertOk()
            ->assertJsonPath('data.0', 'jacket');

        $this->actingAs($customer)
            ->postJson('/api/customer/search-history', ['query' => 'customer@example.com'])
            ->assertStatus(422);

        $this->actingAs($customer)
            ->getJson('/api/customer/search-history')
            ->assertOk()
            ->assertJsonPath('data.0', 'jacket');

        $this->getJson('/api/products/search?q=unavailable')
            ->assertOk()
            ->assertJsonPath('popular_searches', [])
            ->assertJsonPath('trending_searches', []);

        $this->actingAs($customer)
            ->deleteJson('/api/customer/search-history')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    private function makeProduct(string $name, int $price, ?int $salePrice = null): Product
    {
        $seller = User::factory()->create();
        $shop = Shop::create([
            'user_id' => $seller->id,
            'name' => 'Search Test Shop',
            'slug' => 'search-test-shop-'.$seller->id,
        ]);
        $category = Category::create([
            'name' => 'Men’s Fashion',
            'slug' => 'mens-fashion-'.$seller->id,
        ]);

        return Product::create([
            'shop_id' => $shop->id,
            'seller_id' => $shop->id,
            'category_id' => $category->id,
            'name' => $name,
            'slug' => 'search-product-'.$seller->id,
            'description' => 'A published search test product.',
            'base_price' => $price,
            'sale_price' => $salePrice,
            'sku' => 'SEARCH-'.$seller->id,
            'stock_quantity' => 5,
            'status' => 'published',
            'is_approved' => true,
        ]);
    }
}
