<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\VoucherService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerCartController extends Controller
{
    private function cart(Request $request): Cart
    {
        return Cart::firstOrCreate(['user_id' => $request->user()->id]);
    }

    public function show(Request $request, VoucherService $vouchers)
    {
        $cart = $this->cart($request)->load('items.product.shop', 'items.product.images', 'items.product.category', 'items.product.variants', 'items.variant', 'voucher');
        $cart->items->each(function (CartItem $item) {
            $shop = $item->product?->shop;

            if ($shop?->gcash_qr_code) {
                $shop->setAttribute('gcash_qr_code_url', '/storage/'.$shop->gcash_qr_code);
            }
        });

        if ($cart->voucher) {
            try {
                $cart->setAttribute('voucher_quote', $vouchers->quote($cart->voucher, $request->user(), $cart->items));
            } catch (\Illuminate\Validation\ValidationException) {
                $cart->setAttribute('voucher_quote', null);
                $cart->setAttribute('voucher_invalid', true);
            }
        }

        return $cart;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'variant_id' => 'nullable|exists:product_variants,id',
            'quantity' => 'required|integer|min:1',
        ]);

        $product = Product::with('variants')->findOrFail($data['product_id']);
        abort_unless(
            Product::published()->whereKey($product->getKey())->exists(),
            422,
            'Product is unavailable or out of stock.',
        );

        $variant = null;
        if (! empty($data['variant_id'])) {
            $variant = ProductVariant::whereKey($data['variant_id'])->first();
            abort_unless($variant && $variant->product_id === $product->id, 422, 'That variant does not belong to this product.');
            abort_unless($variant->is_active, 422, 'That variant is currently unavailable.');
            abort_if($variant->stock_quantity < $data['quantity'], 422, 'Selected variant is sold out or has insufficient stock.');
        }

        $stockCheck = $variant
            ? $variant->stock_quantity
            : ($product->variants->isNotEmpty()
                ? $product->variants->where('is_active', true)->sum('stock_quantity')
                : $product->stock_quantity);
        abort_if($stockCheck < $data['quantity'], 422, 'This product is sold out or has insufficient stock.');

        $unitPrice = $variant?->price ?? ($product->sale_price ?? $product->base_price);

        return $this->cart($request)->items()->updateOrCreate(
            ['product_id' => $product->id, 'variant_id' => $data['variant_id'] ?? null],
            ['quantity' => $data['quantity'], 'price_snapshot' => $unitPrice]
        );
    }

    public function update(Request $request, CartItem $item)
    {
        $data = $request->validate(['quantity' => 'required|integer|min:1']);

        return DB::transaction(function () use ($request, $item, $data) {
            $cartItem = CartItem::query()->whereKey($item->getKey())->lockForUpdate()->firstOrFail();
            abort_unless($cartItem->cart()->where('user_id', $request->user()->id)->exists(), 403);

            $product = Product::published()->whereKey($cartItem->product_id)->lockForUpdate()->first();
            abort_unless($product, 422, 'This product is no longer available.');

            if ($cartItem->variant_id) {
                $variant = ProductVariant::query()
                    ->whereKey($cartItem->variant_id)
                    ->where('product_id', $product->id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();
                abort_unless($variant, 422, 'This product variant is no longer available.');
                $availableStock = (int) $variant->stock_quantity;
            } else {
                $variants = ProductVariant::query()
                    ->where('product_id', $product->id)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->get(['stock_quantity']);
                $availableStock = $variants->isNotEmpty()
                    ? (int) $variants->sum('stock_quantity')
                    : (int) $product->stock_quantity;
            }

            abort_if($data['quantity'] > $availableStock, 422, 'The requested quantity exceeds available stock.');

            $cartItem->update(['quantity' => $data['quantity']]);

            return $cartItem->load('product.variants', 'variant');
        });
    }

    public function destroy(Request $request, CartItem $item)
    {
        abort_unless($item->cart->user_id === $request->user()->id, 403);
        $item->delete();

        return response()->noContent();
    }
}
