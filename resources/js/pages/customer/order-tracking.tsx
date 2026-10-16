import { api, getApiErrorMessage, prepareSanctum } from '@/lib/api';
import { Head, Link } from '@inertiajs/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
    ArrowLeft,
    ArrowRight,
    Barcode,
    Bike,
    CalendarDays,
    Check,
    Clipboard,
    Copy,
    Download,
    FileText,
    Leaf,
    MapPin,
    Package,
    QrCode,
    Star,
    Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';

type OrderItem = {
    id: number;
    quantity: number;
    unit_price: string | number;
    total_price: string | number;
    fulfillment_status?: string;
    review?: { rating: number } | null;
    product?: {
        id?: number;
        name?: string;
        images?: { path: string; is_primary?: boolean }[];
        color?: string | null;
        size?: string | null;
    };
    variant?: { name?: string } | null;
};

function OrderItemProductCard({ item }: { item: OrderItem }) {
    const [rating, setRating] = useState(item.review?.rating ?? 0);
    const [savingRating, setSavingRating] = useState(false);
    const [ratingMessage, setRatingMessage] = useState('');
    const queryClient = useQueryClient();
    const canRate = item.fulfillment_status?.toLowerCase() === 'delivered';
    const image = item.product?.images?.find((productImage) => productImage.is_primary) || item.product?.images?.[0];
    const variant = item.variant?.name || [item.product?.color, item.product?.size].filter(Boolean).join(' / ') || 'Product variant';

    async function submitRating() {
        if (rating < 1 || savingRating) return;

        setSavingRating(true);
        setRatingMessage('');
        try {
            await prepareSanctum();
            await api.post(`/customer/order-items/${item.id}/review`, { rating });
            setRatingMessage('Thanks for rating this product!');
            await queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
        } catch (error) {
            setRatingMessage(getApiErrorMessage(error, 'Could not save your rating. Please try again.'));
        } finally {
            setSavingRating(false);
        }
    }

    return (
        <article className="tracking-product">
            <div className="tracking-product-image">
                {image ? (
                    <img
                        src={imageUrl(image.path) || undefined}
                        alt={item.product?.name || 'Product'}
                    />
                ) : (
                    <Package size={22} />
                )}
            </div>
            <div className="tracking-product-content">
                <div>
                    <h3 className="tracking-product-name">{item.product?.name || 'Product'}</h3>
                    <p className="tracking-product-variant">{variant}</p>
                    <p className="tracking-product-meta"><strong>{formatMoney(item.unit_price)}</strong> · Qty: {item.quantity}</p>
                    <div className="tracking-product-actions">
                    {item.product?.id && (
                        <Link
                            href={`/products/${item.product.id}`}
                            className="tracking-outline-button"
                        >
                            View product <ArrowRight size={13} />
                        </Link>
                    )}
                    </div>
                </div>
                <div className="tracking-rating">
                    <p className="tracking-rating-label">Rate this product</p>
                    <div className="tracking-stars" role="group" aria-label={`Rate ${item.product?.name || 'this product'} from 1 to 5 stars`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                            <button
                                key={value}
                                type="button"
                                disabled={!canRate || savingRating}
                                onClick={() => {
                                    setRating(value);
                                    setRatingMessage('');
                                }}
                                aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                                aria-pressed={rating === value}
                                className="tracking-star"
                            >
                                <Star size={17} fill={value <= rating ? 'currentColor' : 'none'} />
                            </button>
                        ))}
                        <span className="tracking-rating-score">{rating > 0 ? `${rating} / 5` : 'Not rated'}</span>
                    </div>
                    {canRate ? (
                        <button
                            type="button"
                            onClick={submitRating}
                            disabled={rating === 0 || savingRating}
                            className="tracking-outline-button tracking-rating-button"
                        >
                            <Star size={14} /> {savingRating ? 'Saving…' : item.review ? 'Update rating' : 'Submit rating'}
                        </button>
                    ) : (
                        <p className="tracking-muted">Rating is available after delivery.</p>
                    )}
                    {ratingMessage && <p className="tracking-feedback" role="status">{ratingMessage}</p>}
                </div>
            </div>
        </article>
    );
}

