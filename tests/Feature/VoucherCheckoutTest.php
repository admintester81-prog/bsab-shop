<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Category;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class VoucherCheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_allows_pickup_without_a_barangay(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Pickup Shop', 'slug' => 'pickup-shop']);
        $category = Category::create(['name' => 'Pickup', 'slug' => 'pickup-test']);
        $product = $this->makeProduct($shop, $category, 'Pickup Product', '250.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 250]);
        $address = $this->shippingAddress();
        unset($address['barangay']);

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $address,
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'pickup',
            ])
            ->assertCreated();

        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertSame('0.00', $order->shipping_fee);
        $this->assertSame('pickup', $order->shipping_address['delivery_option']);
        $this->assertArrayNotHasKey('delivery_zone_id', $order->shipping_address);
    }

    public function test_checkout_allows_pickup_at_an_unconfigured_hinoba_an_location(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Custom Location Shop', 'slug' => 'custom-location-shop']);
        $category = Category::create(['name' => 'Custom Location', 'slug' => 'custom-location-test']);
        $product = $this->makeProduct($shop, $category, 'Custom Location Product', '250.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 250]);
        $address = $this->shippingAddress();
        $address['barangay'] = 'Sitio Upper Purok';

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $address,
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'pickup',
            ])
            ->assertCreated();

        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertSame('Sitio Upper Purok', $order->shipping_address['barangay']);
        $this->assertSame('0.00', $order->shipping_fee);
        $this->assertArrayNotHasKey('delivery_zone_id', $order->shipping_address);
    }

    public function test_checkout_requires_a_valid_barangay_zone_for_delivery(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Delivery Shop', 'slug' => 'delivery-shop']);
        $category = Category::create(['name' => 'Delivery', 'slug' => 'delivery-test']);
        $product = $this->makeProduct($shop, $category, 'Delivery Product', '250.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 250]);
        $this->makeDeliveryZone();
        $address = $this->shippingAddress();
        unset($address['barangay']);

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $address,
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Select a valid barangay delivery zone for delivery, or choose pickup.');
    }

    public function test_product_voucher_only_discounts_eligible_items_and_is_saved_to_order(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Test Shop', 'slug' => 'test-shop']);
        $category = Category::create(['name' => 'Audio', 'slug' => 'audio-test']);
        $eligible = $this->makeProduct($shop, $category, 'Headphones', '1599.00');
        $other = $this->makeProduct($shop, $category, 'Backpack', '999.00');

        $voucher = Voucher::create([
            'name' => 'Headphone discount',
            'code' => 'BSAB100',
            'type' => 'fixed',
            'discount_value' => 100,
            'minimum_spend' => 500,
            'apply_to' => 'products',
            'customer_eligibility' => 'all',
            'is_active' => true,
        ]);
        $voucher->products()->attach($eligible->id);

        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $eligible->id, 'quantity' => 1, 'price_snapshot' => 1599]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $other->id, 'quantity' => 1, 'price_snapshot' => 999]);
        $this->makeDeliveryZone();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/cart/voucher', ['code' => 'BSAB100'])
            ->assertOk()
            ->assertJsonPath('voucher.eligible_subtotal', 1599)
            ->assertJsonPath('voucher.discount', 100);

        $response = $this->postJson('/api/customer/checkout', [
            'shipping_address' => [
                ...$this->shippingAddress(),
            ],
            'payment_method' => 'cash_on_delivery',
            'delivery_option' => 'local_delivery',
        ]);

        $response->assertCreated()->assertJsonStructure(['id', 'order_number']);
        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertSame('2598.00', $order->subtotal);
        $this->assertSame('100.00', $order->discount);
        $this->assertSame('2498.00', $order->total);
        $this->assertSame('BSAB100', $order->voucher_code_snapshot);
        $this->assertDatabaseHas('voucher_usages', [
            'voucher_id' => $voucher->id,
            'order_id' => $order->id,
            'discount_amount' => 100,
            'code_snapshot' => 'BSAB100',
        ]);
    }

    public function test_free_shipping_voucher_waives_configured_zone_delivery_fee(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Shipping Shop', 'slug' => 'shipping-shop']);
        $category = Category::create(['name' => 'Home', 'slug' => 'home-test']);
        $product = $this->makeProduct($shop, $category, 'Desk Lamp', '500.00');
        $voucher = Voucher::create([
            'name' => 'Free express shipping',
            'code' => 'BSABSHIP',
            'type' => 'free_shipping',
            'discount_value' => 0,
            'minimum_spend' => 0,
            'apply_to' => 'all',
            'customer_eligibility' => 'all',
            'free_shipping' => true,
            'is_active' => true,
        ]);
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 500]);
        $this->makeDeliveryZone('75.50');

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/cart/voucher', ['code' => 'BSABSHIP'])
            ->assertOk()
            ->assertJsonPath('voucher.free_shipping', true);

        $this->postJson('/api/customer/checkout', [
            'shipping_address' => [
                ...$this->shippingAddress(),
            ],
            'payment_method' => 'cash_on_delivery',
            'delivery_option' => 'local_delivery',
        ])->assertCreated();

        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertSame('0.00', $order->shipping_fee);
        $this->assertSame('500.00', $order->total);
    }

    public function test_checkout_only_orders_selected_cart_items_and_keeps_the_rest_in_cart(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Selection Shop', 'slug' => 'selection-shop']);
        $category = Category::create(['name' => 'Home', 'slug' => 'selection-home']);
        $selectedProduct = $this->makeProduct($shop, $category, 'Selected Lamp', '500.00');
        $unselectedProduct = $this->makeProduct($shop, $category, 'Saved Blanket', '800.00');

        $cart = Cart::create(['user_id' => $customer->id]);
        $selectedItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $selectedProduct->id,
            'quantity' => 1,
            'price_snapshot' => 500,
        ]);
        $unselectedItem = CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $unselectedProduct->id,
            'quantity' => 1,
            'price_snapshot' => 800,
        ]);
        $this->makeDeliveryZone();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => [
                    ...$this->shippingAddress(),
                ],
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
                'selected_item_ids' => [$selectedItem->id],
            ])
            ->assertCreated()
            ->assertJsonPath('subtotal', '500.00');

        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $selectedProduct->id,
        ]);
        $this->assertDatabaseMissing('order_items', [
            'order_id' => $order->id,
            'product_id' => $unselectedProduct->id,
        ]);
        $this->assertDatabaseMissing('cart_items', ['id' => $selectedItem->id]);
        $this->assertDatabaseHas('cart_items', ['id' => $unselectedItem->id]);
    }

    public function test_checkout_uses_configured_zone_fee_and_free_delivery_minimum(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Local Shop', 'slug' => 'local-shop']);
        $category = Category::create(['name' => 'Farm', 'slug' => 'farm-local']);
        $product = $this->makeProduct($shop, $category, 'Seeds', '800.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 800]);
        $this->makeDeliveryZone('37.25', false, 1000);

        $response = $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $this->shippingAddress(),
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
            ])
            ->assertCreated()
            ->assertJsonPath('shipping_fee', '37.25')
            ->assertJsonPath('total', '837.25');

        $order = Order::query()->where('user_id', $customer->id)->firstOrFail();
        $this->assertSame('Hinoba-an Poblacion', $order->shipping_address['delivery_zone_name']);
        $this->assertSame('Poblacion', $order->shipping_address['barangay']);
        $response->assertJsonPath('shipping_address.delivery_option', 'local_delivery');
    }

    public function test_configured_free_delivery_minimum_waives_local_delivery_fee(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Local Shop', 'slug' => 'local-shop-threshold']);
        $category = Category::create(['name' => 'Farm', 'slug' => 'farm-threshold']);
        $product = $this->makeProduct($shop, $category, 'Seedling Tray', '1200.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 1200]);
        $this->makeDeliveryZone('37.25', true, 1000);

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $this->shippingAddress(),
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
            ])
            ->assertCreated()
            ->assertJsonPath('shipping_fee', '0.00')
            ->assertJsonPath('total', '1200.00');
    }

    public function test_checkout_rejects_unsupported_delivery_barangays(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'Zone Shop', 'slug' => 'zone-shop']);
        $category = Category::create(['name' => 'Farm', 'slug' => 'farm-zone']);
        $product = $this->makeProduct($shop, $category, 'Tools', '100.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 100]);
        $this->makeDeliveryZone();

        $address = $this->shippingAddress();
        $address['barangay'] = 'Unsupported Barangay';

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $address,
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This barangay does not match an active delivery zone. Please contact support.');
    }

    public function test_checkout_explains_when_no_delivery_zones_are_configured(): void
    {
        DeliveryZone::query()->delete();

        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        $seller = User::factory()->create();
        $shop = Shop::create(['user_id' => $seller->id, 'name' => 'No Zone Shop', 'slug' => 'no-zone-shop']);
        $category = Category::create(['name' => 'Farm', 'slug' => 'farm-no-zone']);
        $product = $this->makeProduct($shop, $category, 'No Zone Seeds', '100.00');
        $cart = Cart::create(['user_id' => $customer->id]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'quantity' => 1, 'price_snapshot' => 100]);

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/customer/checkout', [
                'shipping_address' => $this->shippingAddress(),
                'payment_method' => 'cash_on_delivery',
                'delivery_option' => 'local_delivery',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Checkout is unavailable until an active delivery zone and delivery fee are configured.');
    }

    public function test_customer_menu_badge_counts_only_unclaimed_available_vouchers(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');

        $newVoucher = Voucher::create([
            'name' => 'New claimable voucher',
            'code' => 'NEWCLAIM'.strtoupper(uniqid()),
            'type' => 'fixed',
            'discount_value' => 25,
            'requires_claim' => true,
            'is_active' => true,
        ]);
        $claimedVoucher = Voucher::create([
            'name' => 'Already claimed voucher',
            'code' => 'CLAIMED'.strtoupper(uniqid()),
            'type' => 'fixed',
            'discount_value' => 25,
            'requires_claim' => true,
            'is_active' => true,
        ]);
        VoucherClaim::create([
            'voucher_id' => $claimedVoucher->id,
            'user_id' => $customer->id,
            'status' => 'claimed',
            'claimed_at' => now(),
        ]);
        Voucher::create([
            'name' => 'No claim required voucher',
            'code' => 'NOCLAIM'.strtoupper(uniqid()),
            'type' => 'fixed',
            'discount_value' => 25,
            'requires_claim' => false,
            'is_active' => true,
        ]);
        Voucher::create([
            'name' => 'Expired voucher',
            'code' => 'EXPIRED'.strtoupper(uniqid()),
            'type' => 'fixed',
            'discount_value' => 25,
            'requires_claim' => true,
            'is_active' => true,
            'expires_at' => now()->subDay(),
        ]);

        $this->actingAs($customer, 'web')
            ->get('/customer/cart')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/cart')
                ->where('newVoucherCount', 1));
    }

    private function makeProduct(Shop $shop, Category $category, string $name, string $price): Product
    {
        return Product::create([
            'shop_id' => $shop->id,
            'seller_id' => $shop->id,
            'category_id' => $category->id,
            'name' => $name,
            'slug' => strtolower($name).'-'.uniqid(),
            'description' => $name,
            'base_price' => $price,
            'sku' => strtoupper(substr($name, 0, 4)).'-'.uniqid(),
            'stock_quantity' => 10,
            'status' => 'published',
            'is_active' => true,
            'is_approved' => true,
        ]);
    }

    private function shippingAddress(): array
    {
        return [
            'full_name' => 'Test Customer',
            'phone' => '09171234567',
            'barangay' => 'Poblacion',
            'line1' => '123 Main Street',
            'city' => 'Hinoba-an',
            'province' => 'Negros Occidental',
            'postal_code' => '6114',
        ];
    }

    private function makeDeliveryZone(string $fee = '0.00', bool $isFreeDelivery = false, ?float $minimum = null): DeliveryZone
    {
        return DeliveryZone::create([
            'name' => 'Hinoba-an Poblacion',
            'barangay' => 'Poblacion',
            'delivery_fee' => $fee,
            'is_free_delivery' => $isFreeDelivery,
            'free_delivery_minimum' => $minimum,
            'estimated_delivery_text' => 'Same day–2 days',
            'status' => 'active',
        ]);
    }
}