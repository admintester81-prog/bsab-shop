<?php

use App\Http\Controllers\AdminCategoryController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminShippingController;
use App\Http\Controllers\AdminFooterController;
use App\Http\Controllers\AdminProductController;
use App\Http\Controllers\AdminSettingsController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AI\ProductAIController;
use App\Http\Controllers\Auth\AdminRegistrationController;
use App\Http\Controllers\LaravelCrudTesterController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SellerOverviewController;
use App\Http\Controllers\SellerProductController;
use App\Http\Controllers\SellerShopController;
use App\Http\Controllers\TestGeminiImageController;
use App\Http\Controllers\FooterPageController;
use App\Http\Controllers\HelpCenterController;
use App\Http\Controllers\VoucherManagementController;
use App\Services\VoucherService;
use App\Http\Middleware\RequestDeviceModelHint;
use App\Models\Category;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Models\Wishlist;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

$extractGeminiDiagnosticError = function (mixed $payload, int $status): string {
    if (is_array($payload)) {
        $message = data_get($payload, 'error.message');

        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        $errors = data_get($payload, 'error.errors');

        if (is_array($errors)) {
            foreach ($errors as $error) {
                if (is_array($error) && isset($error['message']) && is_string($error['message']) && trim($error['message']) !== '') {
                    return trim($error['message']);
                }
            }
        }

        $message = data_get($payload, 'message');

        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        $error = data_get($payload, 'error');

        if (is_string($error) && trim($error) !== '') {
            return trim($error);
        }
    }

    if (is_string($payload) && trim($payload) !== '') {
        return trim($payload);
    }

    return match ($status) {
        400 => 'Invalid Gemini request.',
        401 => 'API key not valid.',
        403 => 'Gemini API access forbidden.',
        404 => 'Gemini model unavailable or unsupported for this project.',
        429 => 'Gemini API rate limit reached.',
        500 => 'Gemini API server error.',
        default => 'Gemini API request failed.',
    };
};

$storefrontProps = fn (?int $userId = null) => [
    'siteSettings' => SiteSetting::homeSettings(),
    'categories' => Category::query()
        ->withCount(['products' => fn ($query) => $query->published()])
        ->orderBy('name')
        ->get(['id', 'name', 'slug', 'image']),
    'products' => Product::published()
        ->with(['shop:id,name', 'category:id,name,slug', 'images' => fn ($query) => $query->where('is_primary', true)->limit(1)])
        ->withSum(['variants as active_variant_stock' => fn ($query) => $query->where('is_active', true)], 'stock_quantity')
        ->withAvg('reviews', 'rating')
        ->withCount('reviews')
        ->when($userId, fn ($query) => $query->withExists(['wishlists as is_favorited' => fn ($wishlistQuery) => $wishlistQuery->where('user_id', $userId)]))
        ->latest()
        ->get()
        ->map(function (Product $product) {
            $variantStock = $product->active_variant_stock;
            $availableStock = $variantStock !== null ? (int) $variantStock : 0;

            return array_merge($product->toArray(), [
                'average_rating' => $product->reviews_avg_rating ? round((float) $product->reviews_avg_rating, 1) : 0,
                'review_count' => (int) $product->reviews_count,
                'available_stock' => $availableStock,
                'is_out_of_stock' => $availableStock < 1,
                'is_favorited' => (bool) ($product->is_favorited ?? false),
            ]);
        })
        ->values(),
];

Route::get('/', function (Request $request) use ($storefrontProps) {
    if ($request->user()?->hasRole('admin')) {
        return to_route('admin.dashboard');
    }

    if ($request->user()?->hasRole('seller')) {
        return to_route('seller.dashboard');
    }

    return Inertia::render('welcome', [
        ...$storefrontProps($request->user()?->id),
        'query' => trim((string) $request->query('q', '')),
    ]);
})->name('home');

Route::get('/marketplace', fn () => Inertia::render('customer/marketplace', $storefrontProps()))->name('marketplace');
Route::get('/pages/help-center', [HelpCenterController::class, 'show'])->name('pages.help-center');
Route::post('/pages/contact-us', [FooterPageController::class, 'submitContact'])
    ->middleware('throttle:5,1')
    ->name('footer-pages.contact');
