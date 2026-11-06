import { api, addCartItem, getApiErrorMessage } from '@/lib/api';
import { Link, router } from '@inertiajs/react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Clock3, Filter, Search, ShoppingCart, Sparkles, Star, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type SearchCategory = { id: number; name: string; slug: string };
type SearchProduct = {
    id: number;
    uuid: string;
    name: string;
    description?: string | null;
    base_price: string | number;
    sale_price?: string | number | null;
    stock_quantity: number;
    available_stock?: number;
    is_out_of_stock?: boolean;
    average_rating?: number;
    review_count?: number;
    sales_count?: number | null;
    discount_percentage?: number;
    category?: { name: string; slug: string } | null;
    shop?: { id: number; name: string } | null;
    images?: { path: string }[];
};
type SearchResponse = {
    products: { data: SearchProduct[]; current_page: number; last_page: number; total: number };
    suggestions: string[];
    intent: string;
    ai_enabled: boolean;
    popular_searches: string[];
    trending_searches: string[];
    categories: SearchCategory[];
    sellers: { id: number; name: string }[];
};
type Filters = {
    price_range: string;
    category: string;
    seller: string;
    availability: boolean;
    rating: string;
    discount: boolean;
    sort: 'all' | 'best' | 'top_sales' | 'latest';
};

const emptyFilters: Filters = {
    price_range: 'any',
    category: '',
    seller: '',
    availability: false,
    rating: '',
    discount: false,
    sort: 'all',
};

