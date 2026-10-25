import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronLeft, Grid2X2, Heart, Home, Search, ShoppingCart, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import '../../../css/design.css';
import ProductCard from '../../components/ProductCard';

/* ─── Types ─────────────────────────────────────────────── */
type Category = { id: number; name: string; slug: string };
type Product = {
    id: number;
    uuid: string;
    name: string;
    description?: string | null;
    base_price: string;
    sale_price?: string | null;
    stock_quantity: number;
    available_stock?: number;
    is_out_of_stock?: boolean;
    average_rating?: number;
    review_count?: number;
    selling_unit?: string | null;
    is_favorited?: boolean;
    category?: { name: string; slug: string } | null;
    shop?: { name: string } | null;
    images?: { path: string }[];
};

/* ─── Page ───────────────────────────────────────────────── */
export default function CustomerProducts({
    products = [],
    categories = [],
    query = '',
}: {
    products?: Product[];
    categories?: Category[];
    query?: string;
}) {
    const { auth, cartCount = 0 } = usePage<{ auth: { user: { id: number } | null }; cartCount?: number }>().props;
    const [search, setSearch] = useState(query);
    const [category, setCategory] = useState('all');
    const [favorites, setFavorites] = useState<number[]>(() => products.filter((p) => p.is_favorited).map((p) => p.id));
    const [sortBy, setSortBy] = useState<'latest' | 'price-asc' | 'price-desc' | 'rating'>('latest');
    const [inStockOnly, setInStockOnly] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);

    function toggleFavorite(productId: number) {
        if (!auth?.user) {
            router.visit(route('login'));
            return;
        }
        setFavorites((cur) => (cur.includes(productId) ? cur.filter((id) => id !== productId) : [...cur, productId]));
        router.post(route('customer.favorites.toggle', productId), {}, { preserveScroll: true });
    }

    /* Filtering + sorting */
    const filteredProducts = useMemo(() => {
        const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
        let result = products.filter((p) => {
            const text = [p.name, p.description, p.shop?.name, p.category?.name].filter(Boolean).join(' ').toLowerCase();
            const matchCategory = category === 'all' || p.category?.slug === category;
            const matchSearch = terms.length === 0 || terms.every((t) => text.includes(t));
            const matchStock = !inStockOnly || (p.stock_quantity > 0 && !p.is_out_of_stock);
            return matchCategory && matchSearch && matchStock;
        });
        if (sortBy === 'price-asc') result = [...result].sort((a, b) => Number(a.sale_price ?? a.base_price) - Number(b.sale_price ?? b.base_price));
        else if (sortBy === 'price-desc') result = [...result].sort((a, b) => Number(b.sale_price ?? b.base_price) - Number(a.sale_price ?? a.base_price));
        else if (sortBy === 'rating') result = [...result].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
        return result;
    }, [products, search, category, sortBy, inStockOnly]);

    const hasActiveFilters = sortBy !== 'latest' || inStockOnly || category !== 'all';

    return (
        <>
            <Head title="Products – Fresh Arrivals" />

            <div className="wrap">
                {/* ── Top bar ─────────────────────────────── */}
                <div className="topbar">
                    <a href="/" className="icon-btn plain" aria-label="Back to home">
                        <ChevronLeft size={20} />
                    </a>

                    <div className="search-pill">
                        <Search size={16} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search products, vendors…"
                            aria-label="Search products"
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-[#5c6e63] hover:text-[#173b2a]">
                                <X size={15} />
                            </button>
                        )}
                        {/* Universal filter icon - mobile only */}
                        <button
                            type="button"
                            onClick={() => setFilterOpen(true)}
                            className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#eaf4ed] hover:text-[#1f7a42] active:scale-95 sm:hidden"
                            aria-label="Open filter options"
                            title="Filter & sort products"
                        >
                            <SlidersHorizontal size={17} strokeWidth={2.2} />
                            {hasActiveFilters && (
                                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#1f7a42] ring-2 ring-white" />
                            )}
                        </button>
                    </div>

                    <Link href="/customer/cart" className="relative icon-btn accent" aria-label={`Cart, ${cartCount} items`}>
                        <ShoppingCart size={20} />
                        {cartCount > 0 && (
                            <span className="cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                        )}
                    </Link>
                </div>

                {/* ── Title row ───────────────────────────── */}
                <div className="title-row">
                    <div className="title-group">
                        <h1>Fresh Arrivals</h1>
                        <span className="count-badge">{filteredProducts.length}</span>
                    </div>
                </div>

                {/* ── Category chips ──────────────────────── */}
                <div className="chip-row">
                    <button className={`chip${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>
                        All
                    </button>
                    {categories.map((cat) => (
                        <button key={cat.id} className={`chip${category === cat.slug ? 'active' : ''}`} onClick={() => setCategory(cat.slug)}>
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* ── Product grid ────────────────────────── */}
                <div className="product-grid">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => {
                            const liked = favorites.includes(product.id);
                            return (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    liked={liked}
                                    onToggleFavorite={() => toggleFavorite(product.id)}
                                    onOpenProduct={() => router.visit(route('products.show', product.uuid))}
                                />
                            );
                        })
                    ) : (
                        <div className="empty-state">No products match your search.</div>
                    )}
                </div>
            </div>

            {/* ── Bottom nav (mobile/tablet only) ────────── */}
            <nav className="bottom-nav">
                <Link href="/" className="bottom-nav-item">
                    <Home size={22} />
                    <span>Home</span>
                </Link>
                <Link href="/customer/products" className="bottom-nav-item active">
                    <Grid2X2 size={22} />
                    <span>Products</span>
                </Link>
                <Link href="/customer/favorites" className="bottom-nav-item">
                    <Heart size={22} />
                    <span>Favorites</span>
                </Link>
                <Link href="/customer/cart" className="relative bottom-nav-item">
                    <ShoppingCart size={22} />
                    <span>Cart</span>
                    {cartCount > 0 && (
                        <span className="absolute -top-0.5 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2a9b59] px-1 text-[9px] font-bold text-white">
                            {cartCount > 99 ? '99+' : cartCount}
                        </span>
                    )}
                </Link>
                <Link href="/customer/profile" className="bottom-nav-item">
                    <UserRound size={22} />
                    <span>Profile</span>
                </Link>
            </nav>

            {/* ── Mobile Universal Filter Bottom Sheet ─── */}
            {filterOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:hidden"
                    onClick={() => setFilterOpen(false)}
                >
                    <div
                        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-[#def0e2] bg-white p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[#e5eee7] pb-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f5ec] text-[#1f7a42]">
                                    <SlidersHorizontal size={16} strokeWidth={2.2} />
                                </span>
                                <h3 className="font-display text-base font-bold text-[#145437]">Filter &amp; Sort Products</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFilterOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5c6e63] hover:bg-[#f5fcf7]"
                                aria-label="Close filters"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 py-4 text-xs">
                            {/* Sort Section */}
                            <div>
                                <span className="mb-2 block font-bold text-[#184c35]">Sort by</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'latest', label: 'Newest First' },
                                        { id: 'price-asc', label: 'Price: Low to High' },
                                        { id: 'price-desc', label: 'Price: High to Low' },
                                        { id: 'rating', label: 'Highest Rated' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSortBy(opt.id as typeof sortBy)}
                                            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                                                sortBy === opt.id
                                                    ? 'border-[#1f7a42] bg-[#f0faf3] text-[#1f7a42]'
                                                    : 'border-[#dfeae2] bg-[#fbfdfb] text-[#5c6e63] hover:bg-white'
                                            }`}
                                        >
                                            <span>{opt.label}</span>
                                            {sortBy === opt.id && <Check size={14} className="text-[#1f7a42]" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stock Availability */}
                            <div>
                                <span className="mb-2 block font-bold text-[#184c35]">Availability</span>
                                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#dfeae2] bg-[#fbfdfb] p-3 text-xs font-semibold text-[#184c35]">
                                    <span>In stock items only</span>
                                    <input
                                        type="checkbox"
                                        checked={inStockOnly}
                                        onChange={(e) => setInStockOnly(e.target.checked)}
                                        className="h-4 w-4 rounded accent-[#1f7a42]"
                                    />
                                </label>
                            </div>

                            {/* Category Section */}
                            <div>
                                <span className="mb-2 block font-bold text-[#184c35]">Category</span>
                                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                                    <button
                                        type="button"
                                        onClick={() => setCategory('all')}
                                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                            category === 'all'
                                                ? 'bg-[#1f7a42] text-white'
                                                : 'border border-[#dfeae2] bg-[#fbfdfb] text-[#5c6e63]'
                                        }`}
                                    >
                                        All Categories
                                    </button>
                                    {categories.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setCategory(c.slug)}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                category === c.slug
                                                    ? 'bg-[#1f7a42] text-white'
                                                    : 'border border-[#dfeae2] bg-[#fbfdfb] text-[#5c6e63]'
                                            }`}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 border-t border-[#e5eee7] pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSortBy('latest');
                                    setInStockOnly(false);
                                    setCategory('all');
                                }}
                                className="flex-1 rounded-xl border border-[#dfeae2] py-2.5 text-center text-xs font-bold text-[#5c6e63] transition hover:bg-[#f5fcf7]"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterOpen(false)}
                                className="grow rounded-xl py-2.5 text-center text-xs font-bold text-white shadow-sm transition"
                                style={{ backgroundColor: '#22c55e' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
                            >
                                Apply Filters ({filteredProducts.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
