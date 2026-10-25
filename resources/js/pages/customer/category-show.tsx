import { PortalLayout } from '@/components/portal-layout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Package, Search, ShoppingCart, Star } from 'lucide-react';

type Product = {
    id: number;
    uuid: string;
    name: string;
    description?: string | null;
    base_price: string;
    sale_price?: string | null;
    category?: { name: string; slug: string };
    shop?: { name: string };
    images?: { path: string }[];
};

type CategoryPageProps = {
    category: { id: number; name: string; slug: string; image?: string | null };
    products: Product[];
};

function imageUrl(path?: string | null) {
    return path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null;
}

export default function CustomerCategoryShow({ category, products = [] }: CategoryPageProps) {
    return (
        <>
            <Head title={`${category.name} - BSABShop`} />
            <PortalLayout role="customer" title={category.name} eyebrow="Category collection">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <Link
                        href={route('customer.products')}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f7a42] hover:text-[#185f35]"
                    >
                        <ArrowLeft size={16} /> Back to products
                    </Link>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#e6f7eb] px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-[#1f7a42] uppercase">
                        <Package size={12} /> {products.length} items
                    </span>
                </div>

                <section className="mb-7 overflow-hidden rounded-[28px] border border-[#def0e2] bg-white shadow-[0_10px_28px_rgba(22,59,36,0.04)]">
                    <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                        <div className="flex items-center justify-center bg-[#edf7ee] p-6">
                            {imageUrl(category.image) ? (
                                <img src={imageUrl(category.image) as string} alt={category.name} className="h-32 w-32 rounded-3xl object-cover" />
                            ) : (
                                <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-[#dfeee2] text-[#1f7a42]">
                                    <Package size={42} />
                                </div>
                            )}
                        </div>
                        <div className="p-6 md:p-8">
                            <p className="text-[10px] font-bold tracking-[0.14em] text-[#2c9350] uppercase">Collection</p>
                            <h1 className="font-display mt-2 text-3xl font-bold text-[#163b24] md:text-4xl">{category.name}</h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-[#647568]">
                                Browse all products available under this category and discover the latest picks from trusted BSABShop sellers.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link
                                    href={route('marketplace')}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#1f7a42] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#185f35]"
                                >
                                    <Search size={15} /> Browse in marketplace
                                </Link>
                                <Link
                                    href={route('customer.products')}
                                    className="inline-flex items-center gap-2 rounded-full border border-[#def0e2] bg-[#f9fbfa] px-5 py-3 text-sm font-bold text-[#1b4332] transition hover:bg-[#f3faf5]"
                                >
                                    Explore other categories
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {products.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                        {products.map((product) => {
                            const price = product.sale_price ?? product.base_price;
                            const image = product.images?.[0]?.path;
                            return (
                                <article
                                    key={product.id}
                                    className="flex flex-col overflow-hidden rounded-3xl border border-[#def0e2] bg-white shadow-[0_6px_20px_rgba(22,59,36,0.06)] transition hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <div className="relative flex aspect-square items-center justify-center bg-[#efe9dd]">
                                        {image ? (
                                            <img
                                                src={image.startsWith('http') || image.startsWith('/') ? image : `/storage/${image}`}
                                                alt={product.name}
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <Package size={58} strokeWidth={1.2} className="text-[#2c9350]" />
                                        )}
                                    </div>
                                    <div className="flex flex-1 flex-col p-3.5">
                                        <span className="text-[10px] font-bold tracking-[.06em] text-[#2c9350] uppercase">
                                            {product.category?.name ?? category.name}
                                        </span>
                                        <h3 className="mt-1 line-clamp-2 text-sm font-semibold">{product.name}</h3>
                                        <p className="mt-1 truncate text-xs text-[#647568]">{product.shop?.name ?? 'BSABShop seller'}</p>
                                        <div className="mt-2 flex items-center gap-1 text-xs text-[#5c6e63]">
                                            <Star size={12} fill="#2c9350" className="text-[#2c9350]" /> New listing
                                        </div>
                                        <div className="mt-auto pt-3">
                                            <div className="font-display mb-2 text-lg font-bold text-[#163b24]">
                                                ₱{Number(price).toLocaleString()}
                                            </div>
                                            <Link
                                                href={route('products.show', product.uuid)}
                                                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#48ad68] px-2 py-2.5 text-xs font-bold text-white"
                                            >
                                                <ShoppingCart size={14} /> View product
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-[#c4e3ce] bg-[#fbfaf6] py-16 text-center text-sm text-[#5c6e63]">
                        No products are available in this category yet.
                    </div>
                )}
            </PortalLayout>
        </>
    );
}
