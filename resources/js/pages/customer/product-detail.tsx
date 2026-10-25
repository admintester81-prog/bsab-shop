import MobileProductDetail from '@/components/mobile-product-detail';
import ResponsiveProductDetail from '@/components/responsive-product-detail';
import { addCartItem, api, getApiErrorMessage, prepareSanctum } from '@/lib/api';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Grid2X2,
    Headphones,
    Heart,
    Home,
    Package,
    RefreshCcw,
    ShieldCheck,
    ShoppingCart,
    Star,
    TicketPercent,
    Truck,
    UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type ProductOptionValue = {
    id: number;
    value: string;
    sort_order?: number;
    option?: { id: number; name: string };
};

export type ProductOption = {
    id: number;
    name: string;
    sort_order?: number;
    values: ProductOptionValue[];
};

export type ProductVariantOptionValue = {
    product_option_value_id: number;
    optionValue?: {
        id: number;
        value: string;
        option?: { id: number; name: string };
    };
    option_value?: {
        id: number;
        value: string;
        option?: { id: number; name: string };
    };
};

export type ProductVariant = {
    id: number;
    product_id: number;
    name?: string;
    sku?: string;
    price?: string | number;
    stock_quantity: number;
    is_active?: boolean;
    image?: string;
    optionValues?: ProductVariantOptionValue[];
    option_values?: ProductVariantOptionValue[];
};

export type Product = {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    base_price: string;
    sale_price?: string;
    stock_quantity: number;
    available_stock?: number;
    is_out_of_stock?: boolean;
    condition?: string | null;
    brand?: string | null;
    model?: string | null;
    selling_unit?: string | null;
    barcode?: string | null;
    color?: string | null;
    size?: string | null;
    material?: string | null;
    weight?: string | null;
    volume?: string | null;
    pack_quantity?: number | string | null;
    length?: string | null;
    width?: string | null;
    height?: string | null;
    warranty?: string | null;
    country_of_origin?: string | null;
    category?: { name: string; slug: string };
    shop?: { name: string };
    metrics?: { rating_average?: string | number | null; rating_count?: number | null; quantity_sold?: number | null };
    is_favorited?: boolean;
    sku?: string | null;
    images?: { path: string; is_primary?: boolean }[];
    options?: ProductOption[];
    variants?: ProductVariant[];
};

export type VoucherOffer = {
    id: number;
    name: string;
    code: string;
    type: string;
    discount_value: string;
    minimum_spend: string;
    expires_at: string | null;
    requires_claim: boolean;
    claimed_by_user: boolean;
};

function productVariantAssignments(variant: ProductVariant) {
    return variant.optionValues ?? variant.option_values ?? [];
}

function getInitialSelectedValues(productOptions: ProductOption[], productVariants: ProductVariant[] = []) {
    const initial: Record<number, number> = {};

    for (const option of productOptions) {
        const firstAvailable = option.values.find((value) =>
            productVariants.some(
                (variant) =>
                    variant.stock_quantity > 0 &&
                    variant.is_active !== false &&
                    productVariantAssignments(variant).some((assignment) => assignment.product_option_value_id === value.id),
            ),
        );

        if (firstAvailable) {
            initial[option.id] = firstAvailable.id;
        }
    }

    return initial;
}

function variantMatchesSelection(variant: ProductVariant, optionIds: ProductOption[], selectedValues: Record<number, number>) {
    return optionIds.every((option) => {
        const chosenValueId = selectedValues[option.id];
        if (!chosenValueId) {
            return true;
        }

        return (
            option.values.some((value) => value.id === chosenValueId) &&
            productVariantAssignments(variant).some((assignment) => assignment.product_option_value_id === chosenValueId)
        );
    });
}

type ProductDetailPageProps = {
    product: Product;
    similarProducts?: Product[];
    availableVouchers?: VoucherOffer[];
    voucherAvailabilityError?: string | null;
};

function imageUrl(path?: string) {
    return path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null;
}

