import InputError from '@/components/input-error';
import CustomerBottomNav from '@/components/customer-bottom-nav';
import MapPickerModal from '@/components/map-picker-modal';
import { optimizeImage } from '@/lib/image-upload';
import { type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    CreditCard,
    Grid2X2,
    Heart,
    Home,
    LogOut,
    MapPin,

    Package,
    Pencil,
    Search,
    Settings,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Star,
    TicketPercent,
    UserRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type ProfileTab = 'Personal Information' | 'Addresses' | 'Payment Methods' | 'Security';

const tabs: ProfileTab[] = ['Personal Information', 'Addresses', 'Payment Methods', 'Security'];

const quickLinks = [
    { label: 'My Orders', href: '/customer/orders', icon: Package },
    { label: 'My Addresses', tab: 'Addresses' as ProfileTab, icon: MapPin },
    { label: 'Payment Methods', tab: 'Payment Methods' as ProfileTab, icon: CreditCard },
    { label: 'My Vouchers', href: '/customer/vouchers', icon: TicketPercent },
    { label: 'Wishlist', href: '/customer/favorites', icon: Heart },
    { label: 'Help & Support', href: '/customer/settings', icon: CircleHelp },
];

export default function CustomerProfile() {
    const { auth, address, avatarUrl, cartCount = 0, siteSettings = {}, deliveryZones = [] } = usePage<
        SharedData & {
            address?: {
                full_name: string;
                phone: string;
                line1: string;
                barangay?: string | null;
                city: string;
                province: string;
                postal_code: string;
                latitude?: number | null;
                longitude?: number | null;
            };
            avatarUrl?: string | null;
            cartCount?: number;
            siteSettings?: Record<string, string | null>;
            deliveryZones?: { id: number; name: string; barangay: string }[];
        }
    >().props;
    const user = auth.user;
    const brandName = siteSettings.brand_name || 'BSABShop';
    const logoPath = siteSettings.logo_path
        ? siteSettings.logo_path.startsWith('http') || siteSettings.logo_path.startsWith('/')
            ? siteSettings.logo_path
            : `/storage/${siteSettings.logo_path}`
        : null;
    const { data, setData, post, processing, recentlySuccessful, errors, transform } = useForm({
        _method: 'patch',
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: (user?.phone as string | undefined) ?? '',
        avatar: null as File | null,
        address: {
            full_name: address?.full_name ?? user?.name ?? '',
            phone: address?.phone ?? (user?.phone as string | undefined) ?? '',
            line1: address?.line1 ?? '',
            barangay: address?.barangay ?? '',
            city: 'Hinoba-an',
            province: 'Negros Occidental',
            postal_code: address?.postal_code ?? '',
            latitude: address?.latitude ?? null,
            longitude: address?.longitude ?? null,
        },
    });

    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const [paymentData, setPaymentData] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('bsab_customer_payment_preferences');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch {
                    // ignore
                }
            }
        }
        return {
            method: 'GCash / E-Wallet',
            accountName: user?.name ?? 'Customer',
            accountNumber: (user?.phone as string | undefined) ?? '0917-000-0000',
            billingNote: 'Default checkout payment',
        };
    });
    const [paymentSaved, setPaymentSaved] = useState(false);

    const [activeTab, setActiveTab] = useState<ProfileTab>('Personal Information');
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isEditingPayment, setIsEditingPayment] = useState(false);
    const [isEditingSecurity, setIsEditingSecurity] = useState(false);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);

    const [search, setSearch] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    const memberSince = (user as any)?.created_at
        ? new Date((user as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Apr 10, 2026';

    useEffect(() => {
        if (!data.avatar) {
            setAvatarPreview(null);
            return;
        }
        const imageUrl = URL.createObjectURL(data.avatar);
        setAvatarPreview(imageUrl);
        return () => URL.revokeObjectURL(imageUrl);
    }, [data.avatar]);

    const profileImage = avatarPreview || avatarUrl || user?.avatar;
    const avatarSource = profileImage
        ? profileImage.startsWith('http') || profileImage.startsWith('/') || profileImage.startsWith('blob:')
            ? profileImage
            : `/storage/${profileImage}`
        : null;

    function submit(event: React.FormEvent) {
        event.preventDefault();
        transform((formData) => ({
            ...formData,
            address: undefined,
        }));
        post(route('profile.update'), { forceFormData: true, preserveScroll: true, onSuccess: () => setIsEditing(false) });
    }

    function submitAddress(event: React.FormEvent) {
        event.preventDefault();
        post(route('profile.update'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => setIsEditingAddress(false),
        });
    }

    function submitPayment(event: React.FormEvent) {
        event.preventDefault();
        if (typeof window !== 'undefined') {
            localStorage.setItem('bsab_customer_payment_preferences', JSON.stringify(paymentData));
        }
        setPaymentSaved(true);
        setTimeout(() => setPaymentSaved(false), 2500);
        setIsEditingPayment(false);
    }

    function submitSecurity(event: React.FormEvent) {
        event.preventDefault();
        passwordForm.put(route('user-password.update'), {
            preserveScroll: true,
            onSuccess: () => {
                passwordForm.reset();
                setIsEditingSecurity(false);
            },
        });
    }

    function submitSearch(event: React.FormEvent) {
        event.preventDefault();
        router.get(route('home'), { q: search.trim() }, { preserveState: true });
    }

    function editProfile() {
        setActiveTab('Personal Information');
        setIsEditing(true);
    }
    function editAddress() {
        setActiveTab('Addresses');
        setIsEditingAddress(true);
    }
    function editPayment() {
        setActiveTab('Payment Methods');
        setIsEditingPayment(true);
    }
    function editSecurity() {
        setActiveTab('Security');
        setIsEditingSecurity(true);
    }

    const navItems = [
        { label: 'Home', href: '/', icon: Home },
        { label: 'Products', href: '/customer/products', icon: Grid2X2 },
        { label: 'Orders', href: '/customer/orders', icon: Package },
        { label: 'Favorites', href: '/customer/favorites', icon: Heart },
    ];

    function accountOptions() {
        return (
            <div className="absolute top-[calc(100%+8px)] right-0 z-40 w-52 overflow-hidden rounded-xl border border-[#def0e2] bg-white p-1.5 shadow-[0_8px_25px_rgba(22,59,36,0.1)]">
                <div className="border-b border-[#def0e2] px-3.5 py-2.5">
                    <p className="truncate text-xs font-bold text-[#145c3d]">{user?.name}</p>
                    <p className="truncate text-[10px] text-[#5c6e63]">{user?.email}</p>
                </div>
                <div className="p-1">
                    <Link
                        href="/customer/profile"
                        className="flex items-center gap-2 rounded-lg bg-[#f5fcf7] px-3 py-2 text-xs font-bold text-[#1f7a42]"
                    >
                        <UserRound size={15} /> Profile
                    </Link>
                    <Link
                        href="/customer/settings"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#173b2a] hover:bg-[#f5fcf7]"
                    >
                        <Settings size={15} /> Settings
                    </Link>
                    <hr className="my-1 border-[#def0e2]" />
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-[#d96c5a] hover:bg-[#fdf0ed]"
                    >
                        <LogOut size={15} /> Log out
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title="Your profile - bsabshop" />
            <div className="min-h-screen bg-[#f7fbf7] text-[#173b2a] antialiased">
                {/* ── Click-outside overlay for dropdowns ── */}
                {accountMenuOpen && (
                    <div
                        className="fixed inset-0 z-20"
                        aria-hidden="true"
                        onClick={() => {
                            setAccountMenuOpen(false);
                        }}
                    />
                )}

                {/* ── Top Header ── */}
                <header className="relative z-30 border-b border-[#e5eee7] bg-white">
                    <div className="mx-auto flex h-[70px] w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                        {/* ── Brand ── */}
                        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${brandName} home`}>
                            {logoPath ? (
                                <img src={logoPath} alt={brandName} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#25804a]">
                                    <Sparkles size={18} />
                                </span>
                            )}
                            <span className="font-display text-xl font-bold text-[#145c3d]">{brandName}</span>
                        </Link>

                        {/* ── Desktop Nav ── */}
                        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
                            {navItems.map(({ label, href, icon: Icon }) => {
                                const isActive = typeof window !== 'undefined'
                                    ? href === '/' ? window.location.pathname === '/'
                                        : window.location.pathname.startsWith(href)
                                    : false;
                                return (
                                    <Link
                                        key={label}
                                        href={href}
                                        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
                                            isActive
                                                ? 'border-b-2 border-[#2d9960] text-[#1f7a42]'
                                                : 'text-[#647568] hover:bg-[#f5fcf7] hover:text-[#1f7a42]'
                                        }`}
                                    >
                                        <Icon size={15} />
                                        {label}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* ── Search bar ── */}
                        <form
                            onSubmit={submitSearch}
                            className="mx-4 hidden flex-1 items-center gap-2 rounded-full border border-[#dfeae2] bg-[#fbfdfb] px-4 py-2.5 transition focus-within:border-[#2c9350] focus-within:ring-4 focus-within:ring-[#e6f7eb] lg:flex"
                        >
                            <Search size={16} className="shrink-0 text-[#647568]" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search for products, brands and more..."
                                aria-label="Search products"
                                className="w-full min-w-0 bg-transparent text-sm text-[#173b2a] outline-none placeholder:text-[#5c6e63]"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="shrink-0 text-[#5c6e63] hover:text-[#173b2a]">
                                    <X size={15} />
                                </button>
                            )}
                        </form>

                        {/* ── Right actions ── */}
                        <div className="ml-auto flex items-center gap-2">
                            {/* Cart */}
                            <Link
                                href="/customer/cart"
                                aria-label={`Cart, ${cartCount} item${cartCount !== 1 ? 's' : ''}`}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#f5fcf7]"
                            >
                                <ShoppingCart size={18} strokeWidth={2.2} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2a9b59] px-1 text-[9px] font-bold text-white">
                                        {cartCount > 99 ? '99+' : cartCount}
                                    </span>
                                )}
                            </Link>

                            {/* Account */}
                            <div className="relative">
                                <button
                                    type="button"
                                    id="account-menu-btn"
                                    onClick={() => {
                                        setAccountMenuOpen(!accountMenuOpen);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={accountMenuOpen}
                                    aria-label="Account menu"
                                    className="flex items-center gap-2 rounded-full px-2 py-1 text-[#1b4332] transition hover:bg-[#f5fcf7]"
                                >
                                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#52b788] text-[10px] font-bold text-[#1b4332]">
                                        {avatarSource ? (
                                            <img src={avatarSource} alt={user?.name ?? 'You'} className="h-full w-full object-cover" />
                                        ) : (
                                            (user?.name ?? 'You').slice(0, 2).toUpperCase()
                                        )}
                                    </span>
                                    <ChevronDown
                                        size={14}
                                        className={`hidden text-[#647568] transition-transform lg:block ${accountMenuOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {accountMenuOpen && accountOptions()}
                            </div>


                        </div>
                    </div>

                    {/* ── Mobile search row ── */}
                    <div className="hidden border-t border-[#e5eee7] px-4 pt-2 pb-3 lg:hidden">
                        <form
                            onSubmit={submitSearch}
                            className="flex items-center gap-2 rounded-full border border-[#dfeae2] bg-[#fbfdfb] px-4 py-2 focus-within:border-[#2c9350] focus-within:ring-4 focus-within:ring-[#e6f7eb]"
                        >
                            <Search size={16} className="shrink-0 text-[#647568]" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search for products, brands and more..."
                                aria-label="Search products"
                                className="w-full min-w-0 bg-transparent text-sm text-[#173b2a] outline-none placeholder:text-[#5c6e63]"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch('')} aria-label="Clear" className="text-[#5c6e63] hover:text-[#173b2a]">
                                    <X size={15} />
                                </button>
                            )}
                            {/* Universal filter icon - mobile size only */}
                            <Link
                                href="/customer/products"
                                className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1b4332] transition hover:bg-[#eaf4ed] hover:text-[#1f7a42] active:scale-95 sm:hidden"
                                aria-label="Browse and filter products"
                                title="Filter products"
                            >
                                <SlidersHorizontal size={17} strokeWidth={2.2} />
                            </Link>
                        </form>
                    </div>

                </header>

                <main className="mx-auto max-w-7xl px-4 pt-4 pb-24 sm:px-6 md:pt-6 md:pb-12 lg:px-8">
                    {/* ── Desktop Profile Banner (styled like the homepage hero card) ── */}
                    <section className="relative hidden overflow-hidden rounded-2xl border border-[#e1ebdf] bg-[#eef6e8] px-6 py-6 shadow-[0_8px_25px_rgba(22,59,36,0.06)] md:block sm:px-8">
                        <div className="relative flex items-center gap-5">
                            <Avatar src={avatarSource} name={user?.name ?? 'Customer'} size="large" />
                            <div className="min-w-0 flex-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-3 py-1 text-[10px] font-bold tracking-[.08em] text-[#2c8050] uppercase">
                                    <Check size={11} strokeWidth={3} /> Verified Customer
                                </span>
                                <h1 className="font-display mt-2 truncate text-2xl font-bold text-[#145437]">{user?.name}</h1>
                                <p className="mt-0.5 truncate text-xs text-[#5d7768]">{user?.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={editProfile}
                                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#23834b] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23834b]"
                            >
                                <Pencil size={14} /> Edit Profile
                            </button>
                        </div>
                    </section>

                    {/* ── Mobile Profile Banner ── */}
                    <section className="relative overflow-hidden rounded-2xl border border-[#e1ebdf] bg-[#eef6e8] p-4 shadow-[0_6px_20px_rgba(22,59,36,0.06)] md:hidden">
                        <div className="relative flex items-center gap-3.5">
                            <Avatar src={avatarSource} name={user?.name ?? 'Customer'} size="medium" />
                            <div className="min-w-0 flex-1">
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-0.5 text-[9px] font-bold tracking-[.08em] text-[#2c8050] uppercase">
                                    <Check size={10} strokeWidth={3} /> Verified
                                </span>
                                <h1 className="font-display mt-1 truncate text-lg font-bold text-[#145437]">{user?.name}</h1>
                                <p className="truncate text-xs text-[#5d7768]">{user?.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={editProfile}
                                aria-label="Edit profile"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#1f7a42] shadow-sm transition hover:bg-[#f5fcf7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2c9350]"
                            >
                                <Pencil size={16} />
                            </button>
                        </div>
                    </section>

                    {/* ── Customer Statistics ── */}
                    <section aria-label="Customer statistics" className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-4">
                        <Stat icon={Package} value="12" label="Total Orders" compactLabel="Orders" />
                        <Stat icon={CircleDollar} value="₱8,450" label="Total Spent" compactLabel="Total Spent" />
                        <Stat icon={TicketPercent} value="3" label="Vouchers" compactLabel="Vouchers" />
                        <div className="hidden md:block">
                            <Stat icon={Star} value="4.8" label="Customer Rating" />
                        </div>
                    </section>

                    {/* ── Main Profile Grid ── */}
                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.85fr)] lg:gap-5">
                        <section className="overflow-hidden rounded-2xl border border-[#e3eee6] bg-white shadow-[0_4px_16px_rgba(38,104,63,0.04)]">
                            <div role="tablist" aria-label="Profile sections" className="flex overflow-x-auto border-b border-[#e5eee7] px-3 sm:px-5">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab}
                                        onClick={() => {
                                            setActiveTab(tab);
                                            setIsEditing(false);
                                            setIsEditingAddress(false);
                                            setIsEditingPayment(false);
                                            setIsEditingSecurity(false);
                                        }}
                                        className={`shrink-0 border-b-2 px-3.5 py-3 text-xs font-semibold transition sm:px-4 ${
                                            activeTab === tab
                                                ? 'border-[#2d9960] font-bold text-[#1f7a42]'
                                                : 'border-transparent text-[#647568] hover:bg-[#f5fcf7] hover:text-[#1f7a42]'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="p-4 sm:p-6">
                                {activeTab === 'Personal Information' && (
                                    <form onSubmit={submit}>
                                        <div className="mb-5 flex items-center justify-between gap-3">
                                            <h2 className="font-display text-base font-bold text-[#145437]">Personal Information</h2>
                                            {isEditing ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        setData('avatar', null);
                                                    }}
                                                    className="text-xs font-semibold text-[#647568] hover:text-[#173b2a]"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={editProfile}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a42] hover:text-[#186a3a]"
                                                >
                                                    <Pencil size={13} /> Edit details
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid gap-5 md:grid-cols-[112px_minmax(0,1fr)]">
                                            <div className="flex items-center gap-3 md:flex-col md:items-center">
                                                <Avatar src={avatarSource} name={user?.name ?? 'Customer'} size="profile" />
                                                <div className="md:text-center">
                                                    <label
                                                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold text-white transition ${
                                                            isEditing
                                                                ? 'bg-[#23834b] shadow-sm shadow-[#23834b]/20 hover:bg-[#186a3a]'
                                                                : 'hidden'
                                                        }`}
                                                    >
                                                        <Pencil size={12} /> Change Photo
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            className="sr-only"
                                                            disabled={!isEditing}
                                                            onChange={async (event) => {
                                                                const file = event.target.files?.[0];
                                                                setData(
                                                                    'avatar',
                                                                    file ? await optimizeImage(file, { maxWidth: 800, maxHeight: 800 }) : null,
                                                                );
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                                                <ProfileField
                                                    label="Full Name"
                                                    value={data.name}
                                                    editable={isEditing}
                                                    onChange={(value) => setData('name', value)}
                                                    error={errors.name}
                                                />
                                                <ProfileField
                                                    label="Email Address"
                                                    value={data.email}
                                                    type="email"
                                                    editable={isEditing}
                                                    onChange={(value) => setData('email', value)}
                                                    error={errors.email}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-[#e5eee7] pt-4">
                                            <h3 className="font-display text-sm font-bold text-[#145437]">Account Details</h3>
                                            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                                <div>
                                                    <p className="text-[#5c6e63]">Member Since</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">{memberSince}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Account Type</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">Customer</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Verification Status</p>
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-0.5 text-[10px] font-bold text-[#2c8050] uppercase">
                                                        <Check size={11} strokeWidth={3} /> Verified
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <InputError message={errors.avatar} className="mt-2" />
                                        {isEditing && (
                                            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#e5eee7] pt-4">
                                                {recentlySuccessful && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2c9350]">
                                                        <Check size={14} /> Saved
                                                    </span>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className="rounded-full bg-[#23834b] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23834b] disabled:opacity-60"
                                                >
                                                    {processing ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {activeTab === 'Addresses' && (
                                    <form onSubmit={submitAddress}>
                                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <h2 className="font-display text-base font-bold text-[#145437]">Addresses</h2>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsMapPickerOpen(true)}
                                                    className="inline-flex items-center gap-1 rounded-full border border-[#dfeae2] bg-[#f5fcf7] px-3 py-1 text-xs font-bold text-[#1f7a42] transition hover:border-[#2c9350] hover:bg-[#eaf8ee]"
                                                >
                                                    <MapPin size={12} /> Pick on Map
                                                </button>
                                            </div>
                                            {isEditingAddress ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingAddress(false)}
                                                    className="text-xs font-semibold text-[#647568] hover:text-[#173b2a]"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={editAddress}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a42] hover:text-[#186a3a]"
                                                >
                                                    <Pencil size={13} /> Edit details
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid gap-5 md:grid-cols-[112px_minmax(0,1fr)]">
                                            <div className="flex items-center gap-3 md:flex-col md:items-center">
                                                <span className="grid h-18 w-18 shrink-0 place-items-center rounded-full border-2 border-white bg-[#e2f2e4] text-[#23834b] shadow-[0_2px_8px_rgba(22,59,36,0.08)] ring-2 ring-[#dfeae2]">
                                                    <MapPin size={30} />
                                                </span>
                                                <div className="md:text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMapPickerOpen(true)}
                                                        className="inline-flex items-center gap-1 rounded-full bg-[#23834b] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-[#23834b]/20 transition hover:bg-[#186a3a]"
                                                    >
                                                        <MapPin size={12} /> Pick on Map
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-4 flex items-center justify-between rounded-xl border border-[#e1ebdf] bg-[#eef6e8] p-3 sm:px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="grid h-7 w-7 place-items-center rounded-md bg-[#e2f2e4] text-[#23834b]">
                                                            <MapPin size={14} />
                                                        </span>
                                                        <span className="text-xs font-medium text-[#145437]">
                                                            {data.address.line1
                                                                ? `${data.address.line1}, ${data.address.city || ''}`
                                                                : 'No address pinned yet — pinpoint location on map'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMapPickerOpen(true)}
                                                        className="rounded-full border border-[#dfeae2] bg-white px-3 py-1 text-xs font-bold text-[#1f7a42] transition hover:bg-[#f5fcf7]"
                                                    >
                                                        Open Map
                                                    </button>
                                                </div>
                                                <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                                                    <ProfileField
                                                        label="Full Name"
                                                        value={data.address.full_name}
                                                        editable={isEditingAddress}
                                                        onChange={(value) => setData('address', { ...data.address, full_name: value })}
                                                        error={errors['address.full_name']}
                                                    />
                                                    <ProfileField
                                                        label="Phone Number"
                                                        value={data.address.phone}
                                                        editable={isEditingAddress}
                                                        onChange={(value) => setData('address', { ...data.address, phone: value })}
                                                        error={errors['address.phone']}
                                                    />
                                                    <ProfileField
                                                        label="Address Line"
                                                        value={data.address.line1}
                                                        editable={isEditingAddress}
                                                        onChange={(value) => setData('address', { ...data.address, line1: value, latitude: null, longitude: null })}
                                                        error={errors['address.line1']}
                                                    />
                                                    <label className="block text-xs font-semibold text-[#5c6e63]">
                                                        Barangay / Delivery Zone
                                                        <input
                                                            type="text"
                                                            value={data.address.barangay}
                                                            readOnly
                                                            required={isEditingAddress}
                                                            placeholder="Choose a location on the map"
                                                            className="mt-1.5 w-full rounded-xl border border-[#e5eee7] bg-[#f8fcf8] px-3.5 py-2.5 text-xs text-[#173b2a] outline-none"
                                                        />
                                                        {isEditingAddress && (
                                                            <span className="mt-1 block text-[10px] font-normal text-[#647568]">
                                                                Select a location on the map to detect its barangay.
                                                            </span>
                                                        )}
                                                        <InputError message={errors['address.barangay']} className="mt-1" />
                                                    </label>
                                                    <ProfileField
                                                        label="City"
                                                        value={data.address.city}
                                                        editable={false}
                                                        onChange={(value) => setData('address', { ...data.address, city: value })}
                                                        error={errors['address.city']}
                                                    />
                                                    <ProfileField
                                                        label="Province"
                                                        value={data.address.province}
                                                        editable={false}
                                                        onChange={(value) => setData('address', { ...data.address, province: value })}
                                                        error={errors['address.province']}
                                                    />
                                                    <ProfileField
                                                        label="Postal Code"
                                                        value={data.address.postal_code}
                                                        editable={isEditingAddress}
                                                        onChange={(value) => setData('address', { ...data.address, postal_code: value })}
                                                        error={errors['address.postal_code']}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-[#e5eee7] pt-4">
                                            <h3 className="font-display text-sm font-bold text-[#145437]">Account Details</h3>
                                            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                                <div>
                                                    <p className="text-[#5c6e63]">Member Since</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">{memberSince}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Account Type</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">Customer</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Verification Status</p>
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-0.5 text-[10px] font-bold text-[#2c8050] uppercase">
                                                        <Check size={11} strokeWidth={3} /> Verified
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isEditingAddress && (
                                            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#e5eee7] pt-4">
                                                {recentlySuccessful && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2c9350]">
                                                        <Check size={14} /> Saved
                                                    </span>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className="rounded-full bg-[#23834b] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23834b] disabled:opacity-60"
                                                >
                                                    {processing ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {activeTab === 'Payment Methods' && (
                                    <form onSubmit={submitPayment}>
                                        <div className="mb-5 flex items-center justify-between gap-3">
                                            <h2 className="font-display text-base font-bold text-[#145437]">Payment Methods</h2>
                                            {isEditingPayment ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingPayment(false)}
                                                    className="text-xs font-semibold text-[#647568] hover:text-[#173b2a]"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={editPayment}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a42] hover:text-[#186a3a]"
                                                >
                                                    <Pencil size={13} /> Edit details
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid gap-5 md:grid-cols-[112px_minmax(0,1fr)]">
                                            <div className="flex items-center gap-3 md:flex-col md:items-center">
                                                <span className="grid h-18 w-18 shrink-0 place-items-center rounded-full border-2 border-white bg-[#e2f2e4] text-[#23834b] shadow-[0_2px_8px_rgba(22,59,36,0.08)] ring-2 ring-[#dfeae2]">
                                                    <CreditCard size={30} />
                                                </span>
                                                <div className="md:text-center">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-1 text-[10px] font-bold text-[#2c8050]">
                                                        <Check size={11} strokeWidth={3} /> Active
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                                                <ProfileField
                                                    label="Preferred Method"
                                                    value={paymentData.method}
                                                    editable={isEditingPayment}
                                                    onChange={(value) => setPaymentData((p: any) => ({ ...p, method: value }))}
                                                />
                                                <ProfileField
                                                    label="Account / Cardholder Name"
                                                    value={paymentData.accountName}
                                                    editable={isEditingPayment}
                                                    onChange={(value) => setPaymentData((p: any) => ({ ...p, accountName: value }))}
                                                />
                                                <ProfileField
                                                    label="Account / Mobile Number"
                                                    value={paymentData.accountNumber}
                                                    editable={isEditingPayment}
                                                    onChange={(value) => setPaymentData((p: any) => ({ ...p, accountNumber: value }))}
                                                />
                                                <ProfileField
                                                    label="Billing Note / Instructions"
                                                    value={paymentData.billingNote}
                                                    editable={isEditingPayment}
                                                    onChange={(value) => setPaymentData((p: any) => ({ ...p, billingNote: value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-[#e5eee7] pt-4">
                                            <h3 className="font-display text-sm font-bold text-[#145437]">Account Details</h3>
                                            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                                <div>
                                                    <p className="text-[#5c6e63]">Member Since</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">{memberSince}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Account Type</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">Customer</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Verification Status</p>
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-0.5 text-[10px] font-bold text-[#2c8050] uppercase">
                                                        <Check size={11} strokeWidth={3} /> Verified
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isEditingPayment && (
                                            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#e5eee7] pt-4">
                                                {paymentSaved && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2c9350]">
                                                        <Check size={14} /> Saved
                                                    </span>
                                                )}
                                                <button
                                                    type="submit"
                                                    className="rounded-full bg-[#23834b] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23834b]"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        )}
                                    </form>
                                )}

                                {activeTab === 'Security' && (
                                    <form onSubmit={submitSecurity}>
                                        <div className="mb-5 flex items-center justify-between gap-3">
                                            <h2 className="font-display text-base font-bold text-[#145437]">Security</h2>
                                            {isEditingSecurity ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsEditingSecurity(false);
                                                        passwordForm.reset();
                                                    }}
                                                    className="text-xs font-semibold text-[#647568] hover:text-[#173b2a]"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={editSecurity}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f7a42] hover:text-[#186a3a]"
                                                >
                                                    <Pencil size={13} /> Edit details
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid gap-5 md:grid-cols-[112px_minmax(0,1fr)]">
                                            <div className="flex items-center gap-3 md:flex-col md:items-center">
                                                <span className="grid h-18 w-18 shrink-0 place-items-center rounded-full border-2 border-white bg-[#e2f2e4] text-[#23834b] shadow-[0_2px_8px_rgba(22,59,36,0.08)] ring-2 ring-[#dfeae2]">
                                                    <ShieldCheck size={30} />
                                                </span>
                                                <div className="md:text-center">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-1 text-[10px] font-bold text-[#2c8050]">
                                                        <Check size={11} strokeWidth={3} /> Protected
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                                                <ProfileField
                                                    label="Current Password"
                                                    type="password"
                                                    value={isEditingSecurity ? passwordForm.data.current_password : '••••••••••••'}
                                                    editable={isEditingSecurity}
                                                    onChange={(value) => passwordForm.setData('current_password', value)}
                                                    error={passwordForm.errors.current_password}
                                                />
                                                <ProfileField
                                                    label="New Password"
                                                    type="password"
                                                    value={isEditingSecurity ? passwordForm.data.password : '••••••••••••'}
                                                    editable={isEditingSecurity}
                                                    onChange={(value) => passwordForm.setData('password', value)}
                                                    error={passwordForm.errors.password}
                                                />
                                                <ProfileField
                                                    label="Confirm New Password"
                                                    type="password"
                                                    value={isEditingSecurity ? passwordForm.data.password_confirmation : '••••••••••••'}
                                                    editable={isEditingSecurity}
                                                    onChange={(value) => passwordForm.setData('password_confirmation', value)}
                                                    error={passwordForm.errors.password_confirmation}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-6 border-t border-[#e5eee7] pt-4">
                                            <h3 className="font-display text-sm font-bold text-[#145437]">Account Details</h3>
                                            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                                                <div>
                                                    <p className="text-[#5c6e63]">Member Since</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">{memberSince}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Account Type</p>
                                                    <p className="mt-1 font-medium text-[#173b2a]">Customer</p>
                                                </div>
                                                <div>
                                                    <p className="text-[#5c6e63]">Verification Status</p>
                                                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e2f2e4] px-2.5 py-0.5 text-[10px] font-bold text-[#2c8050] uppercase">
                                                        <Check size={11} strokeWidth={3} /> Verified
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {isEditingSecurity && (
                                            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#e5eee7] pt-4">
                                                {passwordForm.recentlySuccessful && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2c9350]">
                                                        <Check size={14} /> Saved
                                                    </span>
                                                )}
                                                <button
                                                    type="submit"
                                                    disabled={passwordForm.processing}
                                                    className="rounded-full bg-[#23834b] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23834b] disabled:opacity-60"
                                                >
                                                    {passwordForm.processing ? 'Saving...' : 'Save Changes'}
                                                </button>
                                            </div>
                                        )}
                                    </form>
                                )}
                            </div>
                        </section>

                        {/* ── Sidebar ── */}
                        <aside className="hidden space-y-4 md:block">
                            {/* Promo Card styled after storefront */}
                            <section className="relative overflow-hidden rounded-2xl border border-[#e1ebdf] bg-[#eef6e8] p-5 shadow-[0_4px_16px_rgba(38,104,63,0.04)]">
                                <div className="relative">
                                    <div className="flex items-center gap-2.5 text-[#145c3d]">
                                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#23834b] text-white shadow-sm">
                                            <ShoppingBag size={20} />
                                        </span>
                                        <div>
                                            <p className="font-display text-sm font-bold text-[#145c3d]">{brandName}</p>
                                            <p className="text-[10px] font-medium text-[#527160]">Quality Products. Better Prices.</p>
                                        </div>
                                    </div>
                                    <h2 className="font-display mt-3.5 text-sm font-bold text-[#145437]">More vouchers, more savings!</h2>
                                    <p className="mt-1 text-xs leading-5 text-[#5d7768]">
                                        Check out our latest vouchers and enjoy exclusive discounts on your favorite products.
                                    </p>
                                    <Link
                                        href="/customer/vouchers"
                                        className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#23834b] py-2.5 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a]"
                                    >
                                        View Vouchers <ChevronRight size={14} />
                                    </Link>
                                </div>
                            </section>

                            {/* Quick Links Card */}
                            <section className="rounded-2xl border border-[#e3eee6] bg-white p-4 shadow-[0_4px_16px_rgba(38,104,63,0.04)]">
                                <h2 className="font-display mb-3 text-sm font-bold text-[#184c35]">Quick Links</h2>
                                <div className="divide-y divide-[#eef4ef]">
                                    {quickLinks.map(({ label, href, tab, icon: Icon }) =>
                                        href ? (
                                            <Link
                                                key={label}
                                                href={href}
                                                className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-xs text-[#5c6e63] transition hover:bg-[#f5fcf7] hover:text-[#1f7a42]"
                                            >
                                                <Icon size={16} className="text-[#2c9350]" />
                                                <span className="flex-1 font-medium">{label}</span>
                                                <ChevronRight size={14} className="text-[#91a197]" />
                                            </Link>
                                        ) : (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => setActiveTab(tab!)}
                                                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-xs text-[#5c6e63] transition hover:bg-[#f5fcf7] hover:text-[#1f7a42]"
                                            >
                                                <Icon size={16} className="text-[#2c9350]" />
                                                <span className="flex-1 font-medium">{label}</span>
                                                <ChevronRight size={14} className="text-[#91a197]" />
                                            </button>
                                        ),
                                    )}
                                </div>
                            </section>
                        </aside>
                    </div>



                    {/* ── Mobile Log Out Button ── */}
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#f8d7da] bg-[#fdf0ed] text-xs font-bold text-[#d96c5a] transition hover:bg-[#fbe4df] md:hidden"
                    >
                        <LogOut size={16} /> Log Out
                    </Link>
                </main>

                <CustomerBottomNav />
            </div>

            <MapPickerModal
                isOpen={isMapPickerOpen}
                onClose={() => setIsMapPickerOpen(false)}
                initialAddress={data.address}
                deliveryBarangays={deliveryZones.map((zone) => zone.barangay)}
                onSelectLocation={(loc) => {
                    setData('address', {
                        ...data.address,
                        line1: loc.line1 || data.address.line1,
                        barangay: loc.barangay,
                        city: loc.city || data.address.city,
                        province: loc.province || data.address.province,
                        postal_code: loc.postal_code || data.address.postal_code,
                        latitude: loc.lat,
                        longitude: loc.lng,
                    });
                    setIsEditingAddress(true);
                }}
            />
        </>
    );
}

function Avatar({
    src,
    name,
    size,
}: {
    src: string | null | undefined;
    name: string;
    size: 'small' | 'medium' | 'large' | 'profile';
}) {
    const dimensions = {
        small: 'h-8 w-8 text-[10px]',
        medium: 'h-14 w-14 text-base',
        large: 'h-18 w-18 text-xl',
        profile: 'h-18 w-18 text-xl',
    }[size];

    return (
        <span
            className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#52b788] font-bold text-[#1b4332] shadow-[0_2px_8px_rgba(22,59,36,0.1)] ring-2 ring-[#dfeae2] ${dimensions}`}
        >
            {src ? (
                <img
                    src={src}
                    alt={`${name} profile`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                        event.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
            )}
        </span>
    );
}

function Stat({
    icon: Icon,
    value,
    label,
    compactLabel,
}: {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    value: string;
    label: string;
    compactLabel?: string;
}) {
    const isStar = Icon === Star;
    return (
        <article className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#e3eee6] bg-white px-3.5 py-3 shadow-[0_3px_12px_rgba(22,59,36,0.04)]">
            <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    isStar ? 'bg-[#fef7ea] text-[#f3b33d]' : 'bg-[#e2f2e4] text-[#23834b]'
                }`}
            >
                <Icon size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
                <strong className="font-display block truncate text-xs font-bold text-[#145437] md:text-sm">{value}</strong>
                <span className="block truncate text-[10px] font-medium text-[#5c6e63]">
                    {compactLabel && (
                        <>
                            <span className="md:hidden">{compactLabel}</span>
                            <span className="hidden md:inline">{label}</span>
                        </>
                    )}
                    {!compactLabel && label}
                </span>
            </span>
        </article>
    );
}

function ProfileField({
    label,
    value,
    type = 'text',
    editable,
    onChange,
    error,
}: {
    label: string;
    value: string;
    type?: string;
    editable: boolean;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <label className="block text-xs font-semibold text-[#5c6e63]">
            {label}
            <input
                type={type}
                value={value}
                readOnly={!editable}
                onChange={(event) => onChange(event.target.value)}
                className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs text-[#173b2a] outline-none transition placeholder:text-[#5c6e63] ${
                    editable
                        ? 'border-[#dfeae2] bg-[#fbfdfb] focus:border-[#2c9350] focus:ring-4 focus:ring-[#e6f7eb]'
                        : 'border-[#e5eee7] bg-[#f8fcf8]'
                }`}
            />
            {error && <InputError message={error} className="mt-1" />}
        </label>
    );
}

function CircleDollar({ size = 20, ...props }: React.ComponentProps<typeof CreditCard>) {
    return (
        <span className="relative grid place-items-center">
            <CreditCard size={size} {...props} />
            <span className="absolute text-[9px] font-extrabold">₱</span>
        </span>
    );
}