import { addCartItem, getApiErrorMessage } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import type { Product, ProductOption, ProductOptionValue, ProductVariant, VoucherOffer } from '@/pages/customer/product-detail';
import { type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import '../../css/design.css';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Grid2X2,
    Heart,
    Home,
    Leaf,
    LogOut,
    Package,
    Recycle,
    RefreshCcw,
    Ruler,
    Search,
    Settings,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Sprout,
    Star,
    TicketPercent,
    Truck,
    UserRound,
    X,
} from 'lucide-react';
import { useState } from 'react';

type ResponsiveProductDetailProps = {
    product: Product;
    similarProducts: Product[];
    availableVouchers: VoucherOffer[];
    voucherAvailabilityError?: string | null;
    selectedImage: string | null;
    displayImage: string | null;
    currentImageIndex: number;
    variantOptions: ProductOption[];
    selectedValues: Record<number, number>;
    matchingVariant: ProductVariant | null;
    price: number;
    originalPrice: number | null;
    discountPercent: number | null;
    stock: number;
    chooseOption: (optionId: number, valueId: number) => void;
    getAvailableValuesForOption: (option: ProductOption) => ProductOptionValue[];
    onChangeImage: (direction: 1 | -1) => void;
    onSelectImage: (path: string) => void;
    onClaimVoucher: (voucherId: number) => void;
    onUseVoucher: (voucher: VoucherOffer, quantity: number) => void;
    actionMessage: string;
    claimedVoucherIds: number[];
    claimingVoucherId: number | null;
    isFavorited: boolean;
    onToggleFavorite: () => void;
};

const colorSwatches: Record<string, string> = {
    white: '#ffffff',
    black: '#171717',
    gray: '#9ca3af',
    grey: '#9ca3af',
    beige: '#dfd3c3',
    blue: '#2563eb',
    navy: '#1e3a8a',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#eab308',
    brown: '#78350f',
    pink: '#ec4899',
    purple: '#9333ea',
    orange: '#ea580c',
    cream: '#fdfbf7',
    silver: '#e2e8f0',
    gold: '#d97706',
};

