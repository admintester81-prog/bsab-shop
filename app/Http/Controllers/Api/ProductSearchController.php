<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductSearch;
use App\Models\Shop;
use App\Services\ProductSearchAssistant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProductSearchController extends Controller
{
    public function __construct(private readonly ProductSearchAssistant $assistant) {}

    public function search(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:100'],
            'seller' => ['nullable', 'integer', 'min:1'],
            'min_price' => ['nullable', 'numeric', 'min:0'],
            'max_price' => ['nullable', 'numeric', 'min:0'],
            'price_range' => ['nullable', 'in:any,0-250,251-500,501-1000,1000+'],
            'availability' => ['nullable', 'in:0,1,true,false'],
            'rating' => ['nullable', 'numeric', 'between:1,5'],
            'discount' => ['nullable', 'in:0,1,true,false'],
            'sort' => ['nullable', 'in:all,best,top_sales,latest'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $query = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', (string) ($filters['q'] ?? '')) ?? '');

        $products = Product::published()
            ->with([
                'shop:id,name,slug',
                'category:id,name,slug',
                'images' => fn ($imageQuery) => $imageQuery->orderByDesc('is_primary')->orderBy('id')->limit(1),
            ])
            ->withSum(['variants as active_variant_stock' => fn ($variantQuery) => $variantQuery->where('is_active', true)], 'stock_quantity')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->when($request->user()?->hasRole('customer'), fn ($builder) => $builder->withExists([
                'wishlists as is_favorited' => fn ($wishlistQuery) => $wishlistQuery->where('user_id', $request->user()->id),
            ]));
        if (Schema::hasTable('product_metrics')) {
            $products->with('metrics:id,product_id,quantity_sold,purchase_count');
        }

        if ($query !== '') {
            foreach ($this->searchTerms($query) as $term) {
                $like = '%'.$term.'%';
                $products->where(function ($builder) use ($like) {
                    $builder->where('products.name', 'like', $like)
                        ->orWhere('products.description', 'like', $like)
                        ->orWhere('products.brand', 'like', $like)
                        ->orWhere('products.model', 'like', $like)
                        ->orWhere('products.color', 'like', $like)
                        ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('name', 'like', $like))
                        ->orWhereHas('shop', fn ($shopQuery) => $shopQuery->where('name', 'like', $like));
                });
            }
        }

        if (! empty($filters['category'])) {
            $products->whereHas('category', fn ($builder) => $builder->where('slug', $filters['category']));
        }
        if (! empty($filters['seller'])) {
            $products->where('shop_id', $filters['seller']);
        }
        if ($request->boolean('availability')) {
            $products->where(function ($builder) {
                $builder->where(function ($stockQuery) {
                    $stockQuery->whereDoesntHave('variants')->where('stock_quantity', '>', 0);
                })->orWhereHas('variants', fn ($variantQuery) => $variantQuery->where('is_active', true)->where('stock_quantity', '>', 0));
            });
        }
        if (! empty($filters['rating'])) {
            $products->whereRaw(
                '(SELECT AVG(search_reviews.rating) FROM reviews as search_reviews WHERE search_reviews.product_id = products.id) >= ?',
                [$filters['rating']]
            );
        }
        if ($request->boolean('discount')) {
            $products->whereNotNull('sale_price')->whereColumn('sale_price', '<', 'base_price');
        }

        [$minimumPrice, $maximumPrice] = $this->priceRange($filters);
        $price = 'COALESCE(sale_price, base_price)';
        if ($minimumPrice !== null) {
            $products->whereRaw("$price >= ?", [$minimumPrice]);
        }
        if ($maximumPrice !== null) {
            $products->whereRaw("$price <= ?", [$maximumPrice]);
        }

        if (($filters['sort'] ?? 'best') === 'top_sales' && Schema::hasTable('product_metrics')) {
            $products->leftJoin('product_metrics as search_metrics', 'products.id', '=', 'search_metrics.product_id')
                ->select('products.*')
                ->orderByDesc('search_metrics.quantity_sold');
        } elseif (($filters['sort'] ?? '') === 'latest') {
            $products->orderByDesc('products.published_at')->orderByDesc('products.created_at');
        } elseif ($query !== '') {
            $products->orderByRaw('CASE WHEN LOWER(products.name) = ? THEN 0 WHEN LOWER(products.name) LIKE ? THEN 1 ELSE 2 END', [
                mb_strtolower($query),
                mb_strtolower($query).'%',
            ]);
        }

        $page = $products->orderByDesc('products.created_at')->paginate(24)->withQueryString();
        $page->getCollection()->transform(function (Product $product) {
            $variantStock = $product->active_variant_stock;
            $availableStock = $variantStock !== null ? (int) $variantStock : (int) $product->stock_quantity;
            $product->setAttribute('average_rating', $product->reviews_avg_rating ? round((float) $product->reviews_avg_rating, 1) : 0);
            $product->setAttribute('review_count', (int) $product->reviews_count);
            $product->setAttribute('available_stock', $availableStock);
            $product->setAttribute('is_out_of_stock', $availableStock < 1);
            $product->setAttribute('discount_percentage', $product->sale_price && (float) $product->sale_price < (float) $product->base_price
                ? (int) round((1 - (float) $product->sale_price / (float) $product->base_price) * 100)
                : 0);
            $product->setAttribute('sales_count', $product->metrics?->quantity_sold ?? null);
            $product->setAttribute('is_favorited', (bool) ($product->is_favorited ?? false));

            return $product;
        });

        $catalog = Product::published()
            ->when($query !== '', function ($builder) use ($query) {
                foreach ($this->searchTerms($query) as $term) {
                    $like = '%'.$term.'%';
                    $builder->where(fn ($matches) => $matches
                        ->where('name', 'like', $like)
                        ->orWhere('description', 'like', $like)
                        ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('name', 'like', $like)));
                }
            })
            ->with('category:id,name')
            ->latest('products.created_at')
            ->limit(12)
            ->get(['id', 'name', 'category_id']);
        $assistant = $this->assistant->analyze($query, $catalog->map(fn (Product $product) => [
            'name' => $product->name,
            'category' => $product->category?->name,
        ])->all());
        if ($query !== '' && $catalog->isEmpty()) {
            $assistant['suggestions'] = Product::published()
                ->latest('products.published_at')
                ->limit(6)
                ->pluck('name')
                ->all();
            $assistant['intent'] = $assistant['suggestions'] !== []
                ? 'No exact catalog matches found. Try one of these available products.'
                : 'No matching products are currently available.';
        }

        return response()->json([
            'products' => $page,
            'suggestions' => $assistant['suggestions'],
            'intent' => $assistant['intent'],
            'ai_enabled' => $assistant['ai_enabled'],
            'popular_searches' => $this->popularSearches(),
            'trending_searches' => $this->trendingSearches(),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'sellers' => Shop::query()
                ->whereHas('products', fn ($productQuery) => $productQuery->published())
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Shop $shop) => ['id' => $shop->id, 'name' => $shop->name]),
        ]);
    }

    public function history(Request $request)
    {
        return response()->json([
            'data' => ProductSearch::query()->where('user_id', $request->user()->id)
                ->latest()->limit(8)->pluck('query')->unique()->values(),
        ]);
    }

    public function storeHistory(Request $request)
    {
        $data = $request->validate(['query' => ['required', 'string', 'min:2', 'max:120']]);
        $query = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $data['query']) ?? '');
        abort_if(mb_strlen($query) < 2, 422, 'Enter at least two characters to save a search.');
        abort_if(
            str_contains($query, '@') || preg_match('/^\+?[\d\s().-]{7,}$/', $query),
            422,
            'Searches that look like contact details are not saved to search history.'
        );

        ProductSearch::create([
            'user_id' => $request->user()->id,
            'query' => $query,
            'normalized_query' => Str::lower($query),
        ]);

        return $this->history($request);
    }

    public function clearHistory(Request $request)
    {
        ProductSearch::query()->where('user_id', $request->user()->id)->delete();

        return response()->json(['data' => []]);
    }

    private function priceRange(array $filters): array
    {
        return match ($filters['price_range'] ?? 'any') {
            '0-250' => [0, 250],
            '251-500' => [251, 500],
            '501-1000' => [501, 999.99],
            '1000+' => [1000, null],
            default => [$filters['min_price'] ?? null, $filters['max_price'] ?? null],
        };
    }

    private function searchTerms(string $query): array
    {
        $terms = collect(preg_split('/\s+/u', mb_strtolower($query), -1, PREG_SPLIT_NO_EMPTY))
            ->filter(fn (string $term) => mb_strlen($term) >= 2)
            ->reject(fn (string $term) => in_array($term, ['a', 'an', 'and', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with'], true))
            ->take(8)
            ->values()
            ->all();

        return $terms !== [] ? $terms : [mb_strtolower($query)];
    }

    private function popularSearches(): array
    {
        return ProductSearch::query()
            ->selectRaw('normalized_query, MIN(query) as query, COUNT(*) as searches')
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('normalized_query')
            ->havingRaw('COUNT(DISTINCT user_id) >= 5')
            ->orderByDesc('searches')
            ->limit(6)
            ->get()
            ->pluck('query')
            ->all();
    }

    private function trendingSearches(): array
    {
        return ProductSearch::query()
            ->selectRaw('normalized_query, MIN(query) as query, COUNT(*) as searches')
            ->where('created_at', '>=', now()->subDays(7))
            ->groupBy('normalized_query')
            ->havingRaw('COUNT(DISTINCT user_id) >= 5')
            ->orderByDesc('searches')
            ->limit(6)
            ->get()
            ->pluck('query')
            ->all();
    }
}
