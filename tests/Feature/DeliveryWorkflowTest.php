<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DeliveryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_requires_a_photo_and_customer_confirmation_before_order_completion(): void
    {
        Storage::fake('local');
        [$admin, $rider, $customer, $order] = $this->createShippedOrder();

        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$order->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();

        $delivery = Delivery::query()->where('order_id', $order->id)->firstOrFail();

        $this->actingAs($rider)->post("/delivery-list/{$delivery->id}/start")->assertRedirect();
        $this->actingAs($rider)->post("/delivery-list/{$delivery->id}/arrive")->assertRedirect();

        $this->actingAs($rider)
            ->post("/delivery-list/{$delivery->id}/submit", [])
            ->assertSessionHasErrors('proof');

        $this->actingAs($rider)
            ->post("/delivery-list/{$delivery->id}/submit", [
                'proof' => UploadedFile::fake()->createWithContent(
                    'delivery.png',
                    base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZ8AAAAASUVORK5CYII='),
                ),
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('deliveries', [
            'id' => $delivery->id,
            'status' => 'delivered',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'shipped',
        ]);

        $this->actingAs($customer)
            ->post("/delivery-list/{$delivery->id}/confirm-received")
            ->assertRedirect();

        $this->assertDatabaseHas('deliveries', [
            'id' => $delivery->id,
            'status' => 'completed',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'delivered',
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'fulfillment_status' => 'delivered',
        ]);
        $this->actingAs($customer)
            ->post("/delivery-list/{$delivery->id}/confirm-received")
            ->assertStatus(422);
    }

    public function test_seller_delivery_view_contains_only_the_sellers_own_order_items(): void
    {
        [$admin, $rider, $customer, $sellerOrder] = $this->createShippedOrder();
        $otherSeller = User::factory()->create(['role' => 'seller']);
        $otherShop = Shop::create([
            'user_id' => $otherSeller->id,
            'name' => 'Other Shop',
            'slug' => 'other-shop',
        ]);
        $otherProduct = Product::create([
            'shop_id' => $otherShop->id,
            'name' => 'Other Product',
            'slug' => 'other-product',
            'base_price' => 8,
            'sku' => 'OTHER-PRODUCT',
        ]);
        $otherOrder = Order::create([
            'order_number' => 'OTHER-SELLER-ORDER',
            'user_id' => $customer->id,
            'status' => 'shipped',
            'shipping_address' => ['line1' => 'Other Street'],
        ]);
        OrderItem::create([
            'order_id' => $otherOrder->id,
            'product_id' => $otherProduct->id,
            'shop_id' => $otherShop->id,
            'quantity' => 1,
            'unit_price' => 8,
            'total_price' => 8,
            'fulfillment_status' => 'shipped',
        ]);

        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$sellerOrder->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();

        $this->actingAs($otherSeller)
            ->get('/delivery-list')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('delivery-list')
                ->where('role', 'seller')
                ->has('sellerOrders', 1)
                ->where('sellerOrders.0.order_number', 'OTHER-SELLER-ORDER')
                ->has('deliveries', 0)
                ->missing('deliveries.0.order.address'));
    }

    public function test_delivery_details_include_saved_seller_location_coordinates(): void
    {
        [$admin, $rider, , $order, $seller] = $this->createShippedOrder();
        Address::create([
            'user_id' => $seller->id,
            'label' => 'Shop',
            'full_name' => $seller->name,
            'phone' => '09170000000',
            'line1' => 'Farm Road',
            'city' => 'Hinoba-an',
            'province' => 'Negros Occidental',
            'postal_code' => '6114',
            'latitude' => 9.5901,
            'longitude' => 122.4671,
            'is_default' => true,
        ]);
        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$order->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();

        $this->actingAs($rider)
            ->get('/delivery-list')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('delivery-list')
                ->where('deliveries.0.order.items.0.seller_location.latitude', 9.5901)
                ->where('deliveries.0.order.items.0.seller_location.longitude', 122.4671)
                ->where('deliveries.0.order.items.0.seller_location.label', 'Fresh Farm, Farm Road, Hinoba-an, Negros Occidental, 6114'));
    }

    public function test_seller_can_assign_logistics_after_all_active_order_items_are_accepted(): void
    {
        [, $rider, , $order, $seller] = $this->createShippedOrder();
        $order->items()->update(['fulfillment_status' => 'processing']);

        $this->actingAs($seller)
            ->postJson("/api/seller/orders/{$order->id}/assign-logistics", ['rider_id' => $rider->id])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Accept all active order items before assigning logistics.');

        $order->items()->update(['fulfillment_status' => 'accepted']);

        $this->actingAs($seller)
            ->postJson("/api/seller/orders/{$order->id}/assign-logistics", ['rider_id' => $rider->id])
            ->assertOk()
            ->assertJsonPath('delivery.status', 'ready')
            ->assertJsonPath('delivery.rider.id', $rider->id);

        $this->assertDatabaseHas('deliveries', [
            'order_id' => $order->id,
            'rider_id' => $rider->id,
            'status' => 'ready',
        ]);
    }

    public function test_seller_cannot_assign_logistics_to_an_order_their_shop_does_not_sell(): void
    {
        [, $rider, , $order] = $this->createShippedOrder();
        $otherSeller = User::factory()->create(['role' => 'seller']);
        Shop::create([
            'user_id' => $otherSeller->id,
            'name' => 'Unrelated Shop',
            'slug' => 'unrelated-shop',
        ]);

        $this->actingAs($otherSeller)
            ->postJson("/api/seller/orders/{$order->id}/assign-logistics", ['rider_id' => $rider->id])
            ->assertForbidden();

        $this->assertDatabaseMissing('deliveries', ['order_id' => $order->id]);
    }

    public function test_customer_order_tracking_includes_safe_delivery_progress(): void
    {
        [$admin, $rider, $customer, $order] = $this->createShippedOrder();
        Role::findOrCreate('customer', 'web');
        $customer->assignRole('customer');

        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$order->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();
        $delivery = Delivery::query()->where('order_id', $order->id)->firstOrFail();
        $this->actingAs($rider)->post("/delivery-list/{$delivery->id}/start")->assertRedirect();
        $this->actingAs($rider)->post("/delivery-list/{$delivery->id}/arrive")->assertRedirect();

        $this->actingAs($customer)
            ->getJson('/api/customer/orders')
            ->assertOk()
            ->assertJsonPath('data.0.delivery_tracking.status', 'arrived')
            ->assertJsonPath('data.0.delivery_tracking.rider.name', $rider->name)
            ->assertJsonMissingPath('data.0.delivery.proof_path');
    }

    public function test_assigned_rider_can_share_live_location_with_delivery_participants(): void
    {
        [$admin, $rider, $customer, $order] = $this->createShippedOrder();
        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$order->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();
        $delivery = Delivery::query()->where('order_id', $order->id)->firstOrFail();
        $this->actingAs($rider)->post("/delivery-list/{$delivery->id}/start")->assertRedirect();

        $this->actingAs($rider)
            ->postJson("/api/deliveries/{$delivery->id}/location", [
                'latitude' => 9.5901,
                'longitude' => 122.4671,
            ])
            ->assertOk()
            ->assertJsonPath('latitude', 9.5901)
            ->assertJsonPath('longitude', 122.4671);

        $this->actingAs($customer)
            ->getJson("/api/deliveries/{$delivery->id}/location")
            ->assertOk()
            ->assertJsonPath('latitude', 9.5901)
            ->assertJsonPath('longitude', 122.4671);

        $this->actingAs(User::factory()->create(['role' => 'customer']))
            ->getJson("/api/deliveries/{$delivery->id}/location")
            ->assertForbidden();
    }

    public function test_only_the_assigned_rider_can_start_a_delivery(): void
    {
        [$admin, $rider, , $order] = $this->createShippedOrder();
        $otherRider = User::factory()->create(['role' => 'rider']);

        $this->actingAs($admin)
            ->post("/delivery-list/orders/{$order->id}/assign", ['rider_id' => $rider->id])
            ->assertRedirect();
        $delivery = Delivery::query()->where('order_id', $order->id)->firstOrFail();

        $this->actingAs($otherRider)
            ->post("/delivery-list/{$delivery->id}/start")
            ->assertForbidden();

        $this->actingAs($otherRider)
            ->get('/delivery-list')
            ->assertInertia(fn (Assert $page) => $page
                ->component('delivery-list')
                ->has('deliveries', 0));

        $this->assertDatabaseHas('deliveries', [
            'id' => $delivery->id,
            'status' => 'ready',
        ]);
    }

    public function test_only_an_admin_can_create_a_logistics_account(): void
    {
        Role::findOrCreate('admin', 'web');
        Role::findOrCreate('seller', 'web');

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $seller = User::factory()->create();
        $seller->assignRole('seller');
        $accountData = [
            'name' => 'Delivery Logistics',
            'email' => 'logistics@example.test',
            'password' => 'LogisticsPass123!',
            'password_confirmation' => 'LogisticsPass123!',
            'role' => 'rider',
            'status' => 'active',
        ];

        $this->actingAs($seller)
            ->post('/admin/users', $accountData)
            ->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => $accountData['email']]);

        $this->actingAs($admin)
            ->post('/admin/users', $accountData)
            ->assertRedirect('/admin/users');

        $this->assertDatabaseHas('users', [
            'email' => $accountData['email'],
            'role' => 'rider',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('roles', ['name' => 'rider', 'guard_name' => 'web']);
    }

    public function test_logistics_account_is_redirected_to_delivery_list_after_login(): void
    {
        Role::findOrCreate('rider', 'web');
        $rider = User::factory()->create(['role' => 'rider']);
        $rider->assignRole('rider');

        $this->post('/login', [
            'email' => $rider->email,
            'password' => 'password',
        ])->assertRedirect('/delivery-list');
    }

    public function test_logistics_dashboard_fallback_opens_delivery_list(): void
    {
        Role::findOrCreate('rider', 'web');
        $rider = User::factory()->create(['role' => 'rider']);
        $rider->assignRole('rider');

        $this->actingAs($rider)
            ->get('/dashboard')
            ->assertRedirect('/delivery-list');
    }

    private function createShippedOrder(): array
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $rider = User::factory()->create(['role' => 'rider']);
        $customer = User::factory()->create(['role' => 'customer']);
        $seller = User::factory()->create(['role' => 'seller']);
        Role::findOrCreate('seller', 'web');
        $seller->assignRole('seller');
        $shop = Shop::create([
            'user_id' => $seller->id,
            'name' => 'Fresh Farm',
            'slug' => 'fresh-farm',
        ]);
        $product = Product::create([
            'shop_id' => $shop->id,
            'name' => 'Fresh lettuce',
            'slug' => 'fresh-lettuce',
            'base_price' => 50,
            'sku' => 'FRESH-LETTUCE',
        ]);
        $order = Order::create([
            'order_number' => 'DELIVERY-TEST-ORDER',
            'user_id' => $customer->id,
            'status' => 'shipped',
            'total' => 50,
            'shipping_address' => ['line1' => 'Market Road', 'city' => 'San Jose'],
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'shop_id' => $shop->id,
            'quantity' => 1,
            'unit_price' => 50,
            'total_price' => 50,
            'fulfillment_status' => 'shipped',
        ]);

        return [$admin, $rider, $customer, $order, $seller];
    }
}
