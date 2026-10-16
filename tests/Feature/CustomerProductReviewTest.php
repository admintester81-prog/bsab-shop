<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerProductReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_submit_and_update_a_rating_for_a_delivered_order_item(): void
    {
        [$customer, $item] = $this->createOrderItem('delivered');

        $this->actingAs($customer)
            ->postJson("/api/customer/order-items/{$item->id}/review", ['rating' => 4])
            ->assertOk()
            ->assertJsonPath('rating', 4);

        $this->assertDatabaseHas('reviews', [
            'user_id' => $customer->id,
            'order_item_id' => $item->id,
            'product_id' => $item->product_id,
            'rating' => 4,
        ]);

        $this->actingAs($customer)
            ->postJson("/api/customer/order-items/{$item->id}/review", ['rating' => 5])
            ->assertOk()
            ->assertJsonPath('rating', 5);

        $this->assertDatabaseCount('reviews', 1);

        $this->actingAs($customer)
            ->getJson('/api/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.0.items.0.review.rating', 5);
    }

    public function test_customer_cannot_rate_an_order_item_before_delivery(): void
    {
        [$customer, $item] = $this->createOrderItem('shipped');

        $this->actingAs($customer)
            ->postJson("/api/customer/order-items/{$item->id}/review", ['rating' => 5])
            ->assertUnprocessable();

        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_customer_cannot_rate_another_customers_order_item(): void
    {
        [, $item] = $this->createOrderItem('delivered');
        $otherCustomer = User::factory()->create();
        $otherCustomer->assignRole('customer');

        $this->actingAs($otherCustomer)
            ->postJson("/api/customer/order-items/{$item->id}/review", ['rating' => 5])
            ->assertForbidden();

        $this->assertDatabaseCount('reviews', 0);
    }

    public function test_rating_must_be_between_one_and_five_stars(): void
    {
        [$customer, $item] = $this->createOrderItem('delivered');

        $this->actingAs($customer)
            ->postJson("/api/customer/order-items/{$item->id}/review", ['rating' => 6])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rating');
    }

    private function createOrderItem(string $fulfillmentStatus): array
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create([
            'user_id' => $seller->id,
            'name' => 'Rating Test Shop',
            'slug' => 'rating-test-shop-'.$seller->id,
        ]);
        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Rating Test Product',
            'slug' => 'rating-test-product-'.$seller->id,
            'base_price' => 10,
            'sku' => 'RATING-TEST-'.$seller->id,
        ]);
        $order = Order::create([
            'order_number' => 'RATING-ORDER-'.$customer->id,
            'user_id' => $customer->id,
            'shipping_address' => ['line1' => 'Main Street'],
        ]);
        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'shop_id' => $shop->id,
            'quantity' => 1,
            'unit_price' => 10,
            'total_price' => 10,
            'fulfillment_status' => $fulfillmentStatus,
        ]);

        return [$customer, $item];
    }
}