Route::get('/pages/{slug}', [FooterPageController::class, 'show'])->name('footer-pages.show');

Route::get('/test', [LaravelCrudTesterController::class, 'index'])->name('tester.index');
Route::match(['get', 'post'], '/test/run', [LaravelCrudTesterController::class, 'runAll'])->name('tester.run-all');
Route::match(['get', 'post'], '/test/run/{entity}', [LaravelCrudTesterController::class, 'runSingle'])->name('tester.run-single');

Route::get('/test-gemini-image', [TestGeminiImageController::class, 'page'])->name('test.gemini.image.page');
Route::post('/test-gemini-image', [TestGeminiImageController::class, 'test'])->name('test.gemini.image');

Route::get('/test-gemini', function () use ($extractGeminiDiagnosticError) {
    $apiKey = config('services.gemini.api_key');

    if (blank($apiKey)) {
        return response()->json([
            'success' => false,
            'error' => 'GEMINI_API_KEY is missing',
        ], 500);
    }

    $models = ['gemini-3.6-flash'];
    $lastResponse = null;

    foreach ($models as $model) {
        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'x-goog-api-key' => $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                    'contents' => [
                        [
                            'parts' => [
                                [
                                    'text' => 'Reply with exactly: GEMINI TEST SUCCESS',
                                ],
                            ],
                        ],
                    ],
                ]);

            $status = $response->status();
            $payload = $response->json();
            $lastResponse = $payload;

            if ($response->successful()) {
                return response()->json([
                    'success' => true,
                    'http_status' => $status,
                    'message' => 'Gemini API connection successful',
                    'response' => $payload,
                ]);
            }

            if ($status === 404) {
                $lastResponse = $payload;

                continue;
            }

            $errorMessage = $extractGeminiDiagnosticError($payload, $status);

            return response()->json([
                'success' => false,
                'http_status' => $status,
                'message' => 'Gemini API request failed',
                'error' => $errorMessage,
                'response' => $payload,
            ], $status >= 400 ? $status : 500);
        } catch (Throwable $exception) {
            $errorMessage = $exception->getMessage();

            if (str_contains(strtolower($errorMessage), 'timeout')) {
                return response()->json([
                    'success' => false,
                    'http_status' => 504,
                    'message' => 'Gemini API request timed out',
                    'error' => $errorMessage,
                ], 504);
            }

            if (str_contains(strtolower($errorMessage), 'connection')) {
                return response()->json([
                    'success' => false,
                    'http_status' => 503,
                    'message' => 'Gemini API connection failed',
                    'error' => $errorMessage,
                ], 503);
            }

            return response()->json([
                'success' => false,
                'http_status' => 500,
                'message' => 'Gemini API request failed',
                'error' => $errorMessage,
            ], 500);
        }
    }

    $fallbackError = $extractGeminiDiagnosticError($lastResponse ?? null, 404);

    return response()->json([
        'success' => false,
        'http_status' => 404,
        'message' => 'Gemini API request failed',
        'error' => $fallbackError,
        'response' => $lastResponse,
    ], 404);
})->name('test.gemini');

Route::get('/products/{product}', function (Request $request, Product $product, VoucherService $vouchers) {
    abort_unless(Product::published()->whereKey($product->getKey())->exists(), 404);

    $withMetrics = Schema::hasTable('product_metrics');
    $similarProductRelations = [
        'shop:id,name',
        'category:id,name,slug',
        'images' => fn ($imageQuery) => $imageQuery->where('is_primary', true)->limit(1),
    ];
    if ($withMetrics) {
        $similarProductRelations[] = 'metrics';
    }

    $similarProducts = Product::published()
        ->where('id', '!=', $product->id)
        ->where(function ($query) use ($product) {
            $query->where('category_id', $product->category_id)
                ->orWhere('shop_id', $product->shop_id);
        })
        ->with($similarProductRelations)
        ->latest()
        ->limit(4)
        ->get();

    $productRelations = [
        'shop:id,name',
        'category:id,name,slug',
        'images',
        'options.values',
        'variants.optionValues.optionValue.option',
    ];
    if ($withMetrics) {
        $productRelations[] = 'metrics';
    }

    $availableVouchers = collect();
    $voucherAvailabilityError = null;
    try {
        $availableVouchers = $vouchers->availableForProduct($product, $request->user());
    } catch (QueryException $exception) {
        Log::warning('Product detail voucher availability query failed.', [
            'product_id' => $product->id,
            'exception' => $exception,
        ]);
        $voucherAvailabilityError = 'Voucher offers are temporarily unavailable. You can still view and purchase this product.';
    }

    $product->load($productRelations);
    $product->setAttribute(
        'is_favorited',
        $request->user()
            ? $product->wishlists()->where('user_id', $request->user()->id)->exists()
            : false,
    );

    return Inertia::render('customer/product-detail', [
        'product' => $product,
        'similarProducts' => $similarProducts,
        'availableVouchers' => $availableVouchers,
        'voucherAvailabilityError' => $voucherAvailabilityError,
    ]);
})->name('products.show');

