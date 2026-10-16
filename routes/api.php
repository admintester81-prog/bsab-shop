<?php

use App\Http\Controllers\Api\AdminOrderController;
use App\Http\Controllers\Api\AdminSellerController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CustomerCartController;
use App\Http\Controllers\Api\CustomerLocationGeocodingController;
use App\Http\Controllers\Api\CustomerProductReviewController;
use App\Http\Controllers\Api\CustomerVoucherController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SellerProductController;
use App\Http\Controllers\Api\SupportConversationController;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\VoucherService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('products', [ProductController::class, 'index']);
Route::get('products/{product}', [ProductController::class, 'show']);
Route::get('support/assistant/status', [SupportConversationController::class, 'assistantStatus'])->middleware('throttle:30,1');
Route::post('support/assistant', [SupportConversationController::class, 'guestAssistant'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('user', fn (Request $request) => $request->user()->load('roles', 'shop', 'addresses'));
    Route::get('support/conversation', [SupportConversationController::class, 'show']);
    Route::post('support/conversation/messages', [SupportConversationController::class, 'store'])->middleware('throttle:5,1');

    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('orders', [AdminOrderController::class, 'index']);
        Route::patch('orders/{order}', [AdminOrderController::class, 'update']);
        Route::get('sellers', [AdminSellerController::class, 'index']);
        Route::post('sellers', [AdminSellerController::class, 'store']);
        Route::patch('sellers/{seller}', [AdminSellerController::class, 'update']);
        Route::delete('sellers/{seller}', [AdminSellerController::class, 'destroy']);
        Route::post('sellers/{seller}/suspend', [AdminSellerController::class, 'suspend']);
        Route::post('sellers/{seller}/reactivate', [AdminSellerController::class, 'reactivate']);
    });

    Route::middleware('role:seller')->prefix('seller')->group(function () {
        Route::get('products', [SellerProductController::class, 'index']);
        Route::post('products', [SellerProductController::class, 'store']);
        Route::patch('products/{product}', [SellerProductController::class, 'update']);
        Route::delete('products/{product}', [SellerProductController::class, 'destroy']);
        Route::get('orders', fn (Request $request) => $request->user()->shop->orderItems()->with('order.user', 'order.payments', 'product.images')->latest()->paginate(20));
        Route::patch('orders/items/{item}', function (Request $request, OrderItem $item) {
            abort_unless($item->shop->user_id === $request->user()->id, 403);
            $item->update($request->validate(['fulfillment_status' => 'required|in:processing,accepted,declined,shipped,delivered,cancelled']));

            if ($item->fulfillment_status === 'cancelled' && $item->order->items()->where('fulfillment_status', '!=', 'cancelled')->doesntExist()) {
                app(VoucherService::class)->releaseUsageForCancelledOrder($item->order);
            }

            return $item->load('order');
        });
    });

    Route::middleware('role:customer')->prefix('customer')->group(function () {
        Route::get('location/search', [CustomerLocationGeocodingController::class, 'search'])->middleware('throttle:60,1');
        Route::get('location/reverse', [CustomerLocationGeocodingController::class, 'reverse'])->middleware('throttle:60,1');
        Route::get('cart', [CustomerCartController::class, 'show']);
        Route::post('cart/items', [CustomerCartController::class, 'store']);
        Route::patch('cart/items/{item}', [CustomerCartController::class, 'update']);
        Route::delete('cart/items/{item}', [CustomerCartController::class, 'destroy']);
        Route::get('vouchers', [CustomerVoucherController::class, 'index']);
        Route::post('cart/voucher', [CustomerVoucherController::class, 'apply']);
        Route::post('cart/voucher/quote', [CustomerVoucherController::class, 'quote']);
        Route::delete('cart/voucher', [CustomerVoucherController::class, 'remove']);
        Route::post('vouchers/{voucher}/claim', [CustomerVoucherController::class, 'claim']);
        Route::post('checkout', [CheckoutController::class, 'store']);
        Route::get('orders', fn (Request $request) => $request->user()->orders()->with('items.product.images', 'items.shop', 'items.variant', 'items.review')->latest()->paginate(20));
        Route::get('orders/{order}', fn (Request $request, Order $order) => abort_unless($order->user_id === $request->user()->id, 403) ?: $order->load('items.product.images', 'items.shop', 'items.variant', 'items.review', 'payments'));
        Route::post('order-items/{item}/review', [CustomerProductReviewController::class, 'store']);
    });
});
