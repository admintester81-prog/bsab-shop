import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import CustomerBottomNav from '@/components/customer-bottom-nav';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
    ArrowRight,
    Check,
    Download,
    Dumbbell,
    Gift,
    Grid2X2,
    Heart,
    Home,
    LogOut,
    Package,
    Search,
    Settings,
    Shirt,
    ShoppingCart,
    SlidersHorizontal,
    Smartphone,
    Sofa,
    Sparkles,
    Star,
    TicketPercent,
    UserRound,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type Category = { id: number; name: string; slug: string; image?: string | null; products_count: number };
type Product = {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    base_price: string;
    sale_price?: string;
    stock_quantity: number;
    available_stock: number;
    is_out_of_stock: boolean;
    average_rating: number;
    review_count: number;
    is_favorited: boolean;
    selling_unit?: string | null;
    reviews_count?: number;
    status: string;
    is_approved: boolean;
    category?: { name: string; slug: string };
    shop?: { name: string };
    images?: { path: string }[];
};
type FooterLink = { label: string; href: string };
type FooterLinkGroups = {
    quick_links: FooterLink[];
    customer_care: FooterLink[];
    about: FooterLink[];
};
type StorefrontSettings = {
    brand_name?: string | null;
    logo_path?: string | null;
    hero_media_path?: string | null;
    hero_media_type?: string | null;
    hero_title?: string | null;
    hero_highlight?: string | null;
    hero_description?: string | null;
    cta_label?: string | null;
    feature_one?: string | null;
    feature_two?: string | null;
    feature_three?: string | null;
    products_title?: string | null;
    products_subtitle?: string | null;
    footer_text?: string | null;
    footer_tagline?: string | null;
    footer_quick_links_title?: string | null;
    footer_care_title?: string | null;
    footer_about_title?: string | null;
    footer_install_title?: string | null;
    footer_install_text?: string | null;
    footer_install_button?: string | null;
    footer_links?: FooterLinkGroups;
};
const categoryColors = ['#e4efe7', '#e8eee3', '#f4e8d9', '#e4edf0', '#f1e7df', '#e8efe1'];

function avatarUrl(avatar?: string) {
    return avatar ? (avatar.startsWith('http') || avatar.startsWith('/') ? avatar : `/storage/${avatar}`) : null;
}

function imageUrl(path?: string | null) {
    return path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null;
}

function getCategoryFallbackIcon(categoryName: string) {
    const normalized = categoryName.toLowerCase();

    if (/(fashion|clothing|wear|style|apparel)/.test(normalized)) return Shirt;
    if (/(electronics|tech|mobile|phone|computer|gadget)/.test(normalized)) return Smartphone;
    if (/(home|furniture|living|interior|decor)/.test(normalized)) return Sofa;
    if (/(sport|fitness|gym|active)/.test(normalized)) return Dumbbell;
    if (/(gift|promo|offer|special)/.test(normalized)) return Gift;

    return Grid2X2;
}