Route::get('/dashboard', function (Request $request) {
    if ($request->user()->hasRole('admin')) {
        return to_route('admin.dashboard');
    }

    if ($request->user()->hasRole('seller')) {
        return to_route('seller.dashboard');
    }

    return to_route('home');
})->middleware('auth')->name('dashboard');

Route::middleware(['guest', 'throttle:5,1'])->prefix('admin/portal')->group(function () {
    Route::get('/register', [AdminRegistrationController::class, 'create'])->name('admin.register');
    Route::post('/register', [AdminRegistrationController::class, 'store'])->name('admin.register.store');
});

Route::middleware(['guest', 'throttle:5,1'])->group(function () {
    Route::get('/admin/register/super-secret-admin-token-change-me', [AdminRegistrationController::class, 'create'])
        ->name('admin.register.secret');
    Route::post('/admin/register/super-secret-admin-token-change-me', [AdminRegistrationController::class, 'store'])
        ->name('admin.register.secret.store');
});

Route::middleware(['auth', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('/', [AdminDashboardController::class, 'index'])->name('admin.dashboard');
    Route::get('/analytics', [AdminDashboardController::class, 'index'])->name('admin.analytics');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('admin.profile');
    Route::get('/footer', [AdminFooterController::class, 'index'])->name('admin.footer');
    Route::put('/footer', [AdminFooterController::class, 'update'])->name('admin.footer.update');
    Route::put('/footer/pages/{slug}', [AdminFooterController::class, 'updatePage'])
        ->whereIn('slug', ['web-dev', 'return-policy', 'privacy-policy', 'terms-conditions', 'sustainability', 'our-story', 'contact-us', 'shipping-info'])
        ->name('admin.footer.pages.update');
    Route::get('/shipping', [AdminShippingController::class, 'index'])->name('admin.shipping');
    Route::post('/shipping/zones', [AdminShippingController::class, 'store'])->name('admin.shipping.zones.store');
    Route::put('/shipping/zones/reorder', [AdminShippingController::class, 'reorder'])->name('admin.shipping.zones.reorder');
    Route::put('/shipping/zones/{deliveryZone}', [AdminShippingController::class, 'update'])->name('admin.shipping.zones.update');
    Route::delete('/shipping/zones/{deliveryZone}', [AdminShippingController::class, 'destroy'])->name('admin.shipping.zones.destroy');
    Route::put('/shipping/content', [AdminShippingController::class, 'saveContent'])->name('admin.shipping.content');
    Route::get('/settings', [AdminSettingsController::class, 'index'])->middleware(RequestDeviceModelHint::class)->name('admin.settings');
    Route::get('/homepage', [AdminSettingsController::class, 'homepage'])->name('admin.homepage');
    Route::post('/homepage', [AdminSettingsController::class, 'saveHomeContent'])->name('admin.homepage.store');
    Route::get('/vouchers', [VoucherManagementController::class, 'index'])->name('admin.vouchers');
        Route::get('/vouchers/products', [VoucherManagementController::class, 'products'])->name('admin.vouchers.products');
        Route::get('/vouchers/{voucher}', [VoucherManagementController::class, 'show'])->name('admin.vouchers.show');
        Route::post('/vouchers', [VoucherManagementController::class, 'store'])->name('admin.vouchers.store');
        Route::patch('/vouchers/{voucher}', [VoucherManagementController::class, 'update'])->name('admin.vouchers.update');
        Route::post('/vouchers/{voucher}/toggle', [VoucherManagementController::class, 'toggle'])->name('admin.vouchers.toggle');
        Route::post('/vouchers/{voucher}/duplicate', [VoucherManagementController::class, 'duplicate'])->name('admin.vouchers.duplicate');
        Route::delete('/vouchers/{voucher}', [VoucherManagementController::class, 'destroy'])->name('admin.vouchers.destroy');
    Route::post('/settings/cache/clear', [AdminSettingsController::class, 'clearCache'])->name('admin.settings.cache.clear');
    Route::post('/settings/logs/clear', [AdminSettingsController::class, 'clearLogs'])->name('admin.settings.logs.clear');
    Route::post('/settings/categories/clear', [AdminSettingsController::class, 'clearCategories'])->name('admin.settings.categories.clear');
    Route::post('/settings/products/clear', [AdminSettingsController::class, 'clearProducts'])->name('admin.settings.products.clear');
    Route::post('/settings/orders/clear', [AdminSettingsController::class, 'clearOrders'])->name('admin.settings.orders.clear');
    Route::post('/settings/home-content', [AdminSettingsController::class, 'saveHomeContent'])->name('admin.settings.home-content');
    Route::get('/sellers', fn () => Inertia::render('admin/sellers'))->name('admin.sellers');
    Route::get('/customers', [AdminUserController::class, 'customers'])->name('admin.customers');
    Route::patch('/customers/{user}', [AdminUserController::class, 'updateCustomer'])->name('admin.customers.update');
    Route::get('/products', [AdminProductController::class, 'index'])->name('admin.products');
    Route::patch('/products/approve-all', [AdminProductController::class, 'approveAll'])->name('admin.products.approve-all');
    Route::patch('/products/approve-selected', [AdminProductController::class, 'approveSelected'])->name('admin.products.approve-selected');
    Route::patch('/products/{product}', [AdminProductController::class, 'update'])->name('admin.products.update');
    Route::get('/orders', fn () => Inertia::render('admin/orders'))->name('admin.orders');
    Route::get('/users', [AdminUserController::class, 'index'])->name('admin.users');
    Route::post('/users', [AdminUserController::class, 'store'])->name('admin.users.store');
    Route::patch('/users/{user}', [AdminUserController::class, 'update'])->name('admin.users.update');
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('admin.users.destroy');
    Route::get('/categories', [AdminCategoryController::class, 'index'])->name('admin.categories');
    Route::post('/categories', [AdminCategoryController::class, 'store'])->name('admin.categories.store');
    Route::post('/categories/{category}', [AdminCategoryController::class, 'update'])->name('admin.categories.update.post');
    Route::patch('/categories/{category}', [AdminCategoryController::class, 'update'])->name('admin.categories.update');
    Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy'])->name('admin.categories.destroy');
});

