<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductDetailPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_detail_page_renders_with_available_voucher_data(): void
    {
        $product = $this->makeProduct();

        $this->get(route('products.show', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/product-detail')
                ->where('product.id', $product->id)
                ->has('availableVouchers'));
    }

    public function test_product_detail_page_renders_when_optional_product_metrics_table_is_missing(): void
    {
        $product = $this->makeProduct();
        Schema::drop('product_metrics');

        $this->get(route('products.show', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/product-detail')
                ->where('product.id', $product->id)
                ->missing('product.metrics'));
    }

    public function test_product_detail_page_remains_available_when_voucher_lookup_fails(): void
    {
        $product = $this->makeProduct();
        Schema::drop('voucher_claims');

        $this->get(route('products.show', $product))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('customer/product-detail')
                ->where('product.id', $product->id)
                ->where('voucherAvailabilityError', 'Voucher offers are temporarily unavailable. You can still view and purchase this product.')
                ->has('availableVouchers', 0));
    }

    public function test_marketplace_lists_only_published_products_approved_by_an_admin(): void
    {
        $approvedProduct = $this->makeProduct();
        $unapprovedProduct = $approvedProduct->replicate();
        $unapprovedProduct->slug = 'unapproved-detail-page-product';
        $unapprovedProduct->sku = 'DETAIL-PAGE-UNAPPROVED';
        $unapprovedProduct->status = 'pending';
        $unapprovedProduct->is_approved = false;
        $unapprovedProduct->save();

        $this->get(route('marketplace'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('products', fn ($products) => $products->pluck('id')->all() === [$approvedProduct->id])
                ->where('categories.0.products_count', 1));

        $this->get(route('products.show', $unapprovedProduct))
            ->assertNotFound();
    }

    private function makeProduct(): Product
    {
        $seller = User::factory()->create();
        $shop = Shop::create([
            'user_id' => $seller->id,
            'name' => 'Detail page shop',
            'slug' => 'detail-page-shop',
        ]);
        $category = Category::create([
            'name' => 'Detail page category',
            'slug' => 'detail-page-category',
        ]);
        return Product::create([
            'shop_id' => $shop->id,
            'seller_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Detail page product',
            'slug' => 'detail-page-product',
            'description' => 'Product detail route test.',
            'base_price' => 100,
            'sku' => 'DETAIL-PAGE-001',
            'status' => 'published',
            'is_approved' => true,
        ]);

    }
}