export default function Welcome({
    categories = [],
    products = [],
    siteSettings = {},
    query = '',
}: {
    categories?: Category[];
    products?: Product[];
    siteSettings?: StorefrontSettings;
    query?: string;
}) {
    const { auth, cartCount = 0, newVoucherCount = 0 } = usePage<SharedData>().props;
    const brandName = siteSettings.brand_name || 'BSABShop';
    const logoPath = siteSettings.logo_path ? imageUrl(siteSettings.logo_path) : null;
    const heroMediaPath = siteSettings.hero_media_path ? imageUrl(siteSettings.hero_media_path) : null;
    const heroMediaType = siteSettings.hero_media_type;
    const heroTitle = siteSettings.hero_title || 'Best picks.';
    const heroHighlight = siteSettings.hero_highlight || 'Best prices.';
    const heroDescription = siteSettings.hero_description || 'Discover products from every category, curated by our marketplace sellers.';
    const ctaLabel = siteSettings.cta_label || 'Shop now';
    const featureOne = siteSettings.feature_one || 'Fresh & Quality Products';
    const featureTwo = siteSettings.feature_two || 'Trusted Sellers';
    const featureThree = siteSettings.feature_three || 'Fast & Safe Delivery';
    const productsTitle = siteSettings.products_title || 'Featured Products';
    const productsSubtitle = siteSettings.products_subtitle || 'Handpicked for you. Quality products at the best prices.';
    const footerText = siteSettings.footer_text || '© 2026 BSABShop Marketplace - every price, checked twice.';
    const footerTagline = siteSettings.footer_tagline || 'A greener marketplace for a better tomorrow.';
    const footerQuickLinksTitle = siteSettings.footer_quick_links_title || 'Quick Links';
    const footerCareTitle = siteSettings.footer_care_title || 'Customer Care';
    const footerAboutTitle = siteSettings.footer_about_title || 'About our marketplace';
    const footerLinks = siteSettings.footer_links;
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState(query);
    const [liked, setLiked] = useState<number[]>(() => products.filter((product) => product.is_favorited).map((product) => product.id));
    const [accountOpen, setAccountOpen] = useState(false);
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'rating'>('default');
    const [inStockOnly, setInStockOnly] = useState(false);
    const searchableText = (product: Product) =>
        [product.name, product.description, product.category?.name, product.shop?.name].filter(Boolean).join(' ').toLowerCase();
    const visibleProducts = useMemo(
        () =>
            products.filter(
                (product) =>
                    (activeCategory === 'all' || product.category?.slug === activeCategory) &&
                    search
                        .trim()
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(Boolean)
                        .every((term) => searchableText(product).includes(term)),
            ),
        [activeCategory, products, search],
    );
    const searchResults = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return visibleProducts;
        return visibleProducts.filter((product) =>
            query
                .split(/\s+/)
                .filter(Boolean)
                .every((term) => searchableText(product).includes(term)),
        );
    }, [search, visibleProducts]);
    const recommendations = useMemo(() => {
        if (!search.trim() || !searchResults.length) return [];
        const categorySlug = searchResults[0].category?.slug;
        return products
            .filter((product) => product.id !== searchResults[0].id && (!categorySlug || product.category?.slug === categorySlug))
            .slice(0, 4);
    }, [products, search, searchResults]);

    const sortedAndFilteredProducts = useMemo(() => {
        let list = search.trim() ? searchResults : visibleProducts;
        if (inStockOnly) {
            list = list.filter((p) => p.stock_quantity > 0 && !p.is_out_of_stock);
        }
        if (sortBy === 'price-asc') {
            list = [...list].sort((a, b) => parseFloat(a.sale_price || a.base_price) - parseFloat(b.sale_price || b.base_price));
        } else if (sortBy === 'price-desc') {
            list = [...list].sort((a, b) => parseFloat(b.sale_price || b.base_price) - parseFloat(a.sale_price || a.base_price));
        } else if (sortBy === 'rating') {
            list = [...list].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        }
        return list;
    }, [searchResults, visibleProducts, search, inStockOnly, sortBy]);

    const productFeed = sortedAndFilteredProducts;

    function openProduct(product: Product) {
        router.visit(route('products.show', product.uuid));
    }

    function toggleFavorite(productId: number) {
        if (!auth.user) {
            router.visit(route('login'));
            return;
        }

        setLiked((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
        router.post(route('customer.favorites.toggle', productId), {}, { preserveScroll: true });
    }

    function openProducts() {
        const query = search.trim();
        router.get(route('customer.products'), query ? { q: query } : {}, { preserveState: false, viewTransition: true });
    }

    function submitSearch(event: React.FormEvent) {
        event.preventDefault();
        openProducts();
    }

    return (
        <>
            <Head title={`${brandName} Marketplace - Best Picks, Best Prices`} />
            <div className="marketplace-page min-h-screen bg-[#f7fbf7] text-[#173b2a] antialiased">
                <header className="border-b border-[#e5eee7] bg-white">
                    <div className="mx-auto flex w-full max-w-110 flex-wrap items-center gap-3 px-4 py-3 min-[430px]:max-[640px]:max-w-full min-[430px]:max-[640px]:gap-2 min-[430px]:max-[640px]:px-3 min-[430px]:max-[640px]:py-2.5 sm:max-w-195 sm:px-5 lg:max-w-7xl lg:flex-nowrap lg:gap-5 lg:px-8">
                        <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    className="flex shrink-0 items-center gap-2 text-left min-[430px]:max-[640px]:gap-1.5 min-[430px]:max-[640px]:min-w-0 lg:hidden"
                                    aria-label={`Open ${brandName} navigation`}
                                >
                                    {logoPath ? (
                                        <img src={logoPath} alt={brandName} className="h-9 w-9 rounded-full object-cover min-[430px]:max-[640px]:h-8 min-[430px]:max-[640px]:w-8" />
                                    ) : (
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#25804a] min-[430px]:max-[640px]:h-8 min-[430px]:max-[640px]:w-8">
                                            <Sparkles size={18} />
                                        </span>
                                    )}
                                    <span className="font-display text-xl font-bold text-[#145c3d] min-[430px]:max-[640px]:text-lg">{brandName}</span>
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col bg-white p-0 lg:hidden">
                                <SheetHeader className="border-b border-[#e5eee7] px-5 py-4 text-left">
                                    <SheetTitle className="flex items-center gap-2 font-display text-lg font-bold text-[#145c3d]">
                                        {logoPath ? (
                                            <img src={logoPath} alt="" className="h-9 w-9 rounded-full object-cover" />
                                        ) : (
                                            <Sparkles size={22} />
                                        )}
                                        {brandName}
                                    </SheetTitle>
                                </SheetHeader>
                                <nav aria-label="Mobile and tablet navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
                                    {[
                                        { label: 'Home', href: route('home'), icon: Home },
                                        { label: 'Products', href: route('customer.products'), icon: Grid2X2 },
                                        { label: 'Orders', href: route('customer.orders'), icon: Package },
                                        { label: 'Favorites', href: route('customer.favorites'), icon: Heart },
                                        { label: 'Cart', href: route('customer.cart'), icon: ShoppingCart },
                                        { label: 'Vouchers', href: route('customer.vouchers'), icon: TicketPercent },
                                    ].map(({ label, href, icon: Icon }) => (
                                        <Link
                                            key={label}
                                            href={!auth.user && label !== 'Home' ? route('login') : href}
                                            onClick={() => setMobileNavigationOpen(false)}
                                            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#315947] transition hover:bg-[#f0f8f2] hover:text-[#1f7a42]"
                                        >
                                            <Icon size={19} />
                                            <span>{label}</span>
                                            {label === 'Cart' && cartCount > 0 && (
                                                <span className="ml-auto rounded-full bg-[#2a9b59] px-2 py-0.5 text-xs font-bold text-white">
                                                    {cartCount > 99 ? '99+' : cartCount}
                                                </span>
                                            )}
                                            {label === 'Vouchers' && newVoucherCount > 0 && (
                                                <span className="ml-auto rounded-full bg-[#2a9b59] px-2 py-0.5 text-xs font-bold text-white">
                                                    {newVoucherCount > 99 ? '99+' : newVoucherCount}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                    <div className="mt-auto border-t border-[#e5eee7] pt-4">
                                        {auth.user ? (
                                            <Link
                                                href={route('logout')}
                                                method="post"
                                                as="button"
                                                onClick={() => setMobileNavigationOpen(false)}
                                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#c85b4d] transition hover:bg-[#fdf0ed]"
                                            >
                                                <LogOut size={19} /> Log out
                                            </Link>
                                        ) : (
                                            <Link
                                                href={route('login')}
                                                onClick={() => setMobileNavigationOpen(false)}
                                                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#1f7a42] transition hover:bg-[#f0f8f2]"
                                            >
                                                <UserRound size={19} /> Log in
                                            </Link>
                                        )}
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                        <Link
                            href={route('home')}
                            className="hidden shrink-0 items-center gap-2 lg:flex"
                            aria-label={`${brandName} home`}
                        >
                            {logoPath ? (
                                <img src={logoPath} alt={brandName} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#25804a]">
                                    <Sparkles size={18} />
                                </span>
                            )}
                            <span className="font-display text-xl font-bold text-[#145c3d]">{brandName}</span>
                        </Link>
                        <nav className="hidden items-center gap-1 sm:ml-auto lg:flex" aria-label="Desktop navigation">
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
                            className="order-2 flex w-full items-center gap-2 rounded-full border border-[#dfeae2] bg-[#fbfdfb] px-3.5 py-2.5 focus-within:border-[#2c9350] focus-within:ring-4 focus-within:ring-[#e6f7eb] min-[430px]:max-[640px]:order-2 min-[430px]:max-[640px]:px-2.5 min-[430px]:max-[640px]:py-2 sm:order-1 sm:w-auto sm:max-w-130 sm:flex-1 lg:order-2 lg:mx-0 lg:my-0 lg:max-w-155"
                        >
                            <button type="submit" aria-label="Search products" className="shrink-0 text-[#647568] transition hover:text-[#1f7a42] min-[430px]:max-[640px]:hidden">
                                <Search size={16} />
                            </button>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onClick={openProducts}
                                placeholder="Search for products, brands and more..."
                                aria-label="Search products"
                                className="w-full cursor-pointer bg-transparent text-sm outline-none placeholder:text-[#5c6e63] min-[430px]:max-[640px]:text-xs"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-[#5c6e63] hover:text-[#173b2a]">
                                    <X size={15} />
                                </button>
                            )}
                            {/* Universal filter icon - mobile size only */}
                            <button
                                type="button"
                                onClick={() => setFilterOpen(true)}
                                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#eaf4ed] hover:text-[#1f7a42] active:scale-95 sm:hidden"
                                aria-label="Open filter options"
                                title="Filter products"
                            >
                                <SlidersHorizontal size={17} strokeWidth={2.2} />
                                {(sortBy !== 'default' || inStockOnly || activeCategory !== 'all') && (
                                    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#1f7a42] ring-2 ring-white" />
                                )}
                            </button>
                        </form>
                        <div className="order-1 ml-auto flex items-center justify-end gap-2 min-[430px]:max-[640px]:mr-0 min-[430px]:max-[640px]:gap-1.5 sm:order-2 sm:ml-5 lg:hidden">
                            <Link
                                href={route('customer.cart')}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[#1b4332] transition hover:bg-[#f5fcf7] min-[430px]:max-[640px]:h-9 min-[430px]:max-[640px]:w-9"
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
                                        onClick={() => setAccountOpen(!accountOpen)}
                                        className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[#1b4332] transition hover:bg-[#f5fcf7] min-[430px]:max-[640px]:h-9 min-[430px]:max-[640px]:w-9"
                                        aria-label="Open account menu"
                                        aria-expanded={accountOpen}
                                    >
                                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#52b788] text-[10px] font-bold text-[#1b4332] min-[430px]:max-[640px]:h-7 min-[430px]:max-[640px]:w-7">
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
                                        <div className="absolute top-12 right-0 z-20 w-44 rounded-xl border border-[#def0e2] bg-white p-1.5 shadow-[0_8px_25px_rgba(22,59,36,0.1)]">
                                            <Link
                                                href={route('customer.profile')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                            >
                                                <UserRound size={16} /> Profile
                                            </Link>
                                            <hr className="my-1 border-[#def0e2]" />
                                            <Link
                                                href={route('customer.orders')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                            >
                                                <Package size={16} /> My orders
                                            </Link>
                                            <hr className="my-1 border-[#def0e2]" />
                                            <Link
                                                href={route('customer.vouchers')}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                                aria-label={`Voucher${newVoucherCount > 0 ? `, ${newVoucherCount} new` : ''}`}
                                            >
                                                <TicketPercent size={16} /> Voucher
                                                {newVoucherCount > 0 && (
                                                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#52b788] px-1.5 text-[10px] font-bold text-white">
                                                        {newVoucherCount > 99 ? '99+' : newVoucherCount}
                                                    </span>
                                                )}
                                            </Link>
                                            <hr className="my-1 border-[#def0e2]" />
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
                                        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-[#1b4332] transition hover:bg-[#f5fcf7]"
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
                                            onClick={() => setAccountOpen(!accountOpen)}
                                            className="flex items-center gap-2 rounded-full bg-transparent px-2.5 py-1.5 text-[#1b4332] transition hover:bg-[#f5fcf7]"
                                            aria-label="Open account menu"
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
                                            <div className="absolute top-12 right-0 z-20 w-44 rounded-xl border border-[#def0e2] bg-white p-1.5 shadow-[0_8px_25px_rgba(22,59,36,0.1)]">
                                                <Link
                                                    href={route('customer.profile')}
                                                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                                >
                                                    <UserRound size={16} /> Profile
                                                </Link>
                                                <hr className="my-1 border-[#def0e2]" />
                                                <Link
                                                    href={route('customer.orders')}
                                                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                                >
                                                    <Package size={16} /> My orders
                                                </Link>
                                                <hr className="my-1 border-[#def0e2]" />
                                                <Link
                                                    href={route('customer.vouchers')}
                                                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[#f5fcf7]"
                                                    aria-label={`Voucher${newVoucherCount > 0 ? `, ${newVoucherCount} new` : ''}`}
                                                >
                                                    <TicketPercent size={16} /> Voucher
                                                    {newVoucherCount > 0 && (
                                                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#52b788] px-1.5 text-[10px] font-bold text-white">
                                                            {newVoucherCount > 99 ? '99+' : newVoucherCount}
                                                        </span>
                                                    )}
                                                </Link>
                                                <hr className="my-1 border-[#def0e2]" />
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
                                    className="inline-flex items-center justify-center rounded-full bg-[#1f7a42] px-4 py-2 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(31,122,66,0.18)] ring-2 ring-[#edf8f0] transition hover:bg-[#186a3a] sm:px-5 sm:py-2.5"
                                >
                                    Log in
                                </Link>
                            )}
                        </div>
                    </div>
                </header>
                <main className="mx-auto flex max-w-310 flex-col px-5 pb-24 sm:px-8 md:pb-12">
                    <nav
                        className="order-2 mx-[-1.25rem] mt-0 flex scrollbar-none gap-3 overflow-x-auto rounded-none border-0 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(38,104,63,0.04)] [&::-webkit-scrollbar]:hidden sm:mx-[-2rem] lg:mx-0 lg:mt-3 lg:rounded-2xl lg:border lg:border-[#e3eee6]"
                        aria-label="Product categories"
                    >
                        <button
                            onClick={() => setActiveCategory('all')}
                            className="flex min-w-17 shrink-0 flex-col items-center gap-1.5 text-[10px] font-semibold text-[#1b4332]"
                        >
                            <span
                                className={`flex h-10 w-10 items-center justify-center rounded-full border ${activeCategory === 'all' ? 'border-[#5bb47b] bg-[#5bb47b] text-white' : 'border-[#dce8de] bg-[#f8fcf8] text-[#2d6a4f]'}`}
                            >
                                <Grid2X2 size={18} />
                            </span>
                            All
                        </button>
                        {categories.map((category, index) => {
                            const categoryImage = imageUrl(category.image);
                            const FallbackIcon = getCategoryFallbackIcon(category.name);

                            return (
                                <button
                                    key={category.id}
                                    onClick={() => setActiveCategory(category.slug)}
                                    className={`flex min-w-17 shrink-0 flex-col items-center gap-1.5 text-[10px] font-semibold ${activeCategory === category.slug ? 'text-[#1b4332]' : 'text-[#5c6e63]'}`}
                                >
                                    <span
                                        className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border ${activeCategory === category.slug ? 'border-[#5bb47b] bg-[#5bb47b] text-white' : 'border-[#dce8de] text-[#2d6a4f]'}`}
                                        style={
                                            activeCategory === category.slug
                                                ? undefined
                                                : { backgroundColor: categoryColors[index % categoryColors.length] }
                                        }
                                    >
                                        {categoryImage ? (
                                            <img src={categoryImage} alt={category.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <FallbackIcon size={18} strokeWidth={1.8} />
                                        )}
                                    </span>
                                    <span className="max-w-16 truncate">{category.name}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <section className="relative order-1 mx-[-1.25rem] mt-0 min-h-60 overflow-hidden rounded-none border border-[#e1ebdf] bg-[#eef6e8] px-4 py-6 shadow-[0_8px_25px_rgba(22,59,36,0.06)] sm:mx-[-2rem] sm:px-8 sm:py-8 md:px-11 md:py-9 lg:mx-0 lg:mt-3 lg:rounded-2xl">
                        {heroMediaType === 'video' && heroMediaPath && (
                            <video src={heroMediaPath} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
                        )}
                        {heroMediaType !== 'video' && heroMediaPath && (
                            <img src={heroMediaPath} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                        )}
                        {heroMediaPath && (
                            <div className="absolute inset-0 bg-[#f8fdf7]/75 sm:bg-linear-to-r sm:from-[#f8fdf7] sm:via-[#f8fdf7]/85 sm:to-transparent" />
                        )}
                        <div className="relative z-10 max-w-full">
                            <span className="inline-flex rounded-full bg-[#e2f2e4] px-3 py-1 text-[10px] font-bold tracking-[.08em] text-[#2c8050] uppercase">
                                {brandName} Marketplace
                            </span>
                            <h1 className="font-display mt-3 max-w-107.5 text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.05] font-bold wrap-break-word text-[#145437]">
                                {heroTitle}
                                <br />
                                <span className="text-[#249653]">{heroHighlight}</span>
                            </h1>
                            <p className="my-4 max-w-95 text-xs leading-relaxed text-[#5d7768] sm:text-sm">{heroDescription}</p>
                            <a
                                href="#products"
                                className="inline-flex items-center gap-3 rounded-full bg-[#23834b] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#23834b]/20"
                            >
                                {ctaLabel} <ArrowRight size={15} />
                            </a>
                            <div className="mt-5 hidden items-center gap-5 text-[10px] font-semibold text-[#527160] sm:flex">
                                <span>✦ {featureOne}</span>
                                <span>♢ {featureTwo}</span>
                                <span>▣ {featureThree}</span>
                            </div>
                        </div>
                    </section>
                    <section
                        id="products"
                        className="order-3 mx-[-1.25rem] mt-0 rounded-none border-0 bg-white p-4 sm:mx-[-2rem] sm:p-5 lg:mx-0 lg:mt-5 lg:rounded-2xl lg:border lg:border-[#e3eee6]"
                    >
                        <div className="mb-4 flex items-end justify-between gap-4">
                            <div>
                                <h2 className="font-display text-xl font-bold text-[#184c35]">
                                    {search.trim() ? 'Search results' : productsTitle}{' '}
                                    <span className="text-sm font-medium text-[#5c6e63]">
                                        ({search.trim() ? searchResults.length : Math.min(productFeed.length, 20)})
                                    </span>
                                </h2>
                                <p className="mt-1 text-xs text-[#789184]">{productsSubtitle}</p>
                            </div>
                        </div>
                        {productFeed.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                                {productFeed.map((product) => {
                                    const price = product.sale_price ?? product.base_price;
                                    const image = product.images?.[0]?.path;
                                    return (
                                        <article
                                            key={product.id}
                                            onClick={() => openProduct(product)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    openProduct(product);
                                                }
                                            }}
                                            role="link"
                                            tabIndex={0}
                                            className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-[#e4ece5] bg-white shadow-[0_3px_12px_rgba(22,59,36,0.05)] transition hover:-translate-y-1 hover:shadow-lg"
                                        >
                                            <div className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-[#f1f5f1]">
                                                {image ? (
                                                    <img
                                                        src={image.startsWith('http') || image.startsWith('/') ? image : `/storage/${image}`}
                                                        alt={product.name}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="block h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Package size={58} strokeWidth={1.2} className="text-[#2c9350]" />
                                                )}
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggleFavorite(product.id);
                                                    }}
                                                    className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110 ${liked.includes(product.id) ? 'text-[#2c9350]' : 'text-[#647568]'}`}
                                                    aria-label={
                                                        liked.includes(product.id)
                                                            ? `Remove ${product.name} from favorites`
                                                            : `Add ${product.name} to favorites`
                                                    }
                                                    aria-pressed={liked.includes(product.id)}
                                                    title={liked.includes(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <Heart size={15} fill={liked.includes(product.id) ? '#2c9350' : 'none'} />
                                                </button>
                                                {product.sale_price && Number(product.sale_price) < Number(product.base_price) && (
                                                    <span className="absolute top-2 left-2 rounded-full bg-[#2c9350] px-2 py-1 text-[9px] font-bold text-white">
                                                        Sale
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-1 flex-col p-2.5">
                                                <span className="text-[9px] font-bold tracking-[.06em] text-[#2c9350] uppercase">
                                                    {product.category?.name ?? 'Marketplace'}
                                                </span>
                                                <h3 className="mt-1 line-clamp-2 text-xs font-semibold">{product.name}</h3>
                                                <div className="mt-2 flex items-center gap-1 text-[10px] text-[#5c6e63]">
                                                    <span className="flex text-[#f3b33d]" aria-label={`${product.average_rating.toFixed(1)} out of 5 stars`}>
                                                        {Array.from({ length: 5 }, (_, index) => (
                                                            <Star
                                                                key={index}
                                                                size={11}
                                                                fill={product.average_rating >= index + 1 ? 'currentColor' : 'none'}
                                                                strokeWidth={1.8}
                                                            />
                                                        ))}
                                                    </span>
                                                    <span>{product.average_rating.toFixed(1)}</span>
                                                    <span className="text-[#91a197]">({product.review_count})</span>
                                                </div>
                                                <div className="mt-auto pt-3">
                                                    <div className="font-display mb-2 text-sm font-bold text-[#16804a]">
                                                        ₱{Number(price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        <span className="ml-1 text-[10px] font-medium text-[#789184]">/{product.selling_unit || 'pc'}</span>
                                                    </div>
                                                    <p className={`text-[10px] font-medium ${product.is_out_of_stock ? 'text-[#b45b4d]' : 'text-[#789184]'}`}>
                                                        {product.is_out_of_stock ? 'Out of stock' : `${product.available_stock} available`}
                                                    </p>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-[#c4e3ce] bg-[#fbfaf6] py-16 text-center text-sm text-[#5c6e63]">
                                No products found.
                            </div>
                        )}
                    </section>
                    {!!recommendations.length && (
                        <section className="order-5 mt-10">
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="font-display text-xl font-bold text-[#163b24]">You may also like</h2>
                                    <p className="mt-1 text-sm text-[#647568]">More picks from the same category.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
                                {recommendations.map((product) => {
                                    const price = product.sale_price ?? product.base_price;
                                    const image = product.images?.[0]?.path;
                                    return (
                                        <article
                                            key={product.id}
                                            onClick={() => openProduct(product)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    openProduct(product);
                                                }
                                            }}
                                            role="link"
                                            tabIndex={0}
                                            className="flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-[#def0e2] bg-white shadow-[0_6px_20px_rgba(22,59,36,0.06)] transition hover:-translate-y-1 hover:shadow-lg"
                                        >
                                            <div className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden bg-[#efe9dd]">
                                                {image ? (
                                                    <img
                                                        src={image.startsWith('http') || image.startsWith('/') ? image : `/storage/${image}`}
                                                        alt={product.name}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="block h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <Package size={58} strokeWidth={1.2} className="text-[#2c9350]" />
                                                )}
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggleFavorite(product.id);
                                                    }}
                                                    className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-110 ${liked.includes(product.id) ? 'text-[#2c9350]' : 'text-[#647568]'}`}
                                                    aria-label={
                                                        liked.includes(product.id)
                                                            ? `Remove ${product.name} from favorites`
                                                            : `Add ${product.name} to favorites`
                                                    }
                                                    aria-pressed={liked.includes(product.id)}
                                                    title={liked.includes(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <Heart size={15} fill={liked.includes(product.id) ? '#2c9350' : 'none'} />
                                                </button>
                                            </div>
                                            <div className="flex flex-1 flex-col p-3.5">
                                                <span className="text-[10px] font-bold tracking-[.06em] text-[#2c9350] uppercase">
                                                    {product.category?.name ?? 'Marketplace'}
                                                </span>
                                                <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{product.name}</h3>
                                                <p className="mt-1 truncate text-xs text-[#647568]">{product.shop?.name ?? 'BSABShop seller'}</p>
                                                <div className="mt-2 flex items-center gap-1 text-xs text-[#5c6e63]">
                                                    <span
                                                        className="flex text-[#f3b33d]"
                                                        aria-label={`${product.average_rating.toFixed(1)} out of 5 stars`}
                                                    >
                                                        {Array.from({ length: 5 }, (_, index) => (
                                                            <Star
                                                                key={index}
                                                                size={11}
                                                                fill={product.average_rating >= index + 1 ? 'currentColor' : 'none'}
                                                                strokeWidth={1.8}
                                                            />
                                                        ))}
                                                    </span>
                                                    <span>{product.average_rating.toFixed(1)}</span>
                                                    <span className="text-[#91a197]">({product.review_count})</span>
                                                </div>
                                                <div className="mt-auto pt-3">
                                                    <div className="font-display mb-2 text-lg font-bold text-[#163b24]">
                                                        ₱{Number(price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                        <span className="ml-1 text-[10px] font-medium text-[#789184]">
                                                            /{product.selling_unit || 'pc'}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className={`text-[10px] font-medium ${product.is_out_of_stock ? 'text-[#b45b4d]' : 'text-[#789184]'}`}
                                                    >
                                                        {product.is_out_of_stock ? 'Out of stock' : `${product.available_stock} available`}
                                                    </p>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                    <footer className="order-10 mx-[-1.25rem] mt-0 border-t border-[#e0ebe2] bg-white px-5 py-7 text-xs text-[#61786b] sm:mx-[-2rem] sm:px-7 lg:mx-0 lg:mt-8">
                        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr]">
                            <div>
                                <div className="flex items-center gap-2 text-base font-bold text-[#145c3d]">
                                    {logoPath ? (
                                        <img src={logoPath} alt={brandName} className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                        <Sparkles size={24} />
                                    )}
                                    {brandName}
                                </div>
                                <p className="mt-2 max-w-52 text-[10px] leading-4">{footerTagline}</p>
                                <p className="mt-7 text-[10px]">{footerText}</p>
                            </div>
                            <div>
                                <p className="font-bold text-[#315947]">{footerQuickLinksTitle}</p>
                                <div className="mt-2 grid gap-1.5 text-[10px]">
                                    {(footerLinks?.quick_links ?? []).map((item, index) => {
                                        const href = !auth.user && item.href.startsWith('/customer/') ? route('login') : item.href;
                                        return /^https?:\/\//i.test(href) ? (
                                            <a key={`${item.label}-${index}`} href={href} target="_blank" rel="noreferrer" className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </a>
                                        ) : (
                                            <Link key={`${item.label}-${index}`} href={href} className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <p className="font-bold text-[#315947]">{footerCareTitle}</p>
                                <div className="mt-2 grid gap-1.5 text-[10px]">
                                    {(footerLinks?.customer_care ?? []).map((item, index) =>
                                        /^https?:\/\//i.test(item.href) ? (
                                            <a key={`${item.label}-${index}`} href={item.href} target="_blank" rel="noreferrer" className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </a>
                                        ) : (
                                            <Link key={`${item.label}-${index}`} href={item.href} className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </Link>
                                        ),
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="font-bold text-[#315947]">{footerAboutTitle}</p>
                                <div className="mt-2 grid gap-1.5 text-[10px]">
                                    {(footerLinks?.about ?? []).map((item, index) =>
                                        /^https?:\/\//i.test(item.href) ? (
                                            <a key={`${item.label}-${index}`} href={item.href} target="_blank" rel="noreferrer" className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </a>
                                        ) : (
                                            <Link key={`${item.label}-${index}`} href={item.href} className="hover:text-[#1f7a42]">
                                                {item.label}
                                            </Link>
                                        ),
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="font-bold text-[#315947]">{siteSettings.footer_install_title || 'Install BSAB-SHOP'}</p>
                                <p className="mt-1 text-[10px]">{siteSettings.footer_install_text || 'Add our app to your device for quick access.'}</p>
                                <button
                                    type="button"
                                    onClick={() => window.dispatchEvent(new Event('bsabshop:request-install'))}
                                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#258b50] px-3 text-xs font-bold text-white transition hover:bg-[#1f7a42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#258b50]"
                                >
                                    <Download size={15} /> {siteSettings.footer_install_button || 'Install app'}
                                </button>
                            </div>
                        </div>
                    </footer>
                </main>
                <CustomerBottomNav />

                {/* ── Mobile Universal Filter Modal ── */}
                {filterOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:hidden"
                        onClick={() => setFilterOpen(false)}
                    >
                        <div
                            className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-[#def0e2] bg-white p-5 shadow-2xl transition-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-[#e5eee7] pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f5ec] text-[#1f7a42]">
                                        <SlidersHorizontal size={16} strokeWidth={2.2} />
                                    </span>
                                    <h3 className="font-display text-base font-bold text-[#145437]">Filter & Sort Products</h3>
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
                                    <span className="block font-bold text-[#184c35] mb-2">Sort by</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'default', label: 'Featured / Best' },
                                            { id: 'price-asc', label: 'Price: Low to High' },
                                            { id: 'price-desc', label: 'Price: High to Low' },
                                            { id: 'rating', label: 'Highest Rated' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setSortBy(opt.id as any)}
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
                                    <span className="block font-bold text-[#184c35] mb-2">Availability</span>
                                    <label className="flex items-center justify-between rounded-xl border border-[#dfeae2] bg-[#fbfdfb] p-3 text-xs font-semibold text-[#184c35] cursor-pointer">
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
                                    <span className="block font-bold text-[#184c35] mb-2">Category</span>
                                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                        <button
                                            type="button"
                                            onClick={() => setActiveCategory('all')}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                activeCategory === 'all'
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
                                                onClick={() => setActiveCategory(c.slug)}
                                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                                    activeCategory === c.slug
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
                            <div className="flex items-center gap-2 pt-2 border-t border-[#e5eee7]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSortBy('default');
                                        setInStockOnly(false);
                                        setActiveCategory('all');
                                    }}
                                    className="flex-1 rounded-xl border border-[#dfeae2] py-2.5 text-center text-xs font-bold text-[#5c6e63] transition hover:bg-[#f5fcf7]"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterOpen(false);
                                        const el = document.getElementById('products');
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="grow rounded-xl py-2.5 text-center text-xs font-bold text-white shadow-sm transition"
                                    style={{ backgroundColor: '#22c55e' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16a34a')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#22c55e')}
                                >
                                    Apply Filters ({productFeed.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