Route::middleware(['auth', 'role:seller'])->prefix('seller')->group(function () {
    Route::get('/', [SellerOverviewController::class, 'dashboard'])->name('seller.dashboard');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('seller.profile');
    Route::get('/shop', [SellerShopController::class, 'show'])->name('seller.shop');
    Route::post('/shop', [SellerShopController::class, 'update'])->name('seller.shop.store');
    Route::patch('/shop', [SellerShopController::class, 'update'])->name('seller.shop.update');
    Route::get('/customers', [SellerOverviewController::class, 'customers'])->name('seller.customers');
    Route::get('/analytics', [SellerOverviewController::class, 'analytics'])->name('seller.analytics');
    Route::get('/marketing', fn () => to_route('seller.vouchers'))->name('seller.marketing');
    Route::get('/payments', [SellerOverviewController::class, 'payments'])->name('seller.payments');
    Route::get('/settings', [SellerOverviewController::class, 'settings'])->name('seller.settings');
    Route::get('/vouchers', [VoucherManagementController::class, 'index'])->name('seller.vouchers');
    Route::get('/vouchers/products', [VoucherManagementController::class, 'products'])->name('seller.vouchers.products');
    Route::get('/vouchers/{voucher}', [VoucherManagementController::class, 'show'])->name('seller.vouchers.show');
    Route::post('/vouchers', [VoucherManagementController::class, 'store'])->name('seller.vouchers.store');
    Route::patch('/vouchers/{voucher}', [VoucherManagementController::class, 'update'])->name('seller.vouchers.update');
    Route::post('/vouchers/{voucher}/toggle', [VoucherManagementController::class, 'toggle'])->name('seller.vouchers.toggle');
    Route::post('/vouchers/{voucher}/duplicate', [VoucherManagementController::class, 'duplicate'])->name('seller.vouchers.duplicate');
    Route::delete('/vouchers/{voucher}', [VoucherManagementController::class, 'destroy'])->name('seller.vouchers.destroy');
    Route::get('/products', [SellerProductController::class, 'index'])->name('seller.products');
    Route::post('/products/ai-analyze', [ProductAIController::class, 'analyze'])->name('seller.products.ai-analyze');
    Route::post('/products', [SellerProductController::class, 'store'])->name('seller.products.store');
    Route::patch('/products/{product}', [SellerProductController::class, 'update'])->name('seller.products.update');
    Route::delete('/products/{product}', [SellerProductController::class, 'destroy'])->name('seller.products.destroy');
    Route::get('/orders', [SellerOverviewController::class, 'orders'])->name('seller.orders');
});