function useDebouncedValue(value: string, delay = 450) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value.trim()), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function imageUrl(path?: string) {
    if (!path) return null;
    return path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`;
}

function formatPrice(value: string | number) {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadLocalHistory() {
    try {
        const history = JSON.parse(window.localStorage.getItem('bsabshop-search-history') || '[]');
        return Array.isArray(history) ? history.filter((term): term is string => typeof term === 'string').slice(0, 8) : [];
    } catch {
        return [];
    }
}

function saveLocalHistory(query: string) {
    const history = [query, ...loadLocalHistory().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
    window.localStorage.setItem('bsabshop-search-history', JSON.stringify(history));
    return history;
}

function SearchProductCard({ product, authenticated }: { product: SearchProduct; authenticated: boolean }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const queryClient = useQueryClient();
    const image = imageUrl(product.images?.[0]?.path);
    const price = product.sale_price ?? product.base_price;
    const isInStock = !(product.is_out_of_stock ?? product.available_stock === 0);

    async function addToCart(event: React.MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
        if (!authenticated) {
            router.visit(route('login'));
            return;
        }
        setBusy(true);
        setMessage('');
        try {
            await addCartItem({ product_id: product.id, quantity: 1 });
            setMessage('Added to cart');
            await queryClient.invalidateQueries({ queryKey: ['cart'] });
        } catch (error) {
            setMessage(getApiErrorMessage(error, 'Could not add this product to your cart.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <article className="group min-w-0 overflow-hidden rounded-2xl border border-[#e1eee5] bg-white shadow-[0_5px_18px_rgba(22,59,36,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(22,59,36,0.1)]">
            <Link href={route('products.show', product.uuid)} className="block">
                <div className="relative aspect-square overflow-hidden bg-[#f0f7f2]">
                    {image ? (
                        <img src={image} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                        <div className="grid h-full place-items-center text-sm font-semibold text-[#7b9584]">Product image unavailable</div>
                    )}
                    {!!product.discount_percentage && (
                        <span className="absolute top-2 left-2 rounded-full bg-[#15803d] px-2 py-1 text-[10px] font-bold text-white">
                            -{product.discount_percentage}%
                        </span>
                    )}
                </div>
                <div className="p-3">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#25834a]">{product.category?.name || 'Marketplace'}</p>
                    <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold text-[#173b2a]">{product.name}</h3>
                    <p className="mt-1 truncate text-xs text-[#708178]">{product.shop?.name || 'Marketplace seller'}</p>
                    <div className="mt-2 flex min-h-4 items-center gap-1 text-[11px] text-[#61746a]">
                        {product.average_rating ? (
                            <>
                                <Star size={12} fill="#eab308" className="text-[#eab308]" />
                                <span>{Number(product.average_rating).toFixed(1)}</span>
                                {product.review_count ? <span>({product.review_count})</span> : null}
                            </>
                        ) : <span className="text-[#8b9b91]">No ratings yet</span>}
                        {typeof product.sales_count === 'number' && product.sales_count > 0 && (
                            <span className="ml-auto">{product.sales_count.toLocaleString()} sold</span>
                        )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-display text-base font-extrabold text-[#145437]">{formatPrice(price)}</span>
                        {product.sale_price && Number(product.sale_price) < Number(product.base_price) && (
                            <span className="text-xs text-[#91a197] line-through">{formatPrice(product.base_price)}</span>
                        )}
                    </div>
                </div>
            </Link>
            <div className="px-3 pb-3">
                <button
                    type="button"
                    disabled={!isInStock || busy}
                    onClick={addToCart}
                    className="flex min-h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#167a3a] px-3 text-xs font-bold text-white transition hover:bg-[#11632f] disabled:cursor-not-allowed disabled:bg-[#d8e4dc] disabled:text-[#6c8073]"
                >
                    <ShoppingCart size={14} /> {busy ? 'Adding…' : isInStock ? 'Add to cart' : 'Out of stock'}
                </button>
                {message && <p className="mt-1 text-center text-[10px] text-[#557261]" role="status">{message}</p>}
            </div>
        </article>
    );
}

export function ProductSearchAutocomplete({
    query,
    open,
    authenticated,
    onSelect,
}: {
    query: string;
    open: boolean;
    authenticated: boolean;
    onSelect: (query: string) => void;
}) {
    const debouncedQuery = useDebouncedValue(query);
    const [localHistory, setLocalHistory] = useState<string[]>([]);
    const search = useQuery<SearchResponse>({
        queryKey: ['product-search-autocomplete', debouncedQuery],
        queryFn: async () => (await api.get<SearchResponse>('/products/search', { params: { q: debouncedQuery, sort: 'best' } })).data,
        enabled: open && debouncedQuery.length >= 2,
        staleTime: 30_000,
        retry: false,
    });
    const history = useQuery<{ data: string[] }>({
        queryKey: ['product-search-history'],
        queryFn: async () => (await api.get<{ data: string[] }>('/customer/search-history')).data,
        enabled: open && authenticated,
        retry: false,
    });

    useEffect(() => setLocalHistory(loadLocalHistory()), [open]);
    const historyItems = authenticated ? history.data?.data ?? [] : localHistory;
    const suggestedProducts = search.data?.products.data.slice(0, 4) ?? [];
    const terms = search.data?.suggestions ?? [];
    if (!open) return null;

    return (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(70vh,600px)] overflow-y-auto rounded-2xl border border-[#dcebe0] bg-white p-4 text-left shadow-[0_18px_48px_rgba(20,65,39,0.16)]">
            {query.trim().length < 2 ? (
                <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#174c31]"><Clock3 size={16} /> Recent searches</div>
                    {historyItems.length ? (
                        <div className="flex flex-wrap gap-2">
                            {historyItems.map((item) => (
                                <button key={item} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className="rounded-full border border-[#e2eee5] bg-[#f7fbf8] px-3 py-1.5 text-xs text-[#526b5b] hover:border-[#9acaab] hover:text-[#167a3a]">
                                    {item}
                                </button>
                            ))}
                        </div>
                    ) : <p className="m-0 text-xs text-[#829187]">Start typing to see product matches and suggestions.</p>}
                </div>
            ) : search.isError ? (
                <p className="m-0 text-sm text-[#9b443a]" role="alert">Search suggestions are temporarily unavailable.</p>
            ) : search.isLoading ? (
                <p className="m-0 text-sm text-[#718377]">Finding matching products…</p>
            ) : (
                <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(220px,.9fr)]">
                    <div>
                        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#174c31]"><Search size={14} /> Matching products</p>
                        <div className="space-y-1">
                            {suggestedProducts.map((product) => (
                                <Link key={product.id} href={route('products.show', product.uuid)} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[#f4faf5]">
                                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#edf6ef]">
                                        {product.images?.[0]?.path ? <img src={imageUrl(product.images[0].path) || undefined} alt="" className="h-full w-full object-cover" /> : null}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-[#244a32]">{product.name}</span>
                                        <span className="block truncate text-[11px] text-[#7a8b80]">{product.category?.name || 'Published product'} · {formatPrice(product.sale_price ?? product.base_price)}</span>
                                    </span>
                                    <ChevronRight size={16} className="shrink-0 text-[#7b9584]" />
                                </Link>
                            ))}
                            {!suggestedProducts.length && <p className="m-0 rounded-xl bg-[#f7faf8] p-3 text-xs text-[#718377]">No matching published products yet. Try another keyword or browse a category.</p>}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {!!terms.length && (
                            <div>
                                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#174c31]"><Sparkles size={14} /> AI suggestions</p>
                                <div className="flex flex-wrap gap-2">{terms.map((term) => <button key={term} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(term)} className="rounded-full bg-[#eaf7ed] px-3 py-1.5 text-xs font-medium text-[#24673b] hover:bg-[#d8f0df]">{term}</button>)}</div>
                            </div>
                        )}
                        {!!search.data?.trending_searches.length && (
                            <div>
                                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#174c31]"><TrendingUp size={14} /> Trending searches</p>
                                <div className="flex flex-wrap gap-2">{search.data.trending_searches.slice(0, 4).map((term) => <button key={term} type="button" onClick={() => onSelect(term)} className="rounded-full border border-[#e2eee5] px-3 py-1.5 text-xs text-[#526b5b] hover:border-[#9acaab]">{term}</button>)}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProductSearchExperience({
    query,
    categories,
    authenticated,
    onCommitSearch,
}: {
    query: string;
    categories: SearchCategory[];
    authenticated: boolean;
    onCommitSearch: (query: string) => void;
}) {
    const debouncedQuery = useDebouncedValue(query);
    const [filters, setFilters] = useState<Filters>(emptyFilters);
    const [draft, setDraft] = useState<Filters>(emptyFilters);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [localHistory, setLocalHistory] = useState<string[]>([]);
    const [notice, setNotice] = useState('');
    const queryClient = useQueryClient();

    useEffect(() => setLocalHistory(loadLocalHistory()), []);
    const search = useInfiniteQuery<SearchResponse>({
        queryKey: ['product-search-results', debouncedQuery, filters],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => (await api.get<SearchResponse>('/products/search', {
            params: {
                q: debouncedQuery,
                ...filters,
                seller: filters.seller || undefined,
                rating: filters.rating || undefined,
                availability: filters.availability || undefined,
                discount: filters.discount || undefined,
                page: pageParam,
            },
        })).data,
        getNextPageParam: (lastPage) => lastPage.products.current_page < lastPage.products.last_page
            ? lastPage.products.current_page + 1
            : undefined,
        enabled: debouncedQuery.length >= 2,
        staleTime: 20_000,
        retry: false,
    });
    const history = useQuery<{ data: string[] }>({
        queryKey: ['product-search-history'],
        queryFn: async () => (await api.get<{ data: string[] }>('/customer/search-history')).data,
        enabled: authenticated,
        retry: false,
    });
    const result = search.data?.pages.at(-1);
    const products = search.data?.pages.flatMap((page) => page.products.data) ?? [];
    const historyItems = authenticated ? history.data?.data ?? [] : localHistory;
    const categoriesToShow = result?.categories.length ? result.categories : categories;
    const matchedCategory = useMemo(() => categoriesToShow.find((category) => category.slug === draft.category), [categoriesToShow, draft.category]);

    async function commitSearch(term: string) {
        const normalized = term.trim();
        if (normalized.length < 2) return;
        onCommitSearch(normalized);
        if (authenticated) {
            try {
                await api.post('/customer/search-history', { query: normalized });
                await queryClient.invalidateQueries({ queryKey: ['product-search-history'] });
            } catch {
                setNotice('Search results are available, but this search could not be saved to your account history.');
            }
        } else {
            setLocalHistory(saveLocalHistory(normalized));
        }
    }

    function chooseTerm(term: string) {
        void commitSearch(term);
    }

    async function clearHistory() {
        if (authenticated) {
            try {
                await api.delete('/customer/search-history');
                await queryClient.invalidateQueries({ queryKey: ['product-search-history'] });
            } catch {
                setNotice('Could not clear your saved search history. Please try again.');
            }
        } else {
            window.localStorage.removeItem('bsabshop-search-history');
            setLocalHistory([]);
        }
    }

    function applyFilters() {
        setFilters(draft);
        setFiltersOpen(false);
    }

    function resetFilters() {
        setDraft(emptyFilters);
        setFilters(emptyFilters);
    }

    if (query.trim().length < 2) return null;

    return (
        <section className="mt-5 space-y-4" aria-label="AI-assisted product search">
            {notice && <p className="rounded-xl border border-[#f1d7af] bg-[#fff9ed] px-4 py-2 text-sm text-[#805b20]" role="status">{notice}</p>}
            <section className="rounded-2xl border border-[#d8efdf] bg-gradient-to-r from-[#f0fbf3] to-white p-4 shadow-[0_5px_18px_rgba(22,59,36,0.05)] sm:p-5">
                <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#167a3a] text-white"><Sparkles size={19} /></span>
                    <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-bold text-[#174c31]">AI search assistant</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#61776a]">{result?.intent || `Finding published products related to “${debouncedQuery}”…`}</p>
                        {result?.ai_enabled && <span className="mt-2 inline-flex rounded-full bg-[#e0f3e5] px-2.5 py-1 text-[10px] font-semibold text-[#257340]">AI suggestions based on catalog matches</span>}
                    </div>
                </div>
                <div className="mt-4 grid gap-4 border-t border-[#dfede2] pt-4 md:grid-cols-2">
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h2 className="m-0 flex items-center gap-2 text-xs font-bold text-[#244b33]"><Sparkles size={14} /> Related searches</h2>
                            <span className="text-[10px] text-[#8a9b90]">Catalog-grounded</span>
                        </div>
                        {result?.suggestions.length ? (
                            <div className="flex flex-wrap gap-2">
                                {result.suggestions.map((term) => <button key={term} type="button" onClick={() => chooseTerm(term)} className="rounded-full border border-[#d9eadf] bg-white px-3 py-1.5 text-xs text-[#375744] transition hover:border-[#8bc59b] hover:text-[#167a3a]">{term}<ArrowRight size={12} className="ml-1 inline" /></button>)}
                            </div>
                        ) : <p className="m-0 text-xs text-[#819187]">No related catalog keywords found for this search.</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-[#244b33]"><TrendingUp size={14} /> Popular searches</h2>
                            {result?.popular_searches.length ? (
                                <div className="flex flex-wrap gap-1.5">{result.popular_searches.slice(0, 4).map((term) => <button key={term} type="button" onClick={() => chooseTerm(term)} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#63766a] hover:text-[#167a3a]">{term}</button>)}</div>
                            ) : <p className="m-0 text-[11px] text-[#89978f]">Search trends will appear as shoppers explore.</p>}
                        </div>
                        <div>
                            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold text-[#244b33]"><Clock3 size={14} /> Recent searches <button type="button" onClick={clearHistory} disabled={!historyItems.length} className="ml-auto text-[10px] font-medium text-[#718377] underline disabled:no-underline disabled:opacity-50">Clear all</button></h2>
                            {historyItems.length ? (
                                <div className="flex flex-wrap gap-1.5">{historyItems.slice(0, 4).map((term) => <button key={term} type="button" onClick={() => chooseTerm(term)} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#63766a] hover:text-[#167a3a]">{term}</button>)}</div>
                            ) : <p className="m-0 text-[11px] text-[#89978f]">Your searches will be listed here.</p>}
                        </div>
                    </div>
                </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0ede4] bg-white p-3 shadow-[0_3px_12px_rgba(22,59,36,0.04)]">
                <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Sort products">
                    {[
                    { id: 'all', label: 'All' },
                    { id: 'best', label: 'Best Match' },
                    { id: 'top_sales', label: 'Top Sales' },
                    { id: 'latest', label: 'Latest' },
                    ].map((item) => (
                        <button key={item.id} type="button" role="tab" aria-selected={filters.sort === item.id} onClick={() => {
                            const next = { ...filters, sort: item.id as Filters['sort'] };
                            setFilters(next);
                            setDraft(next);
                        }} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${filters.sort === item.id ? 'bg-[#e7f5eb] text-[#167a3a]' : 'text-[#718377] hover:bg-[#f5faf6]'}`}>{item.label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <p className="m-0 text-xs text-[#708178]">{search.isFetching ? 'Updating…' : `${result?.products.total ?? 0} matching products`}</p>
                    <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} className="inline-flex items-center gap-2 rounded-xl border border-[#dcebe0] px-3 py-2 text-xs font-semibold text-[#315947] hover:bg-[#f6faf7]">
                        <Filter size={14} /> Filters
                    </button>
                </div>
            </div>

            {search.isError ? (
                <div className="rounded-2xl border border-[#f0cbc3] bg-[#fff8f6] p-6 text-sm text-[#a94435]" role="alert">{getApiErrorMessage(search.error, 'Product search is temporarily unavailable.')}</div>
            ) : search.isLoading ? (
                <div className="rounded-2xl border border-[#e0ede4] bg-white p-10 text-center text-sm text-[#718377]">Searching published products…</div>
            ) : (
                <div className={`grid items-start gap-4 ${filtersOpen ? 'lg:grid-cols-[250px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
                    {filtersOpen && (
                        <aside className="space-y-4 rounded-2xl border border-[#e0ede4] bg-white p-4 shadow-[0_3px_12px_rgba(22,59,36,0.04)]">
                            <div className="flex items-center justify-between">
                                <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-[#174c31]"><Filter size={16} /> Filter &amp; sort</h2>
                                <button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#277645] hover:underline">Reset</button>
                            </div>
                            <fieldset className="border-0 border-t border-[#edf3ef] p-0 pt-3">
                                <legend className="mb-2 text-xs font-bold text-[#315743]">Price range</legend>
                                <div className="grid grid-cols-2 gap-2">
                                    {[['any', 'Any'], ['0-250', '₱0–₱250'], ['251-500', '₱251–₱500'], ['501-1000', '₱501–₱1,000'], ['1000+', '₱1,000+']].map(([value, label]) => (
                                        <button key={value} type="button" onClick={() => setDraft((current) => ({ ...current, price_range: value }))} className={`rounded-xl border px-2 py-2 text-[11px] font-medium ${draft.price_range === value ? 'border-[#78bd8d] bg-[#eff9f1] text-[#167a3a]' : 'border-[#e1ebe4] text-[#63766a]'}`}>{label}</button>
                                    ))}
                                </div>
                            </fieldset>
                            <label className="block border-t border-[#edf3ef] pt-3 text-xs font-bold text-[#315743]">
                                Category
                                <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#dcebe0] bg-white px-3 py-2 text-xs font-normal text-[#375744]">
                                    <option value="">All categories</option>
                                    {categoriesToShow.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
                                </select>
                            </label>
                            {result?.sellers.length ? <label className="block border-t border-[#edf3ef] pt-3 text-xs font-bold text-[#315743]">Seller<select value={draft.seller} onChange={(event) => setDraft((current) => ({ ...current, seller: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#dcebe0] bg-white px-3 py-2 text-xs font-normal text-[#375744]"><option value="">All sellers</option>{result.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label> : null}
                            <label className="flex items-center justify-between border-t border-[#edf3ef] pt-3 text-xs font-semibold text-[#315743]">Minimum rating<select value={draft.rating} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value }))} className="rounded-lg border border-[#dcebe0] bg-white px-2 py-1.5 text-xs"><option value="">Any</option><option value="3">3+ stars</option><option value="4">4+ stars</option><option value="4.5">4.5+ stars</option></select></label>
                            <label className="flex items-center gap-2 border-t border-[#edf3ef] pt-3 text-xs font-semibold text-[#315743]"><input type="checkbox" checked={draft.availability} onChange={(event) => setDraft((current) => ({ ...current, availability: event.target.checked }))} className="accent-[#167a3a]" /> In stock only</label>
                            <label className="flex items-center gap-2 text-xs font-semibold text-[#315743]"><input type="checkbox" checked={draft.discount} onChange={(event) => setDraft((current) => ({ ...current, discount: event.target.checked }))} className="accent-[#167a3a]" /> Discounted items</label>
                            {matchedCategory && <p className="m-0 text-[10px] text-[#829187]">Showing products in {matchedCategory.name}.</p>}
                            <button type="button" onClick={applyFilters} className="w-full rounded-xl bg-[#167a3a] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#11632f]">Apply filters</button>
                        </aside>
                    )}
                    <div className="min-w-0">
                        {result?.trending_searches.length ? <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#f2f9f4] px-3 py-2 text-xs text-[#60766a]"><TrendingUp size={14} className="text-[#228248]" /><span className="font-bold text-[#315743]">Trending</span>{result.trending_searches.slice(0, 4).map((term) => <button key={term} type="button" onClick={() => chooseTerm(term)} className="underline decoration-[#bddcc5] underline-offset-2 hover:text-[#167a3a]">{term}</button>)}</div> : null}
                        {products.length ? (
                            <>
                                <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#d7efde] bg-[#edfaf0] px-3 py-2.5 text-xs text-[#2e6340]"><Sparkles size={15} className="shrink-0 text-[#168b43]" /><span>Based on your search, these published products match your query.</span></div>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                    {products.map((product) => <SearchProductCard key={product.id} product={product} authenticated={authenticated} />)}
                                </div>
                                {search.hasNextPage && <button type="button" onClick={() => void search.fetchNextPage()} disabled={search.isFetchingNextPage} className="mt-5 w-full rounded-xl border border-[#dcebe0] bg-white px-4 py-3 text-sm font-semibold text-[#277645] hover:bg-[#f4faf5] disabled:opacity-60">{search.isFetchingNextPage ? 'Loading…' : 'Load more products'} <ChevronRight size={15} className="inline" /></button>}
                            </>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-[#cfe4d4] bg-white px-5 py-12 text-center">
                                <Search size={28} className="mx-auto text-[#69a97a]" />
                                <h2 className="mt-3 text-base font-bold text-[#174c31]">No matching products found</h2>
                                <p className="mx-auto mt-1 max-w-md text-sm text-[#718377]">We couldn’t find published products for “{debouncedQuery}” with these filters. Try a related catalog term or reset filters.</p>
                                {!!result?.suggestions.length && <div className="mt-4 flex flex-wrap justify-center gap-2">{result.suggestions.map((term) => <button key={term} type="button" onClick={() => chooseTerm(term)} className="rounded-full bg-[#eaf7ed] px-3 py-1.5 text-xs font-medium text-[#24673b]">{term}</button>)}</div>}
                                <button type="button" onClick={resetFilters} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#b8d9c0] px-4 py-2 text-xs font-semibold text-[#277645]">Reset filters <X size={13} /></button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
