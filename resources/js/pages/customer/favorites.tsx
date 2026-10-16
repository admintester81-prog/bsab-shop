import { PortalLayout } from '@/components/portal-layout';
import ProductCard from '@/components/ProductCard';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Heart, ShoppingCart, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import '../../../css/design.css';

type Product = {
    id: number;
    name: string;
    base_price: string;
    sale_price?: string;
    stock_quantity: number;
    available_stock: number;
    is_out_of_stock: boolean;
    average_rating: number;
    review_count: number;
    selling_unit?: string | null;
    category?: { name: string; slug: string } | null;
    shop?: { name: string };
    images?: { path: string }[];
};

type Toast = { id: number; message: string; undoFn?: () => void };
let _toastId = 0;

export default function CustomerFavorites({ products = [] }: { products?: Product[] }) {
    const [favoriteIds, setFavoriteIds] = useState<number[]>(() => products.map((product) => product.id));
    const [removing, setRemoving] = useState<Set<number>>(new Set());
    const [toast, setToast] = useState<Toast | null>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Try to read cart count from Inertia shared props
    const { cartCount = 0 } = usePage<{ cartCount?: number }>().props;

    const favorites = useMemo(() => products.filter((p) => favoriteIds.includes(p.id)), [favoriteIds, products]);

    function showToast(message: string, undoFn?: () => void) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        const id = ++_toastId;
        setToast({ id, message, undoFn });
        toastTimer.current = setTimeout(() => setToast(null), 4000);
    }

    function dismissToast() {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(null);
    }

    function removeFavorite(productId: number) {
        const removedIndex = favoriteIds.indexOf(productId);
        setRemoving((prev) => new Set(prev).add(productId));
        setTimeout(() => {
            setFavoriteIds((cur) => cur.filter((id) => id !== productId));
            setRemoving((prev) => {
                const n = new Set(prev);
                n.delete(productId);
                return n;
            });
            router.post(route('customer.favorites.toggle', productId), {}, {
                preserveScroll: true,
                onError: () => {
                    setFavoriteIds((cur) => [...cur, productId]);
                    showToast('Could not remove this favorite. Please try again.');
                },
            });
            showToast('Removed from favorites', () => {
                setFavoriteIds((cur) => {
                    const next = cur.filter((id) => id !== productId);
                    next.splice(removedIndex, 0, productId);
                    return next;
                });
                router.post(route('customer.favorites.toggle', productId), {}, { preserveScroll: true });
                dismissToast();
            });
        }, 200);
    }

    function clearAll() {
        router.delete(route('customer.favorites.clear'), {
            preserveScroll: true,
            onSuccess: () => {
                setFavoriteIds([]);
                showToast('All favorites cleared');
            },
            onError: () => showToast('Could not clear favorites. Please try again.'),
        });
    }

    return (
        <>
            <Head title="Favorites" />
            <PortalLayout role="customer" hideHeader>
                {/* Top nav */}
                <div className="mb-6 flex items-center justify-between">
                    <Link
                        href={route('marketplace')}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#4a5568] transition-colors hover:bg-[#f5fcf7] hover:text-[#163b24]"
                        aria-label="Back to shop"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-xl font-extrabold tracking-tight text-[#163b24]">Favorites</h1>
                    <Link
                        href={route('customer.cart')}
                        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#163b24] transition-colors hover:bg-[#f5fcf7]"
                        aria-label={`Open cart, ${cartCount} items`}
                    >
                        <ShoppingCart size={18} />
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2c9350] px-1 text-[9px] font-bold text-white">
                                {cartCount}
                            </span>
                        )}
                    </Link>
                </div>

                {/* Page sub-header */}
                {favorites.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm text-[#647568]">
                            {favorites.length} product{favorites.length !== 1 ? 's' : ''} you've saved — add them to your cart or let them go anytime.
                        </p>
                        <button
                            onClick={clearAll}
                            className="shrink-0 text-sm text-[#647568] underline-offset-2 transition-colors hover:text-[#163b24] hover:underline"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Grid */}
                {favorites.length > 0 ? (
                    <div className="grid grid-cols-2 gap-5.5 sm:grid-cols-3 lg:grid-cols-4">
                        {favorites.map((product) => {
                            const isFading = removing.has(product.id);
                            return (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    liked={favoriteIds.includes(product.id)}
                                    onToggleFavorite={() => removeFavorite(product.id)}
                                    onOpenProduct={() => router.visit(route('products.show', product.id))}
                                    style={
                                        isFading
                                            ? { opacity: 0, transform: 'scale(0.95)', transition: 'opacity 200ms ease, transform 200ms ease' }
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </div>
                ) : (
                    /* Empty state */
                    <section className="flex flex-col items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white px-8 py-20 text-center shadow-sm">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f0fdf4] text-[#2c9350]">
                            <Heart size={32} strokeWidth={1.5} />
                        </div>
                        <h2 className="mt-5 text-2xl font-bold text-[#163b24]">No favorites yet</h2>
                        <p className="mt-2 max-w-xs text-sm text-[#647568]">Save products from the marketplace and they will appear here.</p>
                        <Link
                            href={route('marketplace')}
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2c9350] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#247a43]"
                        >
                            Browse products
                        </Link>
                    </section>
                )}

                {/* Toast */}
                {toast && (
                    <div
                        key={toast.id}
                        className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#1a2e1f] px-5 py-3 text-sm text-white shadow-xl"
                        style={{ animation: 'favFadeInUp 0.2s ease' }}
                    >
                        <span>{toast.message}</span>
                        {toast.undoFn && (
                            <button onClick={toast.undoFn} className="font-bold text-[#4ade80] transition-colors hover:text-[#86efac]">
                                Undo
                            </button>
                        )}
                        <button onClick={dismissToast} className="ml-1 text-white/60 transition-colors hover:text-white" aria-label="Dismiss">
                            <X size={14} />
                        </button>
                    </div>
                )}
                <style>{`
                    @keyframes favFadeInUp {
                        from { opacity: 0; transform: translate(-50%, 10px); }
                        to   { opacity: 1; transform: translate(-50%, 0); }
                    }
                `}</style>
            </PortalLayout>
        </>
    );
}