Route::middleware(['auth', 'role:customer'])->prefix('customer')->group(function () use ($storefrontProps) {
    Route::get('/', fn () => to_route('customer.profile'))->name('customer.account');
    Route::get('/products', function (Request $request) {
        $userId = $request->user()?->id;
        $products = Product::published()
            ->with(['shop:id,name', 'category:id,name,slug', 'images' => fn ($q) => $q->where('is_primary', true)->limit(1)])
            ->withSum(['variants as active_variant_stock' => fn ($q) => $q->where('is_active', true)], 'stock_quantity')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->when($userId, fn ($q) => $q->withExists(['wishlists as is_favorited' => fn ($wq) => $wq->where('user_id', $userId)]))
            ->latest()
            ->get()
            ->map(function (Product $product) {
                $variantStock = $product->active_variant_stock;
                $availableStock = $variantStock !== null ? (int) $variantStock : 0;
                return array_merge($product->toArray(), [
                    'average_rating' => $product->reviews_avg_rating ? round((float) $product->reviews_avg_rating, 1) : 0,
                    'review_count'   => (int) $product->reviews_count,
                    'available_stock' => $availableStock,
                    'is_out_of_stock' => $availableStock < 1,
                    'is_favorited'   => (bool) ($product->is_favorited ?? false),
                ]);
            })
            ->values();

        return Inertia::render('customer/products', [
            'products'   => $products,
            'categories' => Category::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'query' => trim((string) $request->query('q', '')),
        ]);
    })->name('customer.products');
    Route::redirect('/categories', '/customer/products')->name('customer.categories');
    Route::get('/categories/{category}', function (string $category) {
        $categoryModel = Category::query()
            ->where('slug', $category)
            ->firstOrFail();

        return Inertia::render('customer/category-show', [
            'category' => [
                'id' => $categoryModel->id,
                'name' => $categoryModel->name,
                'slug' => $categoryModel->slug,
                'image' => $categoryModel->image,
            ],
            'products' => Product::published()
                ->where('category_id', $categoryModel->id)
                ->with(['shop:id,name', 'category:id,name,slug', 'images' => fn ($imageQuery) => $imageQuery->where('is_primary', true)->limit(1)])
                ->latest()
                ->get(),
        ]);
    })->name('customer.categories.show');
    Route::get('/favorites', function (Request $request) {
        return Inertia::render('customer/favorites', [
            'products' => Product::published()
                ->whereHas('wishlists', fn ($query) => $query->where('user_id', $request->user()->id))
                ->with(['shop:id,name', 'category:id,name,slug', 'images' => fn ($query) => $query->where('is_primary', true)->limit(1)])
                ->withSum(['variants as active_variant_stock' => fn ($query) => $query->where('is_active', true)], 'stock_quantity')
                ->withAvg('reviews', 'rating')
                ->withCount('reviews')
                ->latest()
                ->get()
                ->map(function (Product $product) {
                    $availableStock = (int) ($product->active_variant_stock ?? 0);

                    return array_merge($product->toArray(), [
                        'available_stock' => $availableStock,
                        'is_out_of_stock' => $availableStock < 1,
                        'average_rating' => $product->reviews_avg_rating ? round((float) $product->reviews_avg_rating, 1) : 0,
                        'review_count' => (int) $product->reviews_count,
                    ]);
                })
                ->values(),
        ]);
    })->name('customer.favorites');
    Route::delete('/favorites', function (Request $request) {
        Wishlist::query()->where('user_id', $request->user()->id)->delete();

        return back();
    })->name('customer.favorites.clear');
    Route::post('/favorites/{product}/toggle', function (Request $request, Product $product) {
        $wishlist = Wishlist::query()->where('user_id', $request->user()->id)->where('product_id', $product->id)->first();

        if ($wishlist) {
            $wishlist->delete();
        } else {
            Wishlist::create(['user_id' => $request->user()->id, 'product_id' => $product->id]);
        }

        return back();
    })->name('customer.favorites.toggle');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('customer.profile');
    Route::get('/settings', function (Request $request) {
        $user = $request->user();
        return Inertia::render('customer/settings', [
            'address' => $user->addresses()->where('is_default', true)->first() ?? $user->addresses()->first(),
            'avatarUrl' => $user->avatar ? '/storage/'.$user->avatar : null,
            'recentOrdersCount' => $user->orders()->count(),
            'vouchersCount' => $user->voucherClaims()->count(),
        ]);
    })->name('customer.settings');
    Route::post('/settings/clear-cache', function (Request $request) {
        session()->forget(['customer_cache', 'customer_preferences', 'bsab_cart_cache']);
        return back()->with('message', 'Cache cleared successfully');
    })->name('customer.settings.clear-cache');
    Route::get('/settings/notifications', fn () => Inertia::render('customer/settings/notifications'))->name('customer.settings.notifications');
    Route::get('/settings/display', fn () => Inertia::render('customer/settings/display'))->name('customer.settings.display');
    Route::get('/settings/security', fn () => Inertia::render('customer/settings/security'))->name('customer.settings.security');
    Route::get('/settings/password', fn () => Inertia::render('customer/settings/password'))->name('customer.settings.password');
    Route::get('/settings/saved-preferences', fn () => Inertia::render('customer/settings/saved-preferences'))->name('customer.settings.saved-preferences');
    Route::get('/cart', fn () => Inertia::render('customer/cart'))->name('customer.cart');
    Route::get('/checkout', function (Request $request) {
        return Inertia::render('customer/checkout', [
            'selectedItemIds' => collect($request->input('selected_item_ids', []))->map(fn ($id) => (int) $id)->values()->all(),
            'deliveryZones' => DeliveryZone::active()->get(),
            'deliveryOptions' => SiteSetting::homeSettings()['shipping_options'],
        ]);
    })->name('customer.checkout');
    Route::get('/orders', fn () => Inertia::render('customer/orders'))->name('customer.orders');
        Route::get('/vouchers', fn (Request $request, VoucherService $vouchers) => Inertia::render('vouchers/customer', [
            'claims' => $request->user()->voucherClaims()->with('voucher')->latest()->get(),
            'available' => $vouchers->availableForCustomer($request->user()),
        ]))->name('customer.vouchers');
    Route::get('/order-tracking', fn () => Inertia::render('customer/order-tracking'))->name('customer.order-tracking');
    Route::get('/orders/{order}', function (Request $request, Order $order) {
        abort_unless($order->user_id === $request->user()->id, 403);

        return redirect()->route('customer.order-tracking', ['order_id' => $order->id]);
    })->name('customer.order');
});

Route::middleware('auth')->prefix('settings')->group(function () {
    Route::get('profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::get('password', [PasswordController::class, 'edit'])->name('user-password.edit');
    Route::put('password', [PasswordController::class, 'update'])->name('user-password.update');
});

require __DIR__.'/auth.php';