type CustomerOrder = {
    id: number;
    order_number: string;
    status?: string;
    created_at: string;
    total?: string | number;
    items?: OrderItem[];
};

type OrdersResponse = { data?: CustomerOrder[] };
type TimelineState = 'completed' | 'current' | 'pending';

type TimelineStage = {
    title: string;
    detail: string;
    state: TimelineState;
    note: string;
    timestamp?: string;
};

const stageTitles = ['Order Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

function imageUrl(path?: string) {
    return path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null;
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatMoney(value: string | number) {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function normalizedStatus(status?: string) {
    return status?.toLowerCase().replace(/[_-]/g, ' ').trim() || 'pending';
}

function statusLabel(status?: string) {
    const normalized = normalizedStatus(status);
    if (normalized === 'shipped') return 'In Transit';
    if (normalized === 'out for delivery') return 'Out for Delivery';
    if (normalized === 'completed') return 'Delivered';
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activeStageIndex(status?: string) {
    const normalized = normalizedStatus(status);
    if (normalized === 'delivered' || normalized === 'completed') return 4;
    if (normalized === 'out for delivery') return 3;
    if (normalized === 'shipped') return 2;
    if (normalized === 'processing' || normalized === 'accepted') return 1;
    if (normalized === 'pending') return 0;
    return -1;
}

function buildTimeline(order: CustomerOrder): TimelineStage[] {
    const activeIndex = activeStageIndex(order.status);
    const delivered = activeIndex === 4;

    return stageTitles.map((title, index) => {
        const state: TimelineState = index < activeIndex || (delivered && index === activeIndex)
            ? 'completed'
            : index === activeIndex
              ? 'current'
              : 'pending';
        const detail = index === 0
            ? 'Your order has been placed.'
            : state === 'completed'
              ? 'This order stage has been completed.'
              : state === 'current'
                ? 'Current status reported by the seller.'
                : 'This step has not been confirmed yet.';

        return {
            title,
            detail,
            state,
            note: state === 'current' ? 'In Progress' : state === 'completed' ? 'Completed' : 'Pending',
            ...(index === 0 ? { timestamp: formatDateTime(order.created_at) } : {}),
        };
    });
}

function Timeline({ order }: { order: CustomerOrder }) {
    const timeline = buildTimeline(order);
    const cancelled = normalizedStatus(order.status) === 'cancelled';

    return (
        <div className="tracking-timeline">
            {cancelled && (
                <p className="mb-5 rounded-2xl border border-[#f4d4ce] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#a94435]">
                    This order was cancelled. No further delivery progress is available.
                </p>
            )}
            <ol className="tracking-timeline-list">
                {timeline.map((stage, index) => (
                    <li key={stage.title} className={`tracking-stage tracking-stage-${stage.state}`}>
                        <div className="tracking-stage-marker">
                            <span className="tracking-stage-icon">
                                {stage.state === 'completed' ? <Check size={18} strokeWidth={3} /> : stage.state === 'current' ? <Bike size={18} /> : index + 1}
                            </span>
                        </div>
                        <div className="tracking-stage-content">
                            <div className="tracking-stage-title">
                                <h3>{stage.title}</h3>
                                <span>{cancelled ? 'Not completed' : stage.note}</span>
                            </div>
                            <p>{stage.detail}</p>
                            {stage.timestamp && <time dateTime={order.created_at}>{stage.timestamp}</time>}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function OrderTrackingQrCard({ order }: { order: CustomerOrder }) {
    const [trackingUrl, setTrackingUrl] = useState('');
    const [qrImage, setQrImage] = useState('');
    const [qrError, setQrError] = useState('');
    const [qrLoading, setQrLoading] = useState(true);
    const [copyMessage, setCopyMessage] = useState('');

    useEffect(() => {
        let cancelled = false;
        setQrLoading(true);
        setQrError('');
        setQrImage('');

        try {
            const url = new URL('/customer/order-tracking', window.location.origin);
            url.searchParams.set('order_id', String(order.id));
            setTrackingUrl(url.toString());
            QRCode.toDataURL(url.toString(), {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 320,
                color: { dark: '#145b52', light: '#ffffff' },
            }).then(
                (image) => {
                    if (cancelled) return;
                    setQrImage(image);
                    setQrLoading(false);
                },
                (error: unknown) => {
                    if (cancelled) return;
                    setQrError(getApiErrorMessage(error, 'The tracking QR code could not be generated.'));
                    setQrLoading(false);
                },
            );
        } catch (error) {
            if (!cancelled) {
                setQrError(getApiErrorMessage(error, 'The tracking QR code could not be generated.'));
                setQrLoading(false);
            }
        }

        return () => {
            cancelled = true;
        };
    }, [order.id]);

    async function copyTrackingUrl() {
        try {
            await navigator.clipboard.writeText(trackingUrl);
            setCopyMessage('Tracking link copied.');
        } catch {
            setCopyMessage('Could not copy the tracking link. Copy it from your browser address bar.');
        }
    }

    return (
        <section className="tracking-panel tracking-qr-panel">
            <div className="tracking-panel-heading">
                <span className="tracking-icon-bubble"><QrCode size={21} /></span>
                <div>
                    <h2>Order Tracking QR Code</h2>
                    <p>Scan to open this order’s tracking page.</p>
                </div>
            </div>
            <div className="tracking-qr-content">
                <div className="tracking-qr-image" aria-live="polite">
                    {qrLoading ? (
                        <span className="tracking-muted">Generating QR code…</span>
                    ) : qrError ? (
                        <span className="tracking-error">{qrError}</span>
                    ) : (
                        <img src={qrImage} alt="QR code linking to this order's authenticated tracking page" />
                    )}
                </div>
                <div className="tracking-qr-actions">
                    <p className="tracking-reference">{order.order_number}</p>
                    <p className="tracking-muted">The tracking page requires customer sign-in.</p>
                    <div className="tracking-action-row">
                        {qrImage && (
                            <a
                                href={qrImage}
                                download={`order-${order.order_number}-tracking-qr.png`}
                                className="tracking-outline-button"
                            >
                                <Download size={15} /> Download QR Code
                            </a>
                        )}
                        <button type="button" onClick={copyTrackingUrl} disabled={!trackingUrl} className="tracking-outline-button">
                            <Copy size={15} /> Copy Tracking Link
                        </button>
                    </div>
                    {copyMessage && <p className="tracking-feedback" role="status">{copyMessage}</p>}
                </div>
            </div>
        </section>
    );
}

function OrderSummary({ order }: { order: CustomerOrder }) {
    const normalized = normalizedStatus(order.status);

    return (
        <section className="tracking-panel">
            <div className="tracking-panel-heading">
                <span className="tracking-icon-bubble"><FileText size={21} /></span>
                <div>
                    <h2>Order Summary</h2>
                    <p>Details for this purchase</p>
                </div>
            </div>
            <dl className="tracking-summary-list">
                <div><dt>Order #</dt><dd>{order.order_number}</dd></div>
                <div><dt>Placed on</dt><dd>{formatDate(order.created_at)}</dd></div>
                <div><dt>Status</dt><dd><span className={`tracking-status tracking-status-${normalized.replace(/\s+/g, '-')}`}><Truck size={14} /> {statusLabel(order.status)}</span></dd></div>
                <div><dt>Total Amount</dt><dd>{order.total == null ? 'Not available' : formatMoney(order.total)}</dd></div>
            </dl>
        </section>
    );
}

function TrackingReferenceCard({ order }: { order: CustomerOrder }) {
    const [copyMessage, setCopyMessage] = useState('');

    async function copyOrderReference() {
        try {
            await navigator.clipboard.writeText(order.order_number);
            setCopyMessage('Order reference copied.');
        } catch {
            setCopyMessage('Could not copy the order reference.');
        }
    }

    return (
        <section className="tracking-panel">
            <div className="tracking-tracking-number">
                <div className="tracking-panel-heading tracking-heading-compact">
                    <span className="tracking-icon-bubble"><Barcode size={20} /></span>
                    <div>
                        <h2>Tracking Number</h2>
                        <p className="tracking-reference">{order.order_number}</p>
                    </div>
                </div>
                <button type="button" onClick={copyOrderReference} className="tracking-outline-button">
                    <Clipboard size={14} /> Copy
                </button>
            </div>
            <p className="tracking-information">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>No courier tracking number is available yet. Updates depend on the seller and delivery partner.</span>
            </p>
            {copyMessage && <p className="tracking-feedback" role="status">{copyMessage}</p>}
        </section>
    );
}

function OrderStatusMessage({ status }: { status?: string }) {
    const normalized = normalizedStatus(status);
    const isDelivered = normalized === 'delivered' || normalized === 'completed';
    const isCancelled = normalized === 'cancelled';
    const isInTransit = normalized === 'shipped' || normalized === 'out for delivery';
    const isPreparing = normalized === 'pending' || normalized === 'processing' || normalized === 'accepted';
    const isDelayed = normalized === 'delayed';
    const title = isDelivered
        ? 'Your order has been delivered.'
        : isCancelled
          ? 'This order was cancelled.'
          : isDelayed
            ? 'Your order is delayed.'
            : isPreparing
              ? 'Your order is being prepared.'
              : isInTransit
                ? 'Your order is on its way!'
                : 'Order status update';
    const message = isDelivered
        ? 'We hope you enjoy your purchase. Thank you for shopping with BSAB-SHOP.'
        : isCancelled
          ? 'Please visit your order history if you need help with this order.'
          : isDelayed
            ? 'The latest order status indicates a delay. Please check back for updates from the seller.'
            : isPreparing
            ? 'Your order is being prepared. We’ll share more updates as the seller and delivery partner confirm them.'
            : isInTransit
              ? 'We appreciate your patience. Updates depend on the seller and delivery partner. You’ll be notified when the order arrives.'
              : 'More delivery information will appear here when the seller updates your order.';

    return (
        <section className={`tracking-status-message${isCancelled ? ' tracking-status-message-cancelled' : ''}`}>
            <span className="tracking-completion-icon">{isCancelled ? <Package size={22} /> : <Leaf size={23} />}</span>
            <div>
                <h2>{title}</h2>
                <p>{message}</p>
            </div>
            {!isCancelled && <Truck className="tracking-message-truck" size={30} />}
        </section>
    );
}

export default function CustomerOrderTracking() {
    const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const orderId = query.get('order_id');
    const selectedItemId = Number(query.get('selected_item_ids[]') || query.get('selected_item_ids[0]')) || null;
    const { data, isLoading, isError, error } = useQuery<CustomerOrder | OrdersResponse>({
        queryKey: ['customer-orders', orderId, selectedItemId],
        queryFn: async () => {
            if (orderId) {
                return (await api.get<CustomerOrder>(`/customer/orders/${encodeURIComponent(orderId)}`)).data;
            }
            return (await api.get<OrdersResponse>('/customer/orders')).data;
        },
    });
    const order = data
        ? 'order_number' in data
            ? data
            : selectedItemId
              ? data.data?.find((candidate) => candidate.items?.some((orderItem) => orderItem.id === selectedItemId))
              : data.data?.[0]
        : undefined;

    return (
        <>
            <Head title="Order Tracking" />
            <main className="tracking-page">
                <style>{`
                    .tracking-page{min-height:100vh;background:#f3faf6;color:#145b52;padding:28px 24px 48px;overflow:hidden}
                    .tracking-container{width:min(100%,1440px);margin:0 auto;position:relative}
                    .tracking-header{display:flex;align-items:center;gap:14px;margin:0 0 22px}
                    .tracking-back{display:flex;width:42px;height:42px;flex:none;align-items:center;justify-content:center;border:1px solid #dcefe6;border-radius:14px;background:#fff;color:#147b6d;box-shadow:0 5px 14px #20785b14;transition:background .15s,transform .15s}
                    .tracking-back:hover{background:#e8f8ef;transform:translateX(-2px)}
                    .tracking-eyebrow{margin:0;color:#20a866;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
                    .tracking-page-title{margin:3px 0 0;color:#0b5b55;font-size:28px;line-height:1.15;font-weight:800}
                    .tracking-subtitle{margin:5px 0 0;color:#72938b;font-size:13px}
                    .tracking-layout{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(300px,.9fr);align-items:start;gap:18px}
                    .tracking-main,.tracking-sidebar{display:grid;min-width:0;gap:16px}
                    .tracking-panel{min-width:0;border:1px solid #dcefe5;border-radius:20px;background:#fff;padding:20px;box-shadow:0 8px 25px #20785b0d}
                    .tracking-panel-heading{display:flex;align-items:center;gap:12px;margin-bottom:16px}
                    .tracking-panel-heading h2{margin:0;color:#145b52;font-size:16px;font-weight:800}
                    .tracking-panel-heading p{margin:3px 0 0;color:#78988f;font-size:12px}
                    .tracking-icon-bubble{display:flex;width:40px;height:40px;flex:none;align-items:center;justify-content:center;border:1px solid #c9edd8;border-radius:50%;background:#eaf9f0;color:#159b60}
                    .tracking-order-head{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #e7f2ed;padding-bottom:16px}
                    .tracking-order-label{margin:0;color:#74958c;font-size:11px;font-weight:700}
                    .tracking-order-number{margin:3px 0;color:#145b52;font-size:22px;font-weight:850;letter-spacing:.01em;overflow-wrap:anywhere}
                    .tracking-order-date{margin:4px 0 0;color:#76958e;font-size:12px}
                    .tracking-status{display:inline-flex;align-items:center;gap:7px;border:1px solid #bce8cf;border-radius:999px;background:#e9f9ef;padding:8px 14px;color:#138a55;font-size:12px;font-weight:800;white-space:nowrap}
                    .tracking-status-cancelled{border-color:#f0c9c1;background:#fff2ee;color:#a94435}
                    .tracking-timeline{padding-top:18px}
                    .tracking-timeline-list{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}
                    .tracking-stage{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr);gap:12px;min-height:88px}
                    .tracking-stage-marker{position:relative;display:flex;justify-content:center}
                    .tracking-stage:not(:last-child) .tracking-stage-marker:after{position:absolute;top:38px;bottom:-2px;left:18px;width:2px;background:#d9ebe5;content:""}
                    .tracking-stage-completed:not(:last-child) .tracking-stage-marker:after{background:#20a866}
                    .tracking-stage-icon{position:relative;z-index:1;display:flex;width:38px;height:38px;align-items:center;justify-content:center;border:2px solid #d8ebe3;border-radius:50%;background:#f1f8f4;color:#83a49c;font-size:13px;font-weight:800}
                    .tracking-stage-completed .tracking-stage-icon{border-color:#abe2c1;background:#e5f8ed;color:#118751}
                    .tracking-stage-current .tracking-stage-icon{border-color:#8fdcb1;background:#dff7e9;color:#078c53;box-shadow:0 0 0 4px #effbf4}
                    .tracking-stage-content{min-width:0;padding:0 0 19px}
                    .tracking-stage-title{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
                    .tracking-stage-title h3{margin:0;color:#23584d;font-size:14px;font-weight:800}
                    .tracking-stage-completed .tracking-stage-title h3{color:#145b52}
                    .tracking-stage-current .tracking-stage-title h3{color:#078c53}
                    .tracking-stage-title span{border-radius:999px;background:#edf5f2;padding:3px 8px;color:#83a49c;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
                    .tracking-stage-completed .tracking-stage-title span{background:#e4f8ed;color:#14935c}
                    .tracking-stage-current .tracking-stage-title span{background:#c9f1da;color:#078c53}
                    .tracking-stage-content p{margin:4px 0 0;color:#76958e;font-size:11px;line-height:1.5}
                    .tracking-stage-content time{display:block;margin-top:5px;color:#6a8b83;font-size:10px}
                    .tracking-product-list{display:grid;gap:12px}
                    .tracking-product{display:grid;grid-template-columns:76px minmax(0,1fr);gap:14px;border:1px solid #e2f0e8;border-radius:15px;background:#fff;padding:12px}
                    .tracking-product-image{display:flex;width:76px;height:76px;align-items:center;justify-content:center;overflow:hidden;border-radius:12px;background:#edf7f1;color:#6f9d95}
                    .tracking-product-image img{width:100%;height:100%;object-fit:cover}
                    .tracking-product-content{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,.75fr);align-items:center;gap:14px;min-width:0}
                    .tracking-product-name{margin:0;color:#145b52;font-size:14px;font-weight:800}
                    .tracking-product-variant,.tracking-product-meta{margin:4px 0 0;color:#719188;font-size:11px}
                    .tracking-product-meta strong{color:#228254;font-weight:800}
                    .tracking-product-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:9px}
                    .tracking-outline-button{display:inline-flex;min-height:34px;align-items:center;justify-content:center;gap:6px;border:1px solid #40bd83;border-radius:9px;background:#fff;padding:7px 11px;color:#128650;font-size:11px;font-weight:800;text-decoration:none;transition:background .15s,border-color .15s}
                    .tracking-outline-button:hover{background:#effbf4;border-color:#159b60}
                    .tracking-outline-button:disabled{cursor:not-allowed;opacity:.55}
                    .tracking-rating{border-left:1px solid #e5f0e9;padding-left:14px}
                    .tracking-rating-label{margin:0;color:#608277;font-size:10px;font-weight:700}
                    .tracking-stars{display:flex;align-items:center;gap:1px;margin-top:5px}
                    .tracking-star{display:flex;width:26px;height:27px;align-items:center;justify-content:center;border-radius:5px;color:#b8c8c3;transition:color .12s,transform .12s}
                    .tracking-star[aria-pressed=true]{color:#119c66}
                    .tracking-star:not(:disabled):hover{transform:scale(1.12);color:#119c66}
                    .tracking-star:disabled{cursor:default}
                    .tracking-rating-score{margin-left:5px;color:#66877f;font-size:11px;white-space:nowrap}
                    .tracking-rating-button{margin-top:6px}
                    .tracking-muted{color:#78988f;font-size:11px;line-height:1.5}
                    .tracking-error{color:#a94435;font-size:11px;line-height:1.5}
                    .tracking-feedback{margin:7px 0 0;color:#138a55;font-size:11px;font-weight:700}
                    .tracking-qr-content{display:grid;grid-template-columns:126px minmax(0,1fr);align-items:center;gap:14px}
                    .tracking-qr-image{display:flex;min-height:126px;align-items:center;justify-content:center;border:1px solid #c6ebd4;border-radius:13px;background:#fff;padding:8px;text-align:center}
                    .tracking-qr-image img{display:block;width:100%;max-width:120px;height:auto;image-rendering:pixelated}
                    .tracking-reference{margin:0 0 5px;color:#145b52;font-size:14px;font-weight:850;overflow-wrap:anywhere}
                    .tracking-qr-actions{min-width:0}
                    .tracking-action-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
                    .tracking-estimate-value{margin:2px 0 0;color:#145b52;font-size:17px;font-weight:850}
                    .tracking-tracking-number{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
                    .tracking-heading-compact{margin:0}
                    .tracking-tracking-number p{margin:0}
                    .tracking-information{display:flex;gap:9px;border-top:1px solid #e7f2ed;margin-top:13px;padding-top:12px;color:#678980;font-size:11px;line-height:1.55}
                    .tracking-status-message{display:flex;align-items:center;gap:13px;border:1px solid #bfe9d0;border-radius:17px;background:#effcf5;padding:17px;color:#139b60}
                    .tracking-status-message h2{margin:0;color:#138751;font-size:13px;font-weight:850}
                    .tracking-status-message p{margin:4px 0 0;color:#6c9185;font-size:11px;line-height:1.5}
                    .tracking-completion-icon{display:flex;width:42px;height:42px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:#159b60;color:#fff}
                    .tracking-message-truck{margin-left:auto;flex:none}
                    .tracking-status-message-cancelled{border-color:#f0c9c1;background:#fff5f2;color:#a94435}
                    .tracking-status-message-cancelled .tracking-completion-icon{background:#a94435}
                    .tracking-status-message-cancelled h2{color:#a94435}
                    .tracking-summary-list{margin:0}
                    .tracking-summary-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #edf3ef;padding:9px 0}
                    .tracking-summary-list dt{color:#72938b;font-size:11px}
                    .tracking-summary-list dd{margin:0;color:#145b52;font-size:11px;font-weight:750;text-align:right;overflow-wrap:anywhere}
                    .tracking-summary-list .tracking-status{padding:5px 9px;font-size:10px}
                    .tracking-error-panel{border-color:#f0c9c1;background:#fff5f2;color:#a94435}
                    .tracking-page button:focus-visible,.tracking-page a:focus-visible{outline:3px solid #54c58b;outline-offset:3px}
                    @media(min-width:1000px){
                        .tracking-timeline-list{flex-direction:row}
                        .tracking-stage{display:flex;flex:1;flex-direction:column;gap:10px;min-height:0;padding-right:8px}
                        .tracking-stage-marker{height:39px;justify-content:flex-start}
                        .tracking-stage:not(:last-child) .tracking-stage-marker:after{top:18px;right:-8px;bottom:auto;left:38px;width:auto;height:2px}
                        .tracking-stage-content{padding:0}
                        .tracking-stage-title{display:block}
                        .tracking-stage-title span{display:inline-block;margin-top:5px}
                        .tracking-stage-content p{max-width:145px}
                    }
                    @media(max-width:1100px){
                        .tracking-page{padding:22px 18px 36px}
                        .tracking-layout{grid-template-columns:minmax(0,1.45fr) minmax(280px,.9fr);gap:14px}
                        .tracking-panel{padding:17px}
                        .tracking-product-content{grid-template-columns:minmax(0,1fr)}
                        .tracking-rating{border-top:1px solid #e5f0e9;border-left:0;padding:10px 0 0}
                    }
                    @media(max-width:820px){
                        .tracking-layout{grid-template-columns:minmax(0,1fr)}
                        .tracking-sidebar{grid-template-columns:repeat(2,minmax(0,1fr))}
                        .tracking-qr-panel,.tracking-status-message,.tracking-summary-panel{grid-column:1/-1}
                    }
                    @media(max-width:640px){
                        .tracking-page{padding:18px 14px 30px}
                        .tracking-header{gap:11px;margin-bottom:17px}
                        .tracking-page-title{font-size:24px}
                        .tracking-subtitle{font-size:12px}
                        .tracking-layout{gap:14px}
                        .tracking-main,.tracking-sidebar{gap:13px}
                        .tracking-sidebar{grid-template-columns:minmax(0,1fr)}
                        .tracking-panel{border-radius:18px;padding:15px}
                        .tracking-order-head{align-items:flex-start;flex-direction:column;gap:12px}
                        .tracking-order-number{font-size:19px}
                        .tracking-timeline-list{flex-direction:column}
                        .tracking-stage{display:grid;grid-template-columns:38px minmax(0,1fr);flex:none;gap:12px;min-height:88px;padding:0}
                        .tracking-stage-marker{height:auto;justify-content:center}
                        .tracking-stage:not(:last-child) .tracking-stage-marker:after{top:38px;right:auto;bottom:-2px;left:18px;width:2px;height:auto}
                        .tracking-stage-content{padding:0 0 19px}
                        .tracking-stage-title{display:flex}
                        .tracking-stage-title span{display:inline-block;margin:0}
                        .tracking-stage-content p{max-width:none}
                        .tracking-product{grid-template-columns:64px minmax(0,1fr);gap:10px;padding:10px}
                        .tracking-product-image{width:64px;height:64px}
                        .tracking-product-content{grid-template-columns:minmax(0,1fr);gap:10px}
                        .tracking-rating{padding-top:9px}
                        .tracking-qr-content{grid-template-columns:108px minmax(0,1fr);gap:12px}
                        .tracking-qr-image{min-height:108px}
                        .tracking-action-row{flex-direction:column;align-items:stretch}
                        .tracking-action-row .tracking-outline-button{width:100%}
                    }
                    @media(max-width:390px){
                        .tracking-qr-content{grid-template-columns:1fr}
                        .tracking-qr-image{min-height:150px}
                        .tracking-qr-image img{max-width:142px}
                    }
                `}</style>
                <div className="tracking-container">
                    <header className="tracking-header">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            aria-label="Back to orders"
                            className="tracking-back"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <p className="tracking-eyebrow">Delivery updates</p>
                            <h1 className="tracking-page-title">Order Tracking</h1>
                            <p className="tracking-subtitle">Track your order status and delivery progress.</p>
                        </div>
                    </header>

                    {isLoading ? (
                        <section className="tracking-panel text-center">
                            Loading order tracking...
                        </section>
                    ) : isError ? (
                        <section className="tracking-panel tracking-error-panel" role="alert">
                            {getApiErrorMessage(error, 'Could not load this order. Please try again.')}
                        </section>
                    ) : !order ? (
                        <section className="tracking-panel text-center">
                            <Package className="mx-auto mb-3 text-[#159b60]" />
                            <h2 className="m-0 text-lg font-bold text-[#145b52]">No order found</h2>
                            <p className="tracking-muted">Choose an order from your order history to view its tracking details.</p>
                            <Link href="/customer/orders" className="tracking-outline-button mt-4">
                                View your orders <ArrowRight size={15} />
                            </Link>
                        </section>
                    ) : (
                        <>
                            <div className="tracking-layout">
                                <div className="tracking-main">
                                    <section className="tracking-panel">
                                        <div className="tracking-panel-heading">
                                            <span className="tracking-icon-bubble"><Truck size={21} /></span>
                                            <div>
                                                <h2>Delivery updates</h2>
                                                <p>Order progress reported by the seller</p>
                                            </div>
                                        </div>
                                        <div className="tracking-order-head">
                                            <div>
                                                <p className="tracking-order-label">Order Number</p>
                                                <p className="tracking-order-number">{order.order_number}</p>
                                                <p className="tracking-order-date">Placed on {formatDate(order.created_at)}</p>
                                            </div>
                                            <span className={`tracking-status tracking-status-${normalizedStatus(order.status).replace(/\s+/g, '-')}`}>
                                                <Truck size={16} /> {statusLabel(order.status)}
                                            </span>
                                        </div>
                                        <Timeline order={order} />
                                    </section>

                                    <section className="tracking-panel">
                                        <div className="tracking-panel-heading">
                                            <span className="tracking-icon-bubble"><Package size={21} /></span>
                                            <div>
                                                <h2>Order Items</h2>
                                                <p>Products in this order</p>
                                            </div>
                                        </div>
                                        {order.items?.length ? (
                                            <div className="tracking-product-list">
                                                {order.items.map((orderItem) => (
                                                    <OrderItemProductCard key={orderItem.id} item={orderItem} />
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="tracking-muted">No product items are available for this order.</p>
                                        )}
                                    </section>
                                </div>

                                <aside className="tracking-sidebar">
                                    <div className="tracking-qr-panel"><OrderTrackingQrCard order={order} /></div>
                                    <section className="tracking-panel">
                                        <div className="tracking-panel-heading">
                                            <span className="tracking-icon-bubble"><CalendarDays size={20} /></span>
                                            <div>
                                                <h2>Estimated Delivery</h2>
                                                <p className="tracking-estimate-value">Not yet provided</p>
                                            </div>
                                        </div>
                                        <p className="tracking-muted">An estimated delivery date has not yet been provided for this order.</p>
                                        <p className="tracking-muted">Delivery timing depends on your location and delivery partner.</p>
                                    </section>
                                    <TrackingReferenceCard order={order} />
                                    <OrderStatusMessage status={order.status} />
                                    <div className="tracking-summary-panel"><OrderSummary order={order} /></div>
                                </aside>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