function formatPrice(value: number | string): string {
    return `₱${(Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function imageUrl(path?: string): string | null {
    return path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null;
}

export default function ResponsiveProductDetail({
    product,
    similarProducts,
    availableVouchers,
    voucherAvailabilityError,
    selectedImage,
    displayImage,
    currentImageIndex,
    variantOptions,
    selectedValues,
    matchingVariant,
    price,
    originalPrice,
    discountPercent,
    stock,
    chooseOption,
    getAvailableValuesForOption,
    onChangeImage,
    onSelectImage,
    onClaimVoucher,
    onUseVoucher,
    actionMessage,
    claimedVoucherIds,
    claimingVoucherId,
    isFavorited,
    onToggleFavorite,
}: ResponsiveProductDetailProps) {
    const { auth, cartCount = 0, siteSettings = {} } = usePage<SharedData>().props;
    const [quantity, setQuantity] = useState(1);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'shipping'>('description');
    const [showSizeGuide, setShowSizeGuide] = useState(false);
    const [favoriteOverrides, setFavoriteOverrides] = useState<Record<number, boolean>>({});

    const brandName = siteSettings.brand_name || 'BSABShop';
    const logoPath = siteSettings.logo_path ? imageUrl(siteSettings.logo_path) : null;
    const sellerName = product.shop?.name ?? 'Marketplace seller';
    const isPopular = Number(product.metrics?.quantity_sold ?? 0) > 20;
    const badge = isPopular ? 'Best Seller' : product.condition ? product.condition[0].toUpperCase() + product.condition.slice(1) : null;
    const rating = Number(product.metrics?.rating_average ?? 0);
    const reviewCount = Number(product.metrics?.rating_count ?? 0);
    const details = [
        ['Product type', product.category?.name],
        ['Brand', product.brand],
        ['Model', product.model],
        ['SKU', product.sku],
        ['Condition', product.condition],
        ['Material', product.material],
        ['Color', product.color],
        ['Size', product.size],
        ['Weight', product.weight],
        ['Volume', product.volume],
        ['Pack quantity', product.pack_quantity == null ? null : String(product.pack_quantity)],
        ['Length', product.length],
        ['Width', product.width],
        ['Height', product.height],
        ['Selling unit', product.selling_unit],
        ['Warranty', product.warranty],
        ['Origin', product.country_of_origin],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
    const highlights = details.filter(([label]) => !['SKU', 'Model'].includes(label)).slice(0, 4);
    const sizeOption = variantOptions.find((option) => /size/i.test(option.name));
    const organicProduct = /organic/i.test([product.name, product.description, product.material].filter(Boolean).join(' '));

    const toggleSimilarFavorite = (item: Product) => {
        if (!auth.user) {
            router.visit(route('login'));
            return;
        }

        const wasFavorited = favoriteOverrides[item.id] ?? Boolean(item.is_favorited);
        setFavoriteOverrides((current) => ({ ...current, [item.id]: !wasFavorited }));
        router.post(route('customer.favorites.toggle', item.id), {}, {
            preserveScroll: true,
            preserveState: true,
            onError: () => setFavoriteOverrides((current) => ({ ...current, [item.id]: wasFavorited })),
        });
    };

    const purchase = async (buyNow: boolean) => {
        if (!auth.user) {
            router.visit(route('login'));
            return;
        }
        if (!stock || (matchingVariant && matchingVariant.is_active === false)) {
            setMessage('This selection is currently out of stock.');
            return;
        }

        setBusy(true);
        setMessage('');
        try {
            await addCartItem({ product_id: product.id, variant_id: matchingVariant?.id, quantity });
            if (buyNow) {
                router.visit(route('customer.checkout'));
                return;
            }
            setMessage(`Added ${quantity} item${quantity === 1 ? '' : 's'} to your cart.`);
        } catch (error) {
            setMessage(getApiErrorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.get(route('home'), { q: search.trim() }, { preserveState: true });
    };

    const avatarUrl = (avatar?: string) => (avatar ? (avatar.startsWith('http') || avatar.startsWith('/') ? avatar : `/storage/${avatar}`) : null);

    const trustItems = [
        {
            icon: organicProduct ? Leaf : Package,
            label: organicProduct ? 'Organic product' : 'Product details',
            detail: product.category?.name ?? 'Seller listing',
        },
        { icon: ShieldCheck, label: 'Secure checkout', detail: 'Protected checkout flow' },
        { icon: Truck, label: 'Delivery', detail: 'Options shown at checkout' },
        { icon: RefreshCcw, label: 'Seller support', detail: sellerName },
    ];

    return (
        <div className="hidden min-h-screen bg-[#f1f7f1] text-[#173a29] min-[446px]:block">
            <header className="border-b border-[#dce9df] bg-white min-[446px]:max-[1021px]:hidden">
                <div className="mx-auto flex w-full max-w-360 flex-wrap items-center gap-3 px-4 py-3 sm:px-5 lg:flex-nowrap lg:gap-5 lg:px-8">
                    <Link href={route('home')} className="flex shrink-0 items-center gap-2" aria-label={`${brandName} home`}>
                        {logoPath ? (
                            <img src={logoPath} alt={brandName} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#25804a]">
                                <Sparkles size={18} />
                            </span>
                        )}
                        <span className="font-display text-xl font-bold text-[#145c3d]">{brandName}</span>
                    </Link>

                    <nav className="hidden items-center gap-1 lg:flex" aria-label="Desktop navigation">
                        <Link
                            href={route('home')}
                            className="flex items-center gap-1.5 border-b-2 border-[#2d9960] px-3 py-2 text-xs font-semibold text-[#1f7a42]"
                        >
                            <Home size={15} /> Home
                        </Link>
                        <Link
                            href={auth.user ? route('customer.products') : route('login')}
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#647568] hover:bg-[#f5fcf7]"
                        >
                            <Grid2X2 size={15} /> Products
                        </Link>
                        <Link
                            href={auth.user ? route('customer.orders') : route('login')}
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#647568] hover:bg-[#f5fcf7]"
                        >
                            <Package size={15} /> Orders
                        </Link>
                        <Link
                            href={auth.user ? route('customer.favorites') : route('login')}
                            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#647568] hover:bg-[#f5fcf7]"
                        >
                            <Heart size={15} /> Favorites
                        </Link>
                    </nav>

                    <form
                        onSubmit={submitSearch}
                        className="order-2 flex w-full items-center gap-2 rounded-full border border-[#dfeae2] bg-[#fbfdfb] px-3.5 py-2.5 focus-within:border-[#2c9350] focus-within:ring-4 focus-within:ring-[#e6f7eb] sm:order-1 sm:w-auto sm:max-w-130 sm:flex-1 lg:order-2 lg:mx-0 lg:max-w-155"
                    >
                        <Search size={16} className="shrink-0 text-[#647568]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search for products, brands and more..."
                            aria-label="Search products"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-[#5c6e63]"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="text-[#5c6e63] hover:text-[#173b2a]"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </form>

                    <div className="order-1 ml-auto flex items-center justify-end gap-2 sm:order-2 sm:ml-5 lg:hidden">
                        <Link
                            href={route('customer.cart')}
                            className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#f5fcf7]"
                            aria-label={`Open cart, ${cartCount} items`}
                        >
                            <ShoppingCart size={18} strokeWidth={2.2} />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2a9b59] px-1 text-[9px] font-bold text-white">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </Link>
                        {auth.user ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setAccountOpen((current) => !current)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#f5fcf7]"
                                    aria-label="Open account menu"
                                    aria-expanded={accountOpen}
                                >
                                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#52b788] text-[10px] font-bold text-[#1b4332]">
                                        {avatarUrl(auth.user.avatar) ? (
                                            <img
                                                src={avatarUrl(auth.user.avatar) as string}
                                                alt={auth.user.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            auth.user.name.slice(0, 2).toUpperCase()
                                        )}
                                    </span>
                                </button>
                                {accountOpen && (
                                    <div className="absolute top-12 right-0 z-30 w-44 rounded-xl border border-[#def0e2] bg-white p-1.5 shadow-[0_8px_25px_rgba(22,59,36,0.1)]">
                                        <Link
                                            href={route('customer.profile')}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                        >
                                            <UserRound size={16} /> Profile
                                        </Link>
                                        <Link
                                            href={route('customer.orders')}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                        >
                                            <Package size={16} /> My orders
                                        </Link>
                                        <Link
                                            href={route('customer.settings')}
                                            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                        >
                                            <Settings size={16} /> Settings
                                        </Link>
                                        <hr className="my-1 border-[#def0e2]" />
                                        <Link
                                            href={route('logout')}
                                            method="post"
                                            as="button"
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#d96c5a] hover:bg-[#fdf0ed]"
                                        >
                                            <LogOut size={16} /> Log out
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link
                                href={route('login')}
                                className="inline-flex items-center justify-center rounded-full bg-[#1f7a42] px-4 py-2 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(31,122,66,0.18)] ring-2 ring-[#edf8f0] transition hover:bg-[#186a3a]"
                            >
                                Log in
                            </Link>
                        )}
                    </div>

                    <div className="order-1 ml-auto hidden items-center justify-end gap-2 sm:order-2 sm:ml-5 lg:order-3 lg:ml-0 lg:flex">
                        {auth.user ? (
                            <>
                                <Link
                                    href={route('customer.cart')}
                                    className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#f5fcf7]"
                                    aria-label={`Open cart, ${cartCount} items`}
                                >
                                    <ShoppingCart size={17} />
                                    {cartCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2a9b59] px-1 text-[9px] font-bold text-white">
                                            {cartCount > 99 ? '99+' : cartCount}
                                        </span>
                                    )}
                                </Link>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setAccountOpen((current) => !current)}
                                        className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[#1b4332] transition hover:bg-[#f5fcf7]"
                                        aria-label="Open account menu"
                                        aria-expanded={accountOpen}
                                    >
                                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#52b788] text-[10px] font-bold text-[#1b4332]">
                                            {avatarUrl(auth.user.avatar) ? (
                                                <img
                                                    src={avatarUrl(auth.user.avatar) as string}
                                                    alt={auth.user.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                auth.user.name.slice(0, 2).toUpperCase()
                                            )}
                                        </span>
                                    </button>
                                    {accountOpen && (
                                        <div className="absolute top-12 right-0 z-30 w-44 rounded-xl border border-[#def0e2] bg-white p-1.5 shadow-[0_8px_25px_rgba(22,59,36,0.1)]">
                                            <Link
                                                href={route('customer.profile')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                            >
                                                <UserRound size={16} /> Profile
                                            </Link>
                                            <Link
                                                href={route('customer.orders')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                            >
                                                <Package size={16} /> My orders
                                            </Link>
                                            <Link
                                                href={route('customer.settings')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                            >
                                                <Settings size={16} /> Settings
                                            </Link>
                                            <hr className="my-1 border-[#def0e2]" />
                                            <Link
                                                href={route('logout')}
                                                method="post"
                                                as="button"
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#d96c5a] hover:bg-[#fdf0ed]"
                                            >
                                                <LogOut size={16} /> Log out
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <Link
                                href={route('login')}
                                className="inline-flex items-center justify-center rounded-full bg-[#1f7a42] px-4 py-2 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(31,122,66,0.18)] ring-2 ring-[#edf8f0] transition hover:bg-[#186a3a]"
                            >
                                Log in
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-360 px-3 py-4 pb-12 sm:px-5 lg:px-8 lg:py-6">
                <div className="mb-4 flex items-center justify-between">
                    <Link
                        href={route('customer.products')}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#35654a] hover:text-[#176b3c]"
                    >
                        <ArrowLeft size={17} /> Products
                    </Link>
                    <div className="text-xs text-[#799082]">
                        {product.category?.name ?? 'Products'} <span className="px-1">/</span> {product.name}
                    </div>
                </div>

                <section className="overflow-hidden rounded-[22px] border border-[#dceade] bg-white shadow-[0_10px_32px_rgba(37,93,54,0.08)]">
                    <div className="grid grid-cols-1 gap-4 p-3 md:gap-5 md:p-4 min-[1021px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-7 xl:p-5">
                        <div className="grid min-w-0 grid-cols-1 gap-2.5 md:gap-3 min-[1021px]:grid-cols-[62px_minmax(0,1fr)]">
                            <div className="flex max-h-115 scrollbar-none flex-col gap-2 overflow-y-auto min-[446px]:max-[1021px]:order-2 min-[446px]:max-[1021px]:max-h-none min-[446px]:max-[1021px]:flex-row min-[446px]:max-[1021px]:overflow-x-auto min-[446px]:max-[1021px]:overflow-y-hidden [&::-webkit-scrollbar]:hidden">
                                {(product.images ?? []).map((image, index) => (
                                    <button
                                        key={`${image.path}-${index}`}
                                        type="button"
                                        onClick={() => onSelectImage(image.path)}
                                        aria-label={`Show product image ${index + 1}`}
                                        className={`flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1 transition min-[446px]:max-[1021px]:w-16 ${
                                            selectedImage === image.path
                                                ? 'border-2 border-[#19824a] shadow-[0_3px_12px_rgba(25,130,74,0.16)]'
                                                : 'border-[#e1ebe3]'
                                        }`}
                                    >
                                        <img
                                            src={imageUrl(image.path) ?? ''}
                                            alt={`${product.name} ${index + 1}`}
                                            className="h-full w-full object-contain"
                                        />
                                    </button>
                                ))}
                                {(product.images ?? []).length === 0 && (
                                    <div className="flex aspect-square items-center justify-center rounded-xl bg-[#eff7f0]">
                                        <Package size={24} />
                                    </div>
                                )}
                            </div>

                            <div className="relative flex min-h-0 aspect-16/10 items-center justify-center overflow-hidden rounded-[18px] bg-[#edf6ee] min-[1021px]:aspect-square">
                                {badge && (
                                    <span className="absolute top-3 left-3 z-10 rounded-full bg-[#168447] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
                                        {badge}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={onToggleFavorite}
                                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                                    aria-pressed={isFavorited}
                                    className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#138047] shadow-sm"
                                >
                                    <Heart size={18} className={isFavorited ? 'fill-[#138047]' : ''} />
                                </button>
                                {displayImage ? (
                                    <img src={displayImage} alt={product.name} className="h-full max-h-130 w-full object-contain p-3 md:p-5" />
                                ) : (
                                    <Package size={76} className="text-[#4d8b62]" />
                                )}
                                {(product.images ?? []).length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onChangeImage(-1)}
                                            aria-label="Previous product image"
                                            className="absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#25633d] shadow-sm"
                                        >
                                            <ArrowLeft size={18} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onChangeImage(1)}
                                            aria-label="Next product image"
                                            className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#25633d] shadow-sm"
                                        >
                                            <ArrowRight size={18} />
                                        </button>
                                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                                            {product.images.map((image, index) => (
                                                <button
                                                    key={image.path}
                                                    type="button"
                                                    onClick={() => onSelectImage(image.path)}
                                                    aria-label={`Go to slide ${index + 1}`}
                                                    className={`h-2 w-2 rounded-full ${index === currentImageIndex ? 'bg-[#168447]' : 'bg-[#cad7cd]'}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-col rounded-2xl border border-[#e5efe7] bg-[#fbfefb] p-4 sm:p-5 xl:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#427151]">
                                        {[product.category?.name, product.brand].filter(Boolean).join(' • ') || 'Product'}
                                    </p>
                                    <h1 className="mt-1 text-2xl leading-tight font-extrabold text-[#153a29] md:text-[1.7rem] xl:text-[2rem]">
                                        {product.name}
                                    </h1>
                                </div>
                                {product.brand && (
                                    <span className="hidden shrink-0 rounded-full bg-[#f0f8f1] px-3 py-1 text-xs font-semibold text-[#477653] xl:inline">
                                        {product.brand}
                                    </span>
                                )}
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs text-[#5e7a68]">
                                <span className="flex items-center gap-0.5 text-[#1a9b52]" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star key={star} size={14} className={rating >= star ? 'fill-current' : 'text-[#c8d4cb]'} />
                                    ))}
                                </span>
                                <strong className="text-[#183b29]">{rating.toFixed(1)}</strong>
                                <span>({reviewCount.toLocaleString()} reviews)</span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <span className="text-[1.9rem] leading-none font-extrabold text-[#168247] xl:text-[2.2rem]">
                                    {formatPrice(price)}
                                </span>
                                {originalPrice !== null && originalPrice > price && (
                                    <span className="text-base text-[#95a69a] line-through">{formatPrice(originalPrice)}</span>
                                )}
                                {discountPercent !== null && discountPercent > 0 && (
                                    <span className="rounded-full bg-[#e6f7eb] px-3 py-1 text-xs font-bold text-[#168247]">
                                        {discountPercent}% OFF
                                    </span>
                                )}
                            </div>

                            {variantOptions.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    {variantOptions.map((option) => {
                                        const available = getAvailableValuesForOption(option);
                                        const selected = option.values.find((value) => value.id === selectedValues[option.id]);
                                        const isSize = /size/i.test(option.name);
                                        const isColor = /color/i.test(option.name);
                                        return (
                                            <div key={option.id}>
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <h2 className="text-sm font-bold text-[#1b3f2b]">{option.name}</h2>
                                                    <span className="text-xs text-[#6b8173]">{selected?.value ?? 'Select an option'}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {option.values.map((value) => {
                                                        const isSelected = selectedValues[option.id] === value.id;
                                                        const isAvailable = available.some((item) => item.id === value.id);
                                                        const swatch = isColor ? colorSwatches[value.value.toLowerCase()] : null;
                                                        return (
                                                            <button
                                                                key={value.id}
                                                                type="button"
                                                                disabled={!isAvailable}
                                                                onClick={() => chooseOption(option.id, value.id)}
                                                                aria-pressed={isSelected}
                                                                className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${isSelected ? 'border-[#158447] bg-[#168447] text-white' : isAvailable ? 'border-[#d7e7da] bg-white text-[#28603c] hover:border-[#82b894]' : 'cursor-not-allowed border-[#edf1ed] bg-[#f6f8f6] text-[#b6c0b8] line-through'}`}
                                                            >
                                                                {swatch && (
                                                                    <span
                                                                        className={`mr-1.5 inline-block h-3 w-3 rounded-full border ${swatch === '#ffffff' ? 'border-[#ccd8ce]' : 'border-transparent'}`}
                                                                        style={{ backgroundColor: swatch }}
                                                                    />
                                                                )}
                                                                {value.value}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {isSize &&
                                                    /shoe|sneaker|footwear|boot|sandal/i.test(`${product.category?.name ?? ''} ${product.name}`) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowSizeGuide(true)}
                                                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#168247]"
                                                        >
                                                            <Ruler size={13} /> Size Guide
                                                        </button>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {variantOptions.length === 0 && product.description && (
                                <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#61796a]">{product.description}</p>
                            )}

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <span className="text-sm font-bold text-[#1c3c2a]">Quantity</span>
                                <div className="flex h-9 items-center rounded-full border border-[#d6e8da] bg-[#f9fcf9] px-1.5">
                                    <button
                                        type="button"
                                        aria-label="Decrease quantity"
                                        disabled={quantity <= 1}
                                        onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#198248] disabled:opacity-40"
                                    >
                                        −
                                    </button>
                                    <span className="w-8 text-center text-sm font-bold">{quantity}</span>
                                    <button
                                        type="button"
                                        aria-label="Increase quantity"
                                        disabled={quantity >= stock}
                                        onClick={() => setQuantity((current) => Math.min(stock, current + 1))}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#198248] disabled:opacity-40"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-[11px] text-[#718579]">{stock > 0 ? `${stock} available` : 'Out of stock'}</span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => void purchase(true)}
                                    disabled={busy || stock < 1}
                                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#148147] bg-white px-3 text-sm font-bold text-[#148147] shadow-sm transition hover:bg-[#f2faf4] disabled:opacity-50"
                                >
                                    <ArrowRight size={17} /> Buy Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void purchase(false)}
                                    disabled={busy || stock < 1}
                                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#148147] px-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(20,129,71,0.18)] transition hover:bg-[#116b3b] disabled:opacity-50"
                                >
                                    <ShoppingCart size={17} /> {busy ? 'Adding...' : 'Add to Cart'}
                                </button>
                            </div>
                            {message && (
                                <p role="status" className="mt-2 text-xs font-semibold text-[#267444]">
                                    {message}
                                </p>
                            )}

                            {availableVouchers.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {availableVouchers.slice(0, 2).map((voucher) => {
                                        const claimed = claimedVoucherIds.includes(voucher.id);
                                        return (
                                            <div
                                                key={voucher.id}
                                                className="flex items-center gap-2 rounded-xl border border-[#d8eadb] bg-[#f4faf5] px-3 py-2"
                                            >
                                                <TicketPercent size={17} className="shrink-0 text-[#198248]" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-[#285d3b]">
                                                        {voucher.type === 'percentage'
                                                            ? `${voucher.discount_value}% off`
                                                            : `${formatPrice(voucher.discount_value)} off`}
                                                    </div>
                                                    <div className="truncate text-[10px] text-[#74897a]">
                                                        Code {voucher.code} · Min. {formatPrice(voucher.minimum_spend)}
                                                    </div>
                                                </div>
                                                {voucher.requires_claim && !claimed ? (
                                                    <button
                                                        type="button"
                                                        disabled={claimingVoucherId === voucher.id}
                                                        onClick={() => onClaimVoucher(voucher.id)}
                                                        className="rounded-lg bg-[#168247] px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                                                    >
                                                        {claimingVoucherId === voucher.id ? 'Claiming' : 'Claim'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => onUseVoucher(voucher, quantity)}
                                                        className="rounded-lg border border-[#c6dfcb] px-2.5 py-1.5 text-[10px] font-bold text-[#168247]"
                                                    >
                                                        Use now
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {voucherAvailabilityError && (
                                <p role="status" className="mt-3 rounded-lg border border-[#f1dfb5] bg-[#fffaf0] px-3 py-2 text-[10px] leading-4 text-[#805d24]">
                                    {voucherAvailabilityError}
                                </p>
                            )}
                            {actionMessage && <p role="status" className="mt-3 text-xs font-semibold text-[#285d3b]">{actionMessage}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 border-t border-[#e5efe7] bg-[#f8fcf8] md:grid-cols-4">
                        {trustItems.map(({ icon: Icon, label, detail }) => (
                            <div
                                key={label}
                                className="flex min-h-18 items-center gap-2 border-r border-[#e5efe7] px-3 py-2.5 last:border-r-0 md:justify-center md:px-2 xl:gap-3"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9f5eb] text-[#188048]">
                                    <Icon size={17} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[11px] font-bold text-[#295c3a]">{label}</span>
                                    <span className="mt-0.5 block truncate text-[10px] text-[#718579]">{detail}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)] xl:items-start">
                    <div className="overflow-hidden rounded-[20px] border border-[#deebdf] bg-white shadow-[0_8px_24px_rgba(37,93,54,0.05)]">
                        <nav className="flex overflow-x-auto border-b border-[#e4eee6] px-3 md:px-5" aria-label="Product information tabs">
                            {(
                                [
                                    ['description', 'Description'],
                                    ['reviews', `Reviews (${reviewCount})`],
                                    ['shipping', 'Shipping & Return'],
                                ] as const
                            ).map(([tab, label]) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`shrink-0 border-b-2 px-3 py-3 text-xs font-bold transition md:px-4 md:text-sm ${activeTab === tab ? 'border-[#168247] text-[#168247]' : 'border-transparent text-[#728477] hover:text-[#2c6a42]'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </nav>
                        <div className="p-4 md:p-5 lg:p-6">
                            {activeTab === 'description' && (
                                <div>
                                    <h2 className="text-base font-bold text-[#1b422c]">Product Description</h2>
                                    <p className="mt-2 text-sm leading-6 whitespace-pre-line text-[#627869]">
                                        {product.description || 'The seller has not added a description for this product yet.'}
                                    </p>
                                    {highlights.length > 0 && (
                                        <>
                                            <h3 className="mt-5 text-sm font-bold text-[#1b422c]">Product Highlights</h3>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                {highlights.map(([label, value], index) => {
                                                    const Icon = [Leaf, Sprout, Recycle, ShieldCheck][index % 4];
                                                    return (
                                                        <div key={label} className="flex items-center gap-3 rounded-xl bg-[#f6faf6] p-3">
                                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e7f4e9] text-[#188048]">
                                                                <Icon size={17} />
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="block text-xs font-bold text-[#285c3a]">{label}</span>
                                                                <span className="mt-0.5 block text-[11px] wrap-break-word text-[#718579]">{value}</span>
                                                            </span>
                                                            <Check size={15} className="ml-auto shrink-0 text-[#20854c]" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {activeTab === 'reviews' && (
                                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#f7fbf7] p-4">
                                    <div className="text-3xl font-extrabold text-[#1b422c]">{rating.toFixed(1)}</div>
                                    <div>
                                        <div className="flex items-center gap-0.5 text-[#20a156]">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={star} size={16} className={rating >= star ? 'fill-current' : 'text-[#c8d7cc]'} />
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-[#718579]">Based on {reviewCount.toLocaleString()} customer reviews</p>
                                    </div>
                                    {reviewCount === 0 && <p className="w-full text-sm text-[#718579]">No customer reviews yet.</p>}
                                </div>
                            )}
                            {activeTab === 'shipping' && (
                                <p className="text-sm leading-6 text-[#627869]">
                                    Shipping methods, delivery estimates, and return eligibility are shown during checkout and depend on the seller
                                    and delivery address.
                                </p>
                            )}
                        </div>
                    </div>

                    <aside className="rounded-[20px] border border-[#deebdf] bg-white p-4 shadow-[0_8px_24px_rgba(37,93,54,0.05)] md:p-5">
                        <h2 className="text-sm font-bold text-[#1b422c]">Product Details</h2>
                        {details.length > 0 ? (
                            <dl className="mt-3 divide-y divide-[#edf3ee]">
                                {details.map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-[minmax(90px,0.8fr)_1.2fr] gap-3 py-2 text-xs">
                                        <dt className="text-[#778b7c]">{label}</dt>
                                        <dd className="font-semibold wrap-break-word text-[#3b5e46]">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p className="mt-3 text-xs text-[#778b7c]">No additional product specifications provided.</p>
                        )}
                        {product.shop?.name && (
                            <div className="mt-4 rounded-xl bg-[#f2f8f3] p-3 text-xs text-[#4b7357]">
                                <div className="flex items-center gap-2 font-semibold">
                                    <Leaf size={15} /> Sold by {product.shop.name}
                                </div>
                                <p className="mt-1 leading-5">Support local sellers and shop with confidence.</p>
                            </div>
                        )}
                    </aside>
                </section>

                {similarProducts.length > 0 && (
                    <section className="mt-5 rounded-[20px] border border-[#deebdf] bg-[#f5faf5] p-3 md:p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-base font-bold text-[#1b422c]">Similar Products</h2>
                            <Link href={route('customer.products')} className="text-xs font-semibold text-[#168247]">
                                See all
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                            {similarProducts.slice(0, 4).map((item) => (
                                <ProductCard
                                    key={item.id}
                                    product={item}
                                    liked={favoriteOverrides[item.id] ?? Boolean(item.is_favorited)}
                                    onToggleFavorite={() => toggleSimilarFavorite(item)}
                                    onOpenProduct={() => router.visit(route('products.show', item.uuid))}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {showSizeGuide && sizeOption && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    role="presentation"
                    onClick={() => setShowSizeGuide(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${sizeOption.name} guide`}
                        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-[#1b422c]">{sizeOption.name} Guide</h2>
                            <button
                                type="button"
                                onClick={() => setShowSizeGuide(false)}
                                aria-label="Close size guide"
                                className="text-lg text-[#6b8173]"
                            >
                                ×
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-[#64796a]">Available {sizeOption.name.toLowerCase()} options for this product.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {sizeOption.values.map((value) => (
                                <span
                                    key={value.id}
                                    className="rounded-lg border border-[#dceade] bg-[#f7fbf7] px-3 py-2 text-sm font-semibold text-[#28603c]"
                                >
                                    {value.value}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
