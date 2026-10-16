<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        return Product::published()->with(['shop:id,name,slug', 'category:id,name,slug'])
            ->when($request->search, fn ($query, $search) => $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('description', 'like', "%{$search}%")))
            ->when($request->category, fn ($query, $category) => $query->whereHas('category', fn ($q) => $q->where('slug', $category)))
            ->latest()->paginate(20);
    }

    public function show(Product $product)
    {
        abort_unless(Product::published()->whereKey($product->getKey())->exists(), 404);

        return $product->load([
            'shop',
            'category',
            'variants',
            'images',
            'options.values',
            'variants.optionValues.optionValue.option',
            'reviews.user:id,name',
        ]);
    }
}
