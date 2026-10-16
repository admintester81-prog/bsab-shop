import { api, getApiErrorMessage } from '@/lib/api';
import { Head, Link } from '@inertiajs/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Eye, FileText, Package, ShoppingBag, Truck, XCircle } from 'lucide-react';

type OrderImage = { path: string; is_primary?: boolean };
type OrderItem = {
    id: number;
    quantity: number;
    product?: { name?: string; images?: OrderImage[] };
};
type CustomerOrder = {
    id: number;
    order_number: string;
    status: string;
    created_at: string;
    total: string | number;
    discount?: string | number | null;
    voucher_code_snapshot?: string | null;
    items?: OrderItem[];
};
type OrdersPage = {
    data: CustomerOrder[];
    current_page: number;
    last_page: number;
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatMoney(value: string | number | null | undefined) {
    return `₱${Number(value ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function getImageUrl(path?: string) {
    if (!path) return null;
    return path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`;
}

function normalizedStatus(status: string) {
    return status.toLowerCase().replace(/[_-]/g, ' ').trim();
}

function OrderStatus({ status }: { status: string }) {
    const normalized = normalizedStatus(status);
    const label = normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const Icon =
        normalized === 'pending'
            ? Clock3
            : normalized === 'cancelled'
              ? XCircle
              : normalized === 'shipped' || normalized === 'out for delivery'
                ? Truck
                : CheckCircle2;

    return (
        <span className={`history-status history-status-${normalized.replace(/\s+/g, '-')}`}>
            <Icon size={14} aria-hidden="true" />
            {label}
        </span>
    );
}

function OrderCard({ order }: { order: CustomerOrder }) {
    const items = order.items ?? [];
    const firstItem = items[0];
    const productCount = items.length;
    const trackingHref = firstItem
        ? `/customer/order-tracking?selected_item_ids%5B%5D=${encodeURIComponent(firstItem.id)}`
        : `/customer/order-tracking?order_id=${encodeURIComponent(order.id)}`;

    return (
        <article className="history-order-card">
            <div className="history-order-details">
                <span className="history-order-icon">
                    <ShoppingBag size={22} aria-hidden="true" />
                </span>
                <div className="history-order-copy">
                    <h2>Order #{order.order_number}</h2>
                    <p className="history-order-date">
                        <CalendarDays size={14} aria-hidden="true" />
                        <time dateTime={order.created_at}>{formatDate(order.created_at)}</time>
                    </p>
                    <OrderStatus status={order.status} />
                </div>
            </div>

            <div className="history-order-products">
                <div className="history-thumbnails" aria-label={`${Math.min(items.length, 4)} product thumbnails`}>
                    {items.slice(0, 4).map((item) => {
                        const image =
                            item.product?.images?.find((productImage) => productImage.is_primary) ?? item.product?.images?.[0];
                        const src = getImageUrl(image?.path);

                        return (
                            <div className="history-thumbnail" key={item.id}>
                                {src ? (
                                    <img src={src} alt={item.product?.name || 'Ordered product'} loading="lazy" />
                                ) : (
                                    <Package size={21} aria-label="Product image unavailable" />
                                )}
                            </div>
                        );
                    })}
                    {items.length > 4 && <span className="history-thumbnail-more">+{items.length - 4}</span>}
                </div>
                <div className="history-product-copy">
                    <p className="history-main-product">{firstItem?.product?.name || 'Your order'}</p>
                    {productCount > 1 && <p className="history-extra-products">and {productCount - 1} more</p>}
                    <p className="history-item-count">
                        {productCount} {productCount === 1 ? 'item' : 'items'} in this order
                    </p>
                </div>
            </div>

            <div className="history-order-total">
                <div>
                    <p className="history-total-label">Order total</p>
                    <p className="history-total-value">{formatMoney(order.total)}</p>
                    {order.voucher_code_snapshot && (
                        <p className="history-voucher">
                            {order.voucher_code_snapshot} · saved discount {formatMoney(order.discount)}
                        </p>
                    )}
                </div>
                <Link href={trackingHref} className="history-view-order" aria-label={`View order ${order.order_number}`}>
                    <Eye size={15} aria-hidden="true" />
                    View order
                    <ArrowRight size={15} aria-hidden="true" />
                </Link>
            </div>
        </article>
    );
}

export default function CustomerOrders() {
    const {
        data,
        isLoading,
        isError,
        error,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteQuery({
        queryKey: ['customer-orders-history'],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => (await api.get<OrdersPage>('/customer/orders', { params: { page: pageParam } })).data,
        getNextPageParam: (lastPage) =>
            lastPage.current_page < lastPage.last_page ? lastPage.current_page + 1 : undefined,
    });
    const orders = data?.pages.flatMap((page) => page.data) ?? [];

    return (
        <>
            <Head title="Order history" />
            <main className="history-page">
                <style>{`
                    .history-page{min-height:100vh;overflow:hidden;background:#f4faf6;padding:24px 28px 48px;color:#173f35}
                    .history-container{position:relative;width:min(100%,1420px);margin:0 auto}
                    .history-back{display:flex;width:40px;height:40px;align-items:center;justify-content:center;border:1px solid #d6eee1;border-radius:50%;background:#fff;color:#168553;box-shadow:0 4px 14px #173f350d;transition:background .15s,transform .15s}
                    .history-back:hover{transform:translateX(-2px);background:#eaf8f0}
                    .history-heading{display:flex;align-items:center;gap:20px;margin:14px 0 24px;padding:8px 18px}
                    .history-heading-icon{display:flex;width:74px;height:74px;flex:none;align-items:center;justify-content:center;border:1px solid #c9edd9;border-radius:50%;background:#e3f8ec;color:#10804f}
                    .history-heading-title{margin:0;color:#12614c;font-size:29px;line-height:1.2;font-weight:850}
                    .history-heading-kicker{margin:5px 0 0;color:#159b60;font-size:14px;font-weight:800}
                    .history-heading-description{margin:5px 0 0;color:#64877d;font-size:13px}
                    .history-list{display:grid;gap:14px;border:1px solid #e1f1e8;border-radius:20px;background:#fbfefc;padding:16px;box-shadow:0 8px 26px #173f3508}
                    .history-order-card{display:grid;grid-template-columns:minmax(220px,.95fr) minmax(280px,1.7fr) minmax(205px,.9fr);align-items:center;gap:22px;min-width:0;border:1px solid #d4eee0;border-radius:16px;background:#fff;padding:18px 20px;box-shadow:0 4px 14px #173f3505}
                    .history-order-details{display:flex;min-width:0;align-items:flex-start;gap:13px}
                    .history-order-icon{display:flex;width:44px;height:44px;flex:none;align-items:center;justify-content:center;border:1px solid #c7edd7;border-radius:50%;background:#e5f8ed;color:#128653}
                    .history-order-copy{min-width:0}
                    .history-order-copy h2{margin:1px 0 7px;color:#12614c;font-size:15px;line-height:1.4;font-weight:850;overflow-wrap:anywhere}
                    .history-order-date{display:flex;align-items:center;gap:6px;margin:0 0 9px;color:#648a80;font-size:12px}
                    .history-order-date svg{color:#20a578}
                    .history-status{display:inline-flex;align-items:center;gap:5px;border:1px solid #c1ebd0;border-radius:999px;background:#e8f8ed;padding:4px 10px;color:#13834e;font-size:11px;font-weight:800}
                    .history-status-pending{border-color:#ffe0a3;background:#fff6df;color:#b87305}
                    .history-status-cancelled{border-color:#f1c9c2;background:#fff2ef;color:#ac4839}
                    .history-order-products{display:flex;min-width:0;align-items:center;gap:14px}
                    .history-thumbnails{display:flex;flex:none;align-items:center;gap:7px}
                    .history-thumbnail{display:flex;width:54px;height:54px;align-items:center;justify-content:center;overflow:hidden;border:1px solid #e4eee8;border-radius:10px;background:#f2f7f3;color:#7ba392}
                    .history-thumbnail img{width:100%;height:100%;object-fit:cover}
                    .history-thumbnail-more{display:flex;width:45px;height:45px;align-items:center;justify-content:center;border-radius:10px;background:#eaf7ef;color:#168553;font-size:12px;font-weight:800}
                    .history-product-copy{min-width:0}
                    .history-main-product{margin:0;color:#175d4d;font-size:13px;font-weight:850;overflow-wrap:anywhere}
                    .history-extra-products,.history-item-count{margin:3px 0 0;color:#63877e;font-size:11px}
                    .history-order-total{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:12px;border-left:1px solid #dcefe5;padding-left:22px}
                    .history-total-label{margin:0;color:#64877d;font-size:12px}
                    .history-total-value{margin:3px 0 0;color:#117750;font-size:19px;font-weight:900;white-space:nowrap}
                    .history-voucher{display:inline-block;margin:5px 0 0;border-radius:999px;background:#eaf8ef;padding:3px 8px;color:#13834e;font-size:9px;font-weight:750;line-height:1.45}
                    .history-view-order{display:inline-flex;min-height:35px;flex:none;align-items:center;justify-content:center;gap:7px;border:1px solid #27b977;border-radius:10px;background:#fff;padding:7px 10px;color:#118453;font-size:11px;font-weight:850;text-decoration:none;transition:background .15s,border-color .15s}
                    .history-view-order:hover{border-color:#139b60;background:#effbf4}
                    .history-loading,.history-empty,.history-error{border:1px solid #d9eee2;border-radius:18px;background:#fff;padding:42px 24px;text-align:center;box-shadow:0 8px 25px #173f3508}
                    .history-state-icon{display:flex;width:56px;height:56px;align-items:center;justify-content:center;margin:0 auto 13px;border-radius:50%;background:#e8f8ee;color:#158651}
                    .history-empty h2,.history-error h2{margin:0;color:#175d4d;font-size:19px;font-weight:850}
                    .history-empty p,.history-error p,.history-loading{color:#68887e;font-size:13px}
                    .history-browse,.history-load-more{display:inline-flex;min-height:39px;align-items:center;justify-content:center;gap:8px;margin-top:15px;border:1px solid #20ac70;border-radius:10px;background:#fff;padding:8px 15px;color:#128653;font-size:12px;font-weight:850;text-decoration:none;transition:background .15s}
                    .history-browse:hover,.history-load-more:hover{background:#effbf4}
                    .history-load-more{display:flex;margin:18px auto 0;cursor:pointer}
                    .history-page button:focus-visible,.history-page a:focus-visible{outline:3px solid #55c78b;outline-offset:3px}
                    @media(max-width:1120px){
                        .history-page{padding:20px 20px 40px}
                        .history-order-card{grid-template-columns:minmax(190px,.9fr) minmax(230px,1.25fr) minmax(190px,.85fr);gap:14px;padding:16px}
                        .history-order-total{padding-left:15px}
                        .history-thumbnails{gap:5px}
                        .history-thumbnail{width:46px;height:46px}
                        .history-order-icon{width:40px;height:40px}
                        .history-order-details{gap:10px}
                    }
                    @media(max-width:800px){
                        .history-heading{gap:15px;padding:7px 5px}
                        .history-heading-icon{width:62px;height:62px}
                        .history-heading-title{font-size:25px}
                        .history-list{padding:11px}
                        .history-order-card{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:13px;padding:15px}
                        .history-order-details{grid-column:1/-1}
                        .history-order-products{grid-column:1/-1}
                        .history-order-total{grid-column:1/-1;border-top:1px solid #e4f0e9;border-left:0;padding:12px 0 0}
                        .history-thumbnail{width:50px;height:50px}
                    }
                    @media(max-width:560px){
                        .history-page{padding:15px 13px 28px}
                        .history-back{width:38px;height:38px}
                        .history-heading{gap:12px;margin:11px 0 17px}
                        .history-heading-icon{width:52px;height:52px}
                        .history-heading-icon svg{width:25px;height:25px}
                        .history-heading-title{font-size:21px}
                        .history-heading-kicker{font-size:13px}
                        .history-heading-description{font-size:11px;line-height:1.45}
                        .history-list{gap:10px;border-radius:16px;padding:8px}
                        .history-order-card{grid-template-columns:minmax(0,1fr);gap:12px;border-radius:13px;padding:13px}
                        .history-order-details,.history-order-products,.history-order-total{grid-column:auto}
                        .history-order-details{align-items:center}
                        .history-order-copy h2{font-size:14px}
                        .history-order-products{gap:11px}
                        .history-thumbnails{max-width:100%;flex-wrap:wrap}
                        .history-thumbnail{width:48px;height:48px}
                        .history-order-total{align-items:center}
                        .history-total-value{font-size:18px}
                        .history-view-order{min-width:112px}
                    }
                `}</style>
                <div className="history-container">
                    <button
                        type="button"
                        className="history-back"
                        aria-label="Go back"
                        onClick={() => {
                            if (window.history.length > 1) window.history.back();
                            else window.location.assign('/customer/profile');
                        }}
                    >
                        <ArrowLeft size={19} aria-hidden="true" />
                    </button>

                    <section className="history-heading" aria-labelledby="history-title">
                        <span className="history-heading-icon"><FileText size={34} aria-hidden="true" /></span>
                        <div>
                            <h1 className="history-heading-title" id="history-title">A record of your finds</h1>
                            <p className="history-heading-kicker">Order history</p>
                            <p className="history-heading-description">Follow every order from confirmation to delivery.</p>
                        </div>
                    </section>

                    {isLoading ? (
                        <div className="history-loading" role="status">Loading your order history…</div>
                    ) : isError ? (
                        <section className="history-error" role="alert">
                            <span className="history-state-icon"><Package size={25} /></span>
                            <h2>We couldn’t load your orders</h2>
                            <p>{getApiErrorMessage(error, 'Please try again in a moment.')}</p>
                        </section>
                    ) : orders.length === 0 ? (
                        <section className="history-empty">
                            <span className="history-state-icon"><Package size={25} /></span>
                            <h2>No orders yet</h2>
                            <p>Your next favorite find is waiting in the marketplace.</p>
                            <Link href="/" className="history-browse">Browse products <ArrowRight size={15} /></Link>
                        </section>
                    ) : (
                        <>
                            <div className="history-list">
                                {orders.map((order) => <OrderCard key={order.id} order={order} />)}
                            </div>
                            {hasNextPage && (
                                <button
                                    type="button"
                                    className="history-load-more"
                                    disabled={isFetchingNextPage}
                                    onClick={() => void fetchNextPage()}
                                >
                                    {isFetchingNextPage ? 'Loading more orders…' : 'Load more orders'}
                                    {!isFetchingNextPage && <ArrowRight size={15} />}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
