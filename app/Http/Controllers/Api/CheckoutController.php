<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Shop;
use App\Models\SiteSetting;
use App\Models\Voucher;
use App\Services\ImageOptimizationService;
use App\Services\VoucherService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CheckoutController extends Controller
{
    public function store(Request $request, ImageOptimizationService $images, VoucherService $vouchers)
    {
        $shippingAddress = $request->input('shipping_address');

        if (is_string($shippingAddress)) {
            $shippingAddress = json_decode($shippingAddress, true);
        }

        $selectedItemIds = $request->input('selected_item_ids');
        if (is_string($selectedItemIds)) {
            $selectedItemIds = json_decode($selectedItemIds, true);
        }

        $request->merge(['shipping_address' => $shippingAddress, 'selected_item_ids' => $selectedItemIds]);

        $validated = Validator::make($request->all(), [
            'shipping_address' => 'required|array',
            'shipping_address.full_name' => 'required|string|max:255',
            'shipping_address.phone' => 'required|string|max:50',
            'shipping_address.line1' => 'required|string|max:255',
            'shipping_address.barangay' => 'nullable|string|max:150',
            'shipping_address.house_number' => 'nullable|string|max:255',
            'shipping_address.delivery_instructions' => 'nullable|string|max:1000',
            'shipping_address.city' => 'required|string|max:255',
            'shipping_address.province' => 'required|string|max:255',
            'shipping_address.postal_code' => 'nullable|string|max:20',
            'payment_method' => 'required|string|in:cash_on_delivery,gcash',
            'delivery_option' => 'required|string|in:local_delivery,seller_delivery,pickup',
            'selected_item_ids' => 'nullable|array|min:1',
            'selected_item_ids.*' => 'integer|distinct',
            'gcash_receipt' => ['nullable', 'required_if:payment_method,gcash', 'file', 'image', 'max:'.config('images.max_upload_kb')],
        ])->validate();

        $gcashReceiptPath = null;
        if ($request->hasFile('gcash_receipt')) {
            $gcashReceiptPath = $images->store($request->file('gcash_receipt'), 'gcash-receipts', ['max_dimension' => config('images.promotion_max_dimension')]);
        }

        $order = DB::transaction(function () use ($request, $validated, $gcashReceiptPath, $vouchers) {
            $cart = Cart::where('user_id', $request->user()->id)->lockForUpdate()->firstOrFail();
            $cart->load('items.product.shop', 'items.product.category', 'items.variant', 'voucher');
            abort_if($cart->items->isEmpty(), 422, 'Your cart is empty.');

            $items = $validated['selected_item_ids'] ?? $cart->items->modelKeys();
            abort_if(array_diff($items, $cart->items->modelKeys()), 422, 'One or more selected cart items are invalid.');
            $checkoutItems = $cart->items->whereIn('id', $items)->values();
            abort_if($checkoutItems->isEmpty(), 422, 'Select at least one cart item.');

            $address = $validated['shipping_address'];
            abort_unless(
                mb_strtolower(trim($address['city'])) === 'hinoba-an'
                    && mb_strtolower(trim($address['province'])) === 'negros occidental',
                422,
                'Checkout is currently available only in Hinoba-an, Negros Occidental.'
            );

            $deliveryOptions = SiteSetting::homeSettings()['shipping_options'];
            abort_unless(
                (bool) ($deliveryOptions[$validated['delivery_option']] ?? false),
                422,
                'This delivery option is currently unavailable.'
            );

            $zone = filled($address['barangay'] ?? null)
                ? DeliveryZone::query()
                    ->active()
                    ->whereRaw('LOWER(barangay) = ?', [mb_strtolower(trim($address['barangay']))])
                    ->first()
                : null;
            if ($validated['delivery_option'] !== 'pickup') {
                if (! $zone) {
                    $hasActiveZones = DeliveryZone::active()->exists();
                    $message = ! $hasActiveZones
                        ? 'Checkout is unavailable until an active delivery zone and delivery fee are configured.'
                        : (filled($address['barangay'] ?? null)
                            ? 'This barangay does not match an active delivery zone. Please contact support.'
                            : 'Select a valid barangay delivery zone for delivery, or choose pickup.');

                    abort(422, $message);
                }
            }

            if ($validated['payment_method'] === 'gcash') {
                $shopIds = $checkoutItems->pluck('product.shop_id')->filter()->unique()->values();

                foreach ($shopIds as $shopId) {
                    $shop = Shop::find($shopId);

                    abort_unless(
                        $shop && $shop->gcash_enabled && $shop->gcash_account_name && $shop->gcash_mobile_number && $shop->gcash_qr_code,
                        422,
                        'One or more sellers have not completed their GCash setup yet.'
                    );
                }
            }

            $subtotal = $checkoutItems->sum(fn ($item) => (float) $item->price_snapshot * $item->quantity);
            $voucher = $cart->voucher ? Voucher::query()->lockForUpdate()->findOrFail($cart->voucher_id) : null;
            $voucherQuote = $voucher ? $vouchers->quote($voucher, $request->user(), $checkoutItems) : null;
            $discount = $voucherQuote['discount'] ?? 0;
            $freeByThreshold = $zone && $zone->is_free_delivery
                && ($zone->free_delivery_minimum === null || $subtotal >= (float) $zone->free_delivery_minimum);
            $shippingFee = $validated['delivery_option'] === 'pickup' || $freeByThreshold
                ? 0
                : (float) $zone->delivery_fee;
            if ($voucherQuote['free_shipping'] ?? false) {
                $shippingFee = 0;
            }
            $total = max(0, $subtotal + $shippingFee - $discount);
            if ($zone) {
                $address['delivery_zone_id'] = $zone->id;
                $address['delivery_zone_name'] = $zone->name;
                $address['delivery_estimate'] = $zone->estimated_delivery_text;
            }
            $address['delivery_option'] = $validated['delivery_option'];

            $order = Order::create([
                'order_number' => 'CG-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'user_id' => $request->user()->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'shipping_fee' => $shippingFee,
                'voucher_id' => $voucher?->id,
                'voucher_code_snapshot' => $voucher?->code,
                'voucher_name_snapshot' => $voucher?->name,
                'total' => $total,
                'shipping_address' => $address,
                'payment_method' => $validated['payment_method'],
                'payment_status' => 'pending',
            ]);

            foreach ($checkoutItems as $item) {
                $product = $item->product()->lockForUpdate()->first();
                $variant = $item->variant()->lockForUpdate()->first();

                if ($variant) {
                    abort_unless($variant->is_active, 422, "Selected variant for {$product->name} is unavailable.");
                    abort_if($variant->stock_quantity < $item->quantity, 422, "Insufficient stock for variant {$variant->name}.");
                    $variant->decrement('stock_quantity', $item->quantity);
                } else {
                    abort_if($product->stock_quantity < $item->quantity, 422, "Insufficient stock for {$product->name}.");
                    $product->decrement('stock_quantity', $item->quantity);
                }

                $order->items()->create([
                    'product_id' => $product->id,
                    'shop_id' => $product->shop_id,
                    'variant_id' => $item->variant_id,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->price_snapshot,
                    'total_price' => $item->price_snapshot * $item->quantity,
                ]);
            }

            if ($voucher && $voucherQuote) {
                $vouchers->recordUsage($voucher, $request->user(), $order, $discount);
            }

            if ($validated['payment_method'] === 'gcash') {
                $shop = $checkoutItems->first()->product->shop;

                $order->payments()->create([
                    'gateway' => 'gcash',
                    'amount' => $total,
                    'status' => 'submitted',
                    'gcash_account_name' => $shop->gcash_account_name,
                    'gcash_mobile_number' => $shop->gcash_mobile_number,
                    'gcash_qr_code' => $shop->gcash_qr_code,
                    'receipt_path' => $gcashReceiptPath,
                ]);
            }

            $order->load('items.product', 'items.shop', 'payments');
            $cart->items()->whereIn('id', $checkoutItems->modelKeys())->delete();
            if ($voucher) {
                $cart->update(['voucher_id' => null]);
            }

            return $order;
        });

        return response()->json($order, 201);
    }
}
