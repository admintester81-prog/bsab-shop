<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VariantAwareCartOwnershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_a_cart_variant_that_does_not_belong_to_the_selected_product(): void
    {
        Role::findOrCreate('customer');

        $user = User::factory()->create();
        $user->assignRole('customer');

        $shop = Shop::create([
            'user_id' => $user->id,
            'name' => 'Acme Shop',
            'slug' => 'acme-shop-'.uniqid(),
            'status' => 'approved',
            'commission_rate' => 10,
        ]);

        $category = Category::create([
            'name' => 'Fashion',
            'slug' => 'fashion-'.uniqid(),
            'image' => null,
        ]);

        $productA = Product::create([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Summer Dress',
            'slug' => 'summer-dress-'.uniqid(),
            'description' => 'A dress',
            'base_price' => 100,
            'sale_price' => null,
            'sku' => 'DRESS-'.uniqid(),
            'stock_quantity' => 10,
            'status' => 'published',
            'is_approved' => true,
            'condition' => 'new',
            'authenticity_status' => 'verified',
            'verification_status' => 'verified',
            'currency' => 'PHP',
        ]);

        $productB = Product::create([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Summer Dress 2',
            'slug' => 'summer-dress-2-'.uniqid(),
            'description' => 'Another dress',
            'base_price' => 100,
            'sale_price' => null,
            'sku' => 'DRESS2-'.uniqid(),
            'stock_quantity' => 10,
            'status' => 'published',
            'is_approved' => true,
            'condition' => 'new',
            'authenticity_status' => 'verified',
            'verification_status' => 'verified',
            'currency' => 'PHP',
        ]);

        $foreignVariant = ProductVariant::create([
            'product_id' => $productB->id,
            'name' => 'Black / M',
            'sku' => 'BLACK-M-'.uniqid(),
            'price' => 100,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/customer/cart/items', [
                'product_id' => $productA->id,
                'variant_id' => $foreignVariant->id,
                'quantity' => 1,
            ]);

        $response->assertStatus(422);
    }

    public function test_cart_quantity_cannot_exceed_the_selected_variant_stock(): void
    {
        Role::findOrCreate('customer');

        $user = User::factory()->create();
        $user->assignRole('customer');
        $shop = Shop::create([
            'user_id' => $user->id,
            'name' => 'Stock Shop',
            'slug' => 'stock-shop-'.uniqid(),
            'status' => 'approved',
            'commission_rate' => 10,
        ]);
        $category = Category::create([
            'name' => 'Stock Category',
            'slug' => 'stock-category-'.uniqid(),
        ]);
        $product = Product::create([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Limited Stock Product',
            'slug' => 'limited-stock-'.uniqid(),
            'description' => 'A product with limited variant stock',
            'base_price' => 100,
            'sku' => 'LIMITED-'.uniqid(),
            'stock_quantity' => 10,
            'status' => 'published',
            'is_approved' => true,
            'condition' => 'new',
            'authenticity_status' => 'verified',
            'verification_status' => 'verified',
            'currency' => 'PHP',
        ]);
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'name' => 'Green / Small',
            'sku' => 'GREEN-S-'.uniqid(),
            'price' => 100,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);
        $cart = Cart::create(['user_id' => $user->id]);
        $item = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => 1,
            'price_snapshot' => 100,
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/customer/cart/items/{$item->id}", ['quantity' => 6])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The requested quantity exceeds available stock.');

        $this->assertSame(1, $item->fresh()->quantity);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/customer/cart/items/{$item->id}", ['quantity' => 5])
            ->assertOk()
            ->assertJsonPath('quantity', 5);
    }
}
