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

class AdminOrderStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_order_status_updates_sync_all_seller_fulfillment_items(): void
    {
        Role::findOrCreate('admin', 'web');
        Role::findOrCreate('customer', 'web');

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create([
            'user_id' => $seller->id,
            'name' => 'Status Test Shop',
            'slug' => 'status-test-shop',
        ]);
        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Status Test Product',
            'slug' => 'status-test-product',
            'base_price' => 10,
            'sku' => 'STATUS-TEST-PRODUCT',
        ]);
        $order = Order::create([
            'order_number' => 'STATUS-TEST-ORDER',
            'user_id' => $customer->id,
            'shipping_address' => ['line1' => 'Main Street'],
        ]);

        foreach ([1, 2] as $quantity) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'shop_id' => $shop->id,
                'quantity' => $quantity,
                'unit_price' => 10,
                'total_price' => 10 * $quantity,
                'fulfillment_status' => 'processing',
            ]);
        }

        $statusMappings = [
            'pending' => 'processing',
            'processing' => 'processing',
            'accepted' => 'accepted',
            'shipped' => 'shipped',
            'cancelled' => 'cancelled',
        ];

        foreach ($statusMappings as $orderStatus => $fulfillmentStatus) {
            $this->actingAs($admin)
                ->patchJson("/api/admin/orders/{$order->id}", ['status' => $orderStatus])
                ->assertOk()
                ->assertJsonPath('status', $orderStatus)
                ->assertJsonPath('items.0.fulfillment_status', $fulfillmentStatus)
                ->assertJsonPath('items.1.fulfillment_status', $fulfillmentStatus);

            $this->assertDatabaseHas('order_items', [
                'order_id' => $order->id,
                'fulfillment_status' => $fulfillmentStatus,
            ]);
        }

        $this->actingAs($admin)
            ->patchJson("/api/admin/orders/{$order->id}", ['status' => 'delivered'])
            ->assertStatus(422);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'cancelled',
        ]);

        $this->actingAs($customer)
            ->getJson('/api/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'cancelled');
    }
}