function formatPrice(value: number | string) {
    const cleanValue = Number(value) || 0;
    return `₱${cleanValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProductDetail({ product, similarProducts = [], availableVouchers = [], voucherAvailabilityError }: ProductDetailPageProps) {
    const { auth } = usePage<SharedData>().props;
    const [isFavorited, setIsFavorited] = useState(Boolean(product.is_favorited));
    const [selectedImage, setSelectedImage] = useState(product.images?.[0]?.path ?? null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [claimedVoucherIds, setClaimedVoucherIds] = useState(
        availableVouchers.filter((voucher) => voucher.claimed_by_user).map((voucher) => voucher.id),
    );
    const [claimingVoucherId, setClaimingVoucherId] = useState<number | null>(null);
    const productOptions = product.options ?? [];
    const variantOptions = productOptions.filter((option) =>
        (product.variants ?? []).some((variant) =>
            productVariantAssignments(variant).some((assignment) => option.values.some((value) => value.id === assignment.product_option_value_id)),
        ),
    );
    const productHasVariantChoices = variantOptions.length > 0;
    const [selectedValues, setSelectedValues] = useState<Record<number, number>>(() =>
        getInitialSelectedValues(variantOptions, product.variants ?? []),
    );

    useEffect(() => {
        setIsFavorited(Boolean(product.is_favorited));
    }, [product.id, product.is_favorited]);

    function toggleFavorite() {
        if (!auth.user) {
            router.visit(route('login'));
            return;
        }

        const previousFavorite = isFavorited;
        setIsFavorited(!previousFavorite);
        router.post(route('customer.favorites.toggle', product.id), {}, {
            preserveScroll: true,
            preserveState: true,
            onError: () => setIsFavorited(previousFavorite),
        });
    }

    const matchingVariant = useMemo(() => {
        if (!productHasVariantChoices) {
            return product.variants?.[0] ?? null;
        }

        return (
            product.variants?.find((variant) => {
                const variantOptionValues = productVariantAssignments(variant);
                if (variantOptionValues.length === 0) {
                    return false;
                }

                return variantOptions.every((option) => {
                    const chosenValueId = selectedValues[option.id];
                    if (!chosenValueId) {
                        return false;
                    }

                    return (
                        option.values.some((value) => value.id === chosenValueId) &&
                        variantOptionValues.some((assignment) => assignment.product_option_value_id === chosenValueId)
                    );
                });
            }) ?? null
        );
    }, [productHasVariantChoices, product, variantOptions, selectedValues]);

    const price = matchingVariant?.price ? Number(matchingVariant.price) : Number(product.sale_price ?? product.base_price);
    const stock = matchingVariant ? matchingVariant.stock_quantity : product.stock_quantity;
    const primaryVariantImage = matchingVariant?.image;
    const displayImage = imageUrl(primaryVariantImage || selectedImage) ?? imageUrl(product.images?.[0]?.path) ?? null;

    const getAvailableValuesForOption = (option: ProductOption) => {
        if (!product.variants?.length) {
            return [];
        }

        return option.values.filter((value) => {
            const candidateSelections = { ...selectedValues, [option.id]: value.id };

            return (product.variants ?? []).some(
                (variant) =>
                    variant.stock_quantity > 0 &&
                    variant.is_active !== false &&
                    variantMatchesSelection(variant, variantOptions, candidateSelections),
            );
        });
    };

    function chooseOption(optionId: number, valueId: number) {
        setSelectedValues((current) => ({ ...current, [optionId]: valueId }));
        setMessage('');
    }

    function changeImage(direction: 1 | -1) {
        const images = product.images ?? [];

        if (images.length < 2) {
            return;
        }

        const currentIndex = Math.max(
            0,
            images.findIndex((image) => image.path === (selectedImage ?? images[0]?.path)),
        );
        const nextIndex = (currentIndex + direction + images.length) % images.length;
        setSelectedImage(images[nextIndex].path);
    }

    async function addToCart(quantity = 1): Promise<boolean> {
        if (!auth.user) {
            setMessage('Please log in to add products to your cart.');
            return false;
        }

        if (matchingVariant && !matchingVariant.is_active) {
            setMessage('This selected variant is not active.');
            return false;
        }

        if (stock < 1) {
            setMessage('This product is out of stock.');
            return false;
        }

        setBusy(true);
        setMessage('');

        try {
            await addCartItem({
                product_id: product.id,
                variant_id: matchingVariant?.id,
                quantity,
            });

            setMessage('Added to your cart.');
            return true;
        } catch (error) {
            setMessage(getApiErrorMessage(error));
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function claimVoucher(voucherId: number) {
        if (!auth.user) {
            router.visit('/login');
            return;
        }

        setClaimingVoucherId(voucherId);
        setMessage('');
        try {
            await prepareSanctum();
            await api.post(`/customer/vouchers/${voucherId}/claim`);
            setClaimedVoucherIds((ids) => [...ids, voucherId]);
            setMessage('Voucher claimed. Add this product to your cart to use it.');
        } catch (error) {
            setMessage(getApiErrorMessage(error, 'Unable to claim this voucher.'));
        } finally {
            setClaimingVoucherId(null);
        }
    }

    async function applyProductVoucher(voucher: VoucherOffer, quantity = 1) {
        if (!auth.user) {
            router.visit('/login');
            return;
        }

        if (!(await addToCart(quantity))) {
            return;
        }

        try {
            await prepareSanctum();
            await api.post('/customer/cart/voucher', { code: voucher.code });
            router.visit('/customer/cart');
        } catch (error) {
            setMessage(getApiErrorMessage(error, 'The voucher could not be applied to this cart.'));
        }
    }

    const originalPrice = product.sale_price ? Number(product.base_price) : null;
    const discountPercent = originalPrice && price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
    const ratingAverage = Number(product.metrics?.rating_average ?? 0);
    const reviewCount = Number(product.metrics?.rating_count ?? 0);
    const categoryBasedSubtitle = [product.category?.name, product.color, product.brand].filter(Boolean).join(' • ');
    const currentImageIndex = Math.max(
        0,
        (product.images ?? []).findIndex((image) => image.path === (selectedImage ?? product.images?.[0]?.path)),
    );

    return (
        <>
            <Head title={product.name} />
            <div className="hidden">
                <div className="hidden lg:block">
                    <div className="mx-auto max-w-295">
                        <div className="relative mb-5 flex h-12 items-center">
                            <Link
                                href={route('home')}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-[#1d2a27] shadow-sm ring-1 ring-[#e0eae1]"
                            >
                                <ArrowLeft size={22} />
                            </Link>
                            <span className="absolute left-1/2 -translate-x-1/2 text-lg font-bold text-[#173a29]">Product Details</span>
                            <Link
                                href={route('customer.cart')}
                                aria-label="Open cart"
                                title="Open cart"
                                className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1d2a27] shadow-sm ring-1 ring-[#e0eae1] transition hover:bg-[#eef7ee]"
                            >
                                <ShoppingCart size={21} />
                            </Link>
                        </div>

                        <div className="rounded-3xl bg-[#e9f3e8] p-4 shadow-[0_12px_32px_rgba(33,72,46,0.06)] ring-1 ring-[#dfeee3] lg:p-5">
                            <div className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
                                <div className="rounded-[22px] bg-white p-3 ring-1 ring-[#d4e7d8] lg:p-4">
                                    <div className="relative flex items-center justify-center overflow-hidden rounded-[18px] bg-[#eaf6ed]">
                                        <div className="absolute top-1/2 left-4 -translate-y-1/2">
                                            <button
                                                type="button"
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1d2a27] shadow-sm ring-1 ring-[#dfeae1]"
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                        </div>
                                        <div className="absolute top-1/2 right-4 -translate-y-1/2">
                                            <button
                                                type="button"
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1d2a27] shadow-sm ring-1 ring-[#dfeae1]"
                                            >
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>

                                        <div className="flex min-h-90 w-full items-center justify-center px-7 py-7">
                                            {displayImage ? (
                                                <img
                                                    src={displayImage}
                                                    alt={product.name}
                                                    className="max-h-82.5 w-full object-contain drop-shadow-[0_28px_30px_rgba(32,44,36,0.12)]"
                                                />
                                            ) : (
                                                <Package size={110} strokeWidth={1.1} className="text-[#2d7f4a]" />
                                            )}
                                        </div>
                                    </div>

                                    {product.images && product.images.length > 1 && (
                                        <div className="mt-3 flex items-center justify-between gap-2">
                                            {product.images.map((image, index) => (
                                                <button
                                                    key={`${image.path}-${index}`}
                                                    type="button"
                                                    onClick={() => setSelectedImage(image.path)}
                                                    className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 bg-white transition ${
                                                        (selectedImage ?? product.images?.[0]?.path) === image.path
                                                            ? 'border-[#2f7c4d] shadow-[0_6px_18px_rgba(47,124,77,0.16)]'
                                                            : 'border-[#dfeae1]'
                                                    }`}
                                                >
                                                    <img
                                                        src={imageUrl(image.path) as string}
                                                        alt={product.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col justify-center px-1 py-2 lg:px-2">
                                    {product.brand && (
                                        <div className="flex items-center gap-3">
                                            <div className="text-[2.5rem] leading-none font-black tracking-[-0.06em] text-[#0d1724] italic">
                                                {product.brand}
                                            </div>
                                        </div>
                                    )}
                                    <h1 className="mt-2 text-4xl font-black tracking-tighter text-[#0e1a17] lg:text-[3.5rem] lg:leading-[0.96]">
                                        {product.name}
                                    </h1>
                                    <p className="mt-3 text-lg font-medium text-[#5c7061] sm:text-[1.05rem]">
                                        {categoryBasedSubtitle || 'Product details'}
                                    </p>

                                    <div className="mt-5 flex items-center gap-3 text-lg">
                                        <div className="flex items-center gap-1 text-[#f3b63f]">
                                            <Star size={18} fill="currentColor" strokeWidth={0} />
                                            <span className="font-bold text-[#0d1724]">
                                                {Number.isFinite(ratingAverage) ? ratingAverage.toFixed(1) : '0.0'}
                                            </span>
                                        </div>
                                        <span className="text-[#587062]">({reviewCount.toLocaleString()} reviews)</span>
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center gap-4">
                                        <div className="text-[2.4rem] font-black tracking-[-0.06em] text-[#111d1f]">{formatPrice(price)}</div>
                                        {originalPrice ? (
                                            <>
                                                <div className="text-[1.4rem] font-medium text-[#7d8d82] line-through">
                                                    {formatPrice(originalPrice)}
                                                </div>
                                                {discountPercent && (
                                                    <div className="rounded-full bg-[#f36b40] px-3 py-1 text-sm font-bold text-white">
                                                        {discountPercent}% OFF
                                                    </div>
                                                )}
                                            </>
                                        ) : null}
                                    </div>

                                    {availableVouchers.length > 0 && (
                                        <section className="mt-5 space-y-2" aria-label="Available product vouchers">
                                            <h2 className="text-sm font-bold text-[#163b24]">Available Vouchers</h2>
                                            {availableVouchers.slice(0, 3).map((voucher) => {
                                                const claimed = claimedVoucherIds.includes(voucher.id);

                                                return (
                                                    <div
                                                        key={voucher.id}
                                                        className="flex items-center gap-3 rounded-xl border border-[#cfe8d4] bg-[#f3fbf5] p-3"
                                                    >
                                                        <TicketPercent size={22} className="shrink-0 text-[#1f7a42]" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold text-[#163b24]">
                                                                {voucher.type === 'percentage'
                                                                    ? `${voucher.discount_value}% OFF`
                                                                    : voucher.type === 'free_shipping'
                                                                      ? 'Free shipping'
                                                                      : `${formatPrice(voucher.discount_value)} OFF`}
                                                            </p>
                                                            <p className="truncate text-xs text-[#647568]">
                                                                Min. spend {formatPrice(voucher.minimum_spend)} · Code {voucher.code}
                                                            </p>
                                                        </div>
                                                        {voucher.requires_claim && !claimed ? (
                                                            <button
                                                                type="button"
                                                                disabled={claimingVoucherId === voucher.id}
                                                                onClick={() => claimVoucher(voucher.id)}
                                                                className="rounded-lg bg-[#1f7a42] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                                            >
                                                                {claimingVoucherId === voucher.id ? 'Claiming…' : 'Claim'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => void applyProductVoucher(voucher)}
                                                                className="rounded-lg border border-[#9dc7a7] px-3 py-2 text-xs font-bold text-[#1f7a42]"
                                                            >
                                                                Use Now
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </section>
                                    )}

                                    <p className="mt-7 max-w-152 text-[1.06rem] leading-8 text-[#465b50] lg:hidden">
                                        {product.description ||
                                            "The Nike Air Force 1 07 brings a classic look and all-day comfort. Featuring premium leather, iconic style, and durable construction, it's a must-have for any sneaker collection."}
                                    </p>

                                    {productHasVariantChoices && (
                                        <div className="mt-8 grid gap-6 rounded-3xl border border-[#dfeae1] bg-white/30 p-4 sm:grid-cols-2 sm:p-5">
                                            {variantOptions.map((option) => {
                                                const availableValues = getAvailableValuesForOption(option);

                                                if (!availableValues.length) {
                                                    return null;
                                                }

                                                return (
                                                    <div key={option.id}>
                                                        <div className="mb-4 flex items-center justify-between gap-3">
                                                            <span className="text-[1.1rem] font-semibold text-[#111d1f]">{option.name}</span>
                                                            <span className="text-sm text-[#607062]">
                                                                {option.values.find((value) => selectedValues[option.id] === value.id)?.value ??
                                                                    'Select'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {option.values.map((value) => {
                                                                const isAvailable = availableValues.some(
                                                                    (availableValue) => availableValue.id === value.id,
                                                                );
                                                                const isSelected = selectedValues[option.id] === value.id;

                                                                return (
                                                                    <button
                                                                        key={value.id}
                                                                        type="button"
                                                                        onClick={() => isAvailable && chooseOption(option.id, value.id)}
                                                                        disabled={!isAvailable}
                                                                        className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3 py-2 text-base font-semibold transition ${
                                                                            isSelected
                                                                                ? 'border-[#2f7c4d] bg-[#dfeee3] text-[#173a26]'
                                                                                : isAvailable
                                                                                  ? 'border-[#d9e4db] bg-white text-[#274334] hover:bg-[#eef7ee]'
                                                                                  : 'cursor-not-allowed border-[#e9efe9] bg-[#f5f7f5] text-[#b4beb7] line-through opacity-50'
                                                                        }`}
                                                                    >
                                                                        {value.value}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="mt-6 grid gap-2 rounded-[18px] border border-[#dfeae1] bg-[#f7faf7] p-2 sm:grid-cols-4 sm:p-3">
                                        {[
                                            { icon: ShieldCheck, label: 'Authentic', sub: '100% Original' },
                                            { icon: Truck, label: 'Free Shipping', sub: 'On orders over $50' },
                                            { icon: RefreshCcw, label: 'Easy Returns', sub: '7-day policy' },
                                            { icon: Headphones, label: '24/7 Support', sub: "We're here to help" },
                                        ].map(({ icon: Icon, label, sub }) => (
                                            <div
                                                key={label}
                                                className="flex flex-col items-center justify-center gap-1 rounded-[14px] bg-white/40 px-2 py-3 text-center"
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf8f0] text-[#2a7a49]">
                                                    <Icon size={19} strokeWidth={1.9} />
                                                </div>
                                                <div className="text-[0.95rem] font-semibold text-[#1d2d24]">{label}</div>
                                                <div className="text-[0.76rem] leading-5 text-[#63796d]">{sub}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={addToCart}
                                            disabled={busy || stock < 1}
                                            className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-[#2a7a4a] to-[#1c5f3a] px-5 py-3.5 text-[1.08rem] font-bold text-white shadow-[0_18px_30px_rgba(31,122,66,0.24)] transition hover:brightness-105 disabled:opacity-60"
                                        >
                                            <ShoppingCart size={20} />
                                            {busy ? 'Adding...' : 'Add to Cart'}
                                        </button>
                                        <button
                                            type="button"
                                            className="flex items-center justify-center gap-3 rounded-2xl border border-[#cde8d5] bg-white/70 px-6 py-3.5 text-[1.08rem] font-bold text-[#173b2b] shadow-sm transition hover:bg-white"
                                        >
                                            Buy Now
                                            <ArrowRight size={18} />
                                        </button>
                                    </div>

                                    {message && <p className="mt-4 text-sm font-semibold text-[#2b7a46]">{message}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-[22px] border border-[#dfeae1] bg-[#eefaf0] p-3 shadow-[0_12px_24px_rgba(23,52,35,0.04)] lg:p-4">
                            <div className="mb-3 flex items-center justify-between px-1">
                                <h2 className="flex items-center gap-2 text-lg font-bold text-[#173a29]">
                                    <span className="text-[#2f7c4d]">✿</span>
                                    Similar Products
                                </h2>
                                <span className="text-sm font-semibold text-[#2f7c4d]">See All →</span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-4">
                                {similarProducts.slice(0, 4).map((item) => {
                                    const itemImage = imageUrl(item.images?.[0]?.path) ?? null;
                                    const itemPrice = item.sale_price ?? item.base_price;

                                    return (
                                        <Link
                                            key={item.id}
                                            href={route('products.show', item.uuid)}
                                            className="group overflow-hidden rounded-2xl border border-[#dfeae1] bg-white/70 p-2 transition hover:-translate-y-0.5 hover:shadow-md"
                                        >
                                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#edf5ee]">
                                                {itemImage ? (
                                                    <img src={itemImage} alt={item.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Package size={48} className="text-[#2e7c4a]" />
                                                )}
                                            </div>
                                            <div className="mt-3">
                                                <div className="line-clamp-2 text-base font-semibold text-[#152b21]">{item.name}</div>
                                                <div className="mt-1 text-xs font-medium text-[#5d7667]">
                                                    {item.category?.name}
                                                    {item.brand ? ` • ${item.brand}` : ''}
                                                </div>
                                                <div className="mt-1 flex items-center gap-1 text-xs text-[#557264]">
                                                    <Star size={13} className="fill-[#f3b63f] text-[#f3b63f]" />
                                                    <span className="font-bold text-[#1d3428]">
                                                        {Number(item.metrics?.rating_average ?? 0).toFixed(1)}
                                                    </span>
                                                    <span>({Number(item.metrics?.rating_count ?? 0).toLocaleString()})</span>
                                                </div>
                                                <div className="mt-1 line-clamp-2 text-xs leading-4 text-[#63796d]">
                                                    {item.description || 'Fresh quality product for your everyday needs.'}
                                                </div>
                                                <div className="mt-2 text-lg font-bold text-[#162b22]">{formatPrice(itemPrice)}</div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto max-w-160 lg:hidden">
                    <div className="rounded-[20px] bg-white p-2.5 shadow-sm ring-1 ring-[#e5e9e4]">
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#edf5ef]">
                            <div className="absolute top-2 right-2 z-10 rounded-full bg-white/90 px-2 py-1 text-[0.6rem] font-semibold text-[#6b8174] shadow-sm">
                                {product.images?.length ? `${currentImageIndex + 1}/${product.images.length}` : '1/1'}
                            </div>
                            {displayImage ? (
                                <img src={displayImage} alt={product.name} className="h-full w-full object-contain" />
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <Package size={74} className="text-[#2d7f4a]" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => changeImage(-1)}
                                disabled={!product.images || product.images.length < 2}
                                className="absolute top-1/2 left-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1d2a27] shadow-sm"
                            >
                                <ArrowLeft size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => changeImage(1)}
                                disabled={!product.images || product.images.length < 2}
                                className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#1d2a27] shadow-sm"
                            >
                                <ArrowRight size={14} />
                            </button>
                        </div>

                        {product.images && product.images.length > 1 && (
                            <div className="mt-2 flex gap-1.5 overflow-hidden">
                                {product.images.slice(0, 5).map((image, index) => (
                                    <button
                                        key={`${image.path}-${index}`}
                                        type="button"
                                        onClick={() => setSelectedImage(image.path)}
                                        className={`h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${
                                            (selectedImage ?? product.images?.[0]?.path) === image.path ? 'border-[#2f7c4d]' : 'border-[#e2ebe3]'
                                        }`}
                                    >
                                        <img src={imageUrl(image.path) as string} alt={product.name} className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-3">
                            <h1 className="text-3xl font-black tracking-tighter text-[#0e1a17]">{product.name}</h1>
                            {product.brand && <p className="mt-2 text-base font-semibold text-[#3b5c4b]">{product.brand}</p>}
                            <p className="mt-1 text-xs text-[#536a5d]">{categoryBasedSubtitle || 'Product details'}</p>

                            <div className="mt-2 flex items-center gap-2 text-xs text-[#51715d]">
                                <Star size={16} className="fill-[#f3b63f] text-[#f3b63f]" />
                                <span className="font-bold text-[#111d1f]">{Number.isFinite(ratingAverage) ? ratingAverage.toFixed(1) : '0.0'}</span>
                                <span>({reviewCount.toLocaleString()} reviews)</span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-2xl font-black text-[#167044]">{formatPrice(price)}</span>
                                {originalPrice && <span className="text-xs text-[#778b7b] line-through">{formatPrice(originalPrice)}</span>}
                                {discountPercent && (
                                    <span className="rounded-full bg-[#f36b40] px-2 py-0.5 text-[0.6rem] font-bold text-white">
                                        {discountPercent}% OFF
                                    </span>
                                )}
                            </div>

                            <p className="mt-1 text-[0.65rem] text-[#63796d]">
                                {product.description || 'Fresh quality product for your everyday needs.'}
                            </p>

                            {productHasVariantChoices && (
                                <div className="mt-5 space-y-4">
                                    {variantOptions.map((option) => {
                                        const availableValues = getAvailableValuesForOption(option);

                                        if (!availableValues.length) {
                                            return null;
                                        }

                                        return (
                                            <div key={option.id}>
                                                <div className="mb-2 text-sm font-semibold text-[#1d2d24]">{option.name}</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {option.values.map((value) => {
                                                        const isAvailable = availableValues.some((availableValue) => availableValue.id === value.id);
                                                        const isSelected = selectedValues[option.id] === value.id;

                                                        return (
                                                            <button
                                                                key={value.id}
                                                                type="button"
                                                                onClick={() => isAvailable && chooseOption(option.id, value.id)}
                                                                disabled={!isAvailable}
                                                                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                                                                    isSelected
                                                                        ? 'border-[#2f7c4d] bg-[#dfeee3] text-[#173a26]'
                                                                        : isAvailable
                                                                          ? 'border-[#d9e4db] bg-white text-[#274334]'
                                                                          : 'cursor-not-allowed border-[#edf0ee] bg-[#f5f7f5] text-[#b4beb7] opacity-60'
                                                                }`}
                                                            >
                                                                {value.value}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-4 grid grid-cols-4 gap-1 rounded-[14px] border border-[#dfeae1] bg-[#f7faf7] p-1.5">
                                {[
                                    { icon: ShieldCheck, label: 'Authentic' },
                                    { icon: Truck, label: 'Free Shipping' },
                                    { icon: RefreshCcw, label: 'Easy Returns' },
                                    { icon: Headphones, label: '24/7 Support' },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex flex-col items-center gap-1 rounded-lg bg-white/50 px-1 py-2 text-center">
                                        <Icon size={14} className="text-[#2a7a49]" />
                                        <span className="text-[0.55rem] leading-3 font-semibold text-[#315544]">{label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 flex gap-2">
                                <div className="flex items-center rounded-xl border border-[#d7e6da] bg-[#f8faf8] px-2 text-xs font-bold text-[#2f7c4d]">
                                    <button type="button" className="px-1 text-[#73917f]">
                                        −
                                    </button>
                                    <span className="px-2">1</span>
                                    <button type="button" className="px-1 text-[#73917f]">
                                        +
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={addToCart}
                                    disabled={busy || stock < 1}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2f7c4d] px-3 py-2.5 text-sm font-bold text-white"
                                >
                                    <ShoppingCart size={18} />
                                    {busy ? 'Adding...' : 'Add to Cart'}
                                </button>
                            </div>

                            {message && <p className="mt-4 text-sm font-semibold text-[#2b7a46]">{message}</p>}
                        </div>
                    </div>

                    <div className="mt-5 rounded-[20px] bg-[#eefaf0] p-3 ring-1 ring-[#dfeae1]">
                        <div className="mb-3 flex items-center justify-between px-1">
                            <h2 className="flex items-center gap-2 text-base font-bold text-[#173a29]">
                                <span className="text-[#2f7c4d]">✿</span>
                                Similar Products
                            </h2>
                            <span className="text-xs font-semibold text-[#2f7c4d]">See All →</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {similarProducts.slice(0, 4).map((item) => {
                                const itemImage = imageUrl(item.images?.[0]?.path) ?? null;
                                const itemPrice = item.sale_price ?? item.base_price;

                                return (
                                    <Link
                                        key={item.id}
                                        href={route('products.show', item.uuid)}
                                        className="overflow-hidden rounded-xl border border-[#dfeae1] bg-white p-1.5"
                                    >
                                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[9px] bg-[#edf5ee]">
                                            {itemImage ? (
                                                <img src={itemImage} alt={item.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package size={38} className="text-[#2e7c4a]" />
                                            )}
                                        </div>
                                        <div className="mt-2 px-1 pb-1">
                                            <div className="line-clamp-2 text-xs leading-4 font-semibold text-[#152b21]">{item.name}</div>
                                            <div className="mt-1 line-clamp-1 text-[0.65rem] font-medium text-[#5d7667]">
                                                {item.category?.name}
                                                {item.brand ? ` • ${item.brand}` : ''}
                                            </div>
                                            <div className="mt-1 flex items-center gap-1 text-[0.65rem] text-[#557264]">
                                                <Star size={11} className="fill-[#f3b63f] text-[#f3b63f]" />
                                                <span className="font-bold text-[#1d3428]">
                                                    {Number(item.metrics?.rating_average ?? 0).toFixed(1)}
                                                </span>
                                                <span>({Number(item.metrics?.rating_count ?? 0).toLocaleString()})</span>
                                            </div>
                                            <div className="mt-1 line-clamp-2 text-[0.65rem] leading-3 text-[#63796d]">
                                                {item.description || 'Fresh quality product for your everyday needs.'}
                                            </div>
                                            <div className="mt-1 text-sm font-bold text-[#167044]">{formatPrice(itemPrice)}</div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            <ResponsiveProductDetail
                product={product}
                similarProducts={similarProducts}
                availableVouchers={availableVouchers}
                voucherAvailabilityError={voucherAvailabilityError}
                selectedImage={selectedImage}
                displayImage={displayImage}
                currentImageIndex={currentImageIndex}
                variantOptions={variantOptions}
                selectedValues={selectedValues}
                matchingVariant={matchingVariant}
                price={price}
                originalPrice={originalPrice}
                discountPercent={discountPercent}
                stock={stock}
                chooseOption={chooseOption}
                getAvailableValuesForOption={getAvailableValuesForOption}
                onChangeImage={changeImage}
                onSelectImage={setSelectedImage}
                onClaimVoucher={claimVoucher}
                onUseVoucher={applyProductVoucher}
                actionMessage={message}
                claimedVoucherIds={claimedVoucherIds}
                claimingVoucherId={claimingVoucherId}
                isFavorited={isFavorited}
                onToggleFavorite={toggleFavorite}
            />
            <nav className="hidden" aria-label="Tablet navigation">
                <Link href={route('home')} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#1b4332]">
                    <Home size={19} />
                    Home
                </Link>
                <Link
                    href={auth.user ? route('customer.products') : route('login')}
                    className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#5c6e63]"
                >
                    <Grid2X2 size={19} />
                    Products
                </Link>
                <Link
                    href={auth.user ? route('customer.favorites') : route('login')}
                    className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#5c6e63]"
                >
                    <Heart size={19} />
                    Favorites
                </Link>
                <Link
                    href={auth.user ? route('customer.cart') : route('login')}
                    className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#5c6e63]"
                >
                    <ShoppingCart size={19} />
                    Cart
                </Link>
                <Link
                    href={auth.user ? route('customer.profile') : route('login')}
                    className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#5c6e63]"
                >
                    <UserRound size={19} />
                    Profile
                </Link>
            </nav>
            <div className="block min-[446px]:hidden">
                <MobileProductDetail
                    product={product}
                    matchingVariant={matchingVariant}
                    variantOptions={variantOptions}
                    selectedValues={selectedValues}
                    chooseOption={chooseOption}
                    getAvailableValuesForOption={getAvailableValuesForOption}
                    price={price}
                    originalPrice={originalPrice}
                    discountPercent={discountPercent}
                    stock={stock}
                    ratingAverage={ratingAverage}
                    reviewCount={reviewCount}
                    isFavorited={isFavorited}
                    onToggleFavorite={toggleFavorite}
                />
            </div>
        </>
    );
}
