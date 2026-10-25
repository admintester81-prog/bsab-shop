import { PortalLayout } from '@/components/portal-layout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    BadgeCheck,
    Bike,
    Camera,
    Check,
    CheckCircle2,
    Clock3,
    MapPin,
    Package,
    Search,
    ShieldCheck,
    Truck,
    UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Role = 'admin' | 'seller' | 'rider' | 'customer';
type DeliveryStatus = 'ready' | 'in_transit' | 'arrived' | 'delivered' | 'completed' | 'failed';
type DeliveryItem = { name: string; shop?: string | null; quantity: number; total: number | string; image: string | null };
type DeliveryEvent = { id: number; status: string; note?: string | null; actor?: string | null; at?: string | null; proof_url?: string | null };
type Delivery = {
    id: number;
    status: DeliveryStatus;
    failure_reason?: string | null;
    assigned_at?: string | null;
    started_at?: string | null;
    arrived_at?: string | null;
    submitted_at?: string | null;
    confirmed_at?: string | null;
    failed_at?: string | null;
    proof_url?: string | null;
    rider?: { id: number; name: string; phone?: string | null } | null;
    order: {
        id: number;
        number: string;
        total?: number | string | null;
        address?: string | null;
        instructions?: string | null;
        eta?: string | null;
        customer?: { name: string; phone?: string | null } | null;
        items: DeliveryItem[];
    };
    events: DeliveryEvent[];
};
type ReadyOrder = {
    id: number;
    number: string;
    customer: string;
    address: string;
    instructions?: string | null;
    items: { name: string; quantity: number }[];
};
type SellerOrder = {
    id: number;
    delivery_id: number | null;
    order_number: string;
    product: string;
    image: string | null;
    quantity: number;
    total: string | number;
    customer: string;
    status: 'processing' | 'in_transit' | 'arrived' | 'delivered' | 'failed';
    rider: string | null;
    proof_url: string | null;
    updated_at: string | null;
};
type Props = {
    role: Role;
    shopName?: string | null;
    deliveries: Delivery[];
    readyOrders: ReadyOrder[];
    riders: { id: number; name: string }[];
    sellerOrders: SellerOrder[];
    stats: { total: number; in_transit: number; delivered: number; failed: number };
};
type Filter = 'all' | 'in_transit' | 'delivered' | 'failed';

const statusNames: Record<DeliveryStatus, string> = {
    ready: 'Ready for delivery',
    in_transit: 'In transit',
    arrived: 'Arrived',
    delivered: 'Awaiting confirmation',
    completed: 'Completed',
    failed: 'Failed delivery',
};

function money(value?: number | string | null) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value ?? 0));
}

function when(value?: string | null) {
    if (!value) return 'Not yet recorded';
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function tone(status: string) {
    if (status === 'completed' || status === 'delivered') return 'bg-[#e6f5eb] text-[#1c7a42]';
    if (status === 'in_transit') return 'bg-[#e8f2fb] text-[#347baa]';
    if (status === 'arrived') return 'bg-[#f0edff] text-[#6757a1]';
    if (status === 'failed') return 'bg-[#fff0ed] text-[#b6483e]';
    return 'bg-[#fff5df] text-[#94650d]';
}

function imageUrl(path?: string | null) {
    if (!path) return null;
    return path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`;
}

function Badge({ status }: { status: string }) {
    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone(status)}`}>{statusNames[status as DeliveryStatus] ?? status}</span>;
}

function Stat({ label, value, note, Icon }: { label: string; value: number; note: string; Icon: typeof Truck }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e0ebe3] bg-white p-4 shadow-[0_6px_22px_rgba(31,70,48,0.04)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf6ee] text-[#24854c]"><Icon size={19} /></span>
            <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#75877b]">{label}</p>
                <p className="mt-0.5 text-2xl font-bold leading-none text-[#173f2a]">{value}</p>
                <p className="mt-1 truncate text-[10px] text-[#9aa79e]">{note}</p>
            </div>
        </div>
    );
}

function DetailPanel({ role, delivery }: { role: Role; delivery: Delivery }) {
    const proofForm = useForm<{ proof: File | null }>({ proof: null });
    const [preview, setPreview] = useState<string | null>(null);
    const [failureReason, setFailureReason] = useState('');
    const [error, setError] = useState('');
    const [working, setWorking] = useState(false);

    useEffect(() => {
        if (!proofForm.data.proof) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(proofForm.data.proof);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [proofForm.data.proof]);

    function post(url: string, payload: Record<string, string> = {}) {
        setError('');
        setWorking(true);
        router.post(url, payload, {
            onError: (errors) => setError(Object.values(errors)[0] ?? 'The update could not be saved. Please try again.'),
            onFinish: () => setWorking(false),
        });
    }

    function submitProof(event: FormEvent) {
        event.preventDefault();
        if (!proofForm.data.proof) {
            proofForm.setError('proof', 'Take or choose a delivery photo before submitting.');
            return;
        }
        proofForm.post(`/delivery-list/${delivery.id}/submit`, {
            forceFormData: true,
            onError: (errors) => setError(Object.values(errors)[0] ?? 'The photo could not be submitted. Please try again.'),
        });
    }

    const isRider = role === 'rider';
    const isCustomer = role === 'customer';

    return (
        <section className="mt-4 rounded-2xl border border-[#dcebe0] bg-white p-4 shadow-[0_8px_26px_rgba(31,70,48,0.055)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2ee] pb-4">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[0.15em] text-[#8b9c90] uppercase">Order {delivery.order.number}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#193e2a] sm:text-xl">Delivery details</h2>
                </div>
                <Badge status={delivery.status} />
            </div>

            {delivery.status === 'completed' && isCustomer && (
                <div className="my-4 flex items-start gap-3 rounded-xl border border-[#cfead7] bg-[#f0faf3] p-4 text-[#216c3d]">
                    <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
                    <div><h3 className="font-bold">Order completed</h3><p className="mt-1 text-sm">Thanks for confirming receipt. Your order is now complete.</p></div>
                </div>
            )}
            {delivery.status === 'failed' && (
                <div className="my-4 flex items-start gap-3 rounded-xl border border-[#f4d5d0] bg-[#fff7f5] p-4 text-[#a3453b]">
                    <AlertCircle className="mt-0.5 shrink-0" size={20} />
                    <div><h3 className="font-semibold">Delivery needs attention</h3><p className="mt-1 text-sm">{delivery.failure_reason || 'The delivery was not completed.'}</p></div>
                </div>
            )}

            <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div className="min-w-0 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-[#f7faf7] p-3.5">
                            <p className="flex items-center gap-2 text-xs font-semibold text-[#607368]"><UserRound size={15} /> Customer</p>
                            <p className="mt-2 font-semibold text-[#203b2a]">{delivery.order.customer?.name ?? 'Customer'}</p>
                            {delivery.order.customer?.phone && <p className="mt-1 text-xs text-[#75867b]">{delivery.order.customer.phone}</p>}
                        </div>
                        <div className="rounded-xl bg-[#f7faf7] p-3.5">
                            <p className="flex items-center gap-2 text-xs font-semibold text-[#607368]"><MapPin size={15} /> Delivery destination</p>
                            <p className="mt-2 break-words text-sm leading-relaxed text-[#31493a]">{delivery.order.address || 'Address available to the assigned rider.'}</p>
                        </div>
                    </div>
                    {delivery.order.instructions && (
                        <div className="rounded-xl border border-[#f0e5c9] bg-[#fffbf1] p-3.5">
                            <p className="text-xs font-semibold text-[#80621e]">Delivery instructions</p>
                            <p className="mt-1.5 break-words text-sm leading-relaxed text-[#6e5d38]">{delivery.order.instructions}</p>
                        </div>
                    )}
                    <div className="rounded-xl border border-[#edf2ee] p-3.5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-[#263e2f]"><Package size={16} /> Items in this order</h3>
                            {delivery.order.total != null && <span className="text-sm font-bold text-[#226e3d]">{money(delivery.order.total)}</span>}
                        </div>
                        <div className="space-y-3">
                            {delivery.order.items.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#edf5ef]">
                                        {imageUrl(item.image) ? <img src={imageUrl(item.image)!} alt="" className="h-full w-full object-cover" /> : <Package size={18} className="text-[#7b9b84]" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[#294333]">{item.name}</p>
                                        <p className="mt-0.5 text-xs text-[#829087]">{item.shop ? `${item.shop} · ` : ''}Qty {item.quantity}</p>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-[#52685a]">{money(item.total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {delivery.rider && (
                        <div className="flex items-center gap-3 rounded-xl border border-[#e5eee7] p-3.5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e7f5eb] text-[#27844d]"><Bike size={19} /></span>
                            <div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-[#839187]">Assigned rider</p><p className="truncate text-sm font-semibold text-[#294333]">{delivery.rider.name}</p></div>
                            {delivery.rider.phone && <a href={`tel:${delivery.rider.phone}`} className="rounded-lg border border-[#cfe4d4] px-3 py-2 text-xs font-semibold text-[#287b46] hover:bg-[#f0f8f2]">Call rider</a>}
                        </div>
                    )}
                    {delivery.proof_url && (
                        <figure className="overflow-hidden rounded-xl border border-[#e0e9e2] bg-[#f7faf7]">
                            <img src={delivery.proof_url} alt={`Delivery photo for order ${delivery.order.number}`} className="max-h-80 w-full object-contain" />
                            <figcaption className="border-t border-[#e0e9e2] px-3.5 py-2 text-xs text-[#718176]">Delivery photo · {when(delivery.submitted_at)}</figcaption>
                        </figure>
                    )}
                    {delivery.failure_reason && <p className="rounded-lg bg-[#fff7f5] p-3 text-sm text-[#a3453b]">{delivery.failure_reason}</p>}
                </div>

                <aside className="min-w-0 space-y-4">
                    <div className="overflow-hidden rounded-xl border border-[#e2ece4]">
                        <div className="flex items-center gap-2 border-b border-[#e7efe9] bg-[#f7faf7] px-4 py-3">
                            <Truck size={16} className="text-[#30834b]" />
                            <h3 className="text-sm font-bold text-[#294333]">Route & progress</h3>
                        </div>
                        <div className="p-4">
                            <div className="mb-4 rounded-xl bg-[#edf7ef] p-4">
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2a874d] shadow-sm"><MapPin size={16} /></span>
                                    <div className="min-w-0"><p className="text-[10px] font-bold tracking-wide text-[#688171] uppercase">Destination</p><p className="mt-1 break-words text-sm font-semibold leading-relaxed text-[#274a32]">{delivery.order.address || 'Address unavailable'}</p></div>
                                </div>
                                {delivery.order.eta && <p className="mt-3 border-t border-[#d8ebdc] pt-2.5 text-xs text-[#53715b]"><span className="font-semibold">Estimated delivery:</span> {delivery.order.eta}</p>}
                            </div>
                            <ol className="space-y-0">
                                {[
                                    ['ready', 'Rider assigned', delivery.assigned_at],
                                    ['in_transit', 'In transit', delivery.started_at],
                                    ['arrived', 'Arrived at destination', delivery.arrived_at],
                                    ['delivered', 'Photo submitted', delivery.submitted_at],
                                    ['completed', 'Receipt confirmed', delivery.confirmed_at],
                                ].map(([key, label, date], index) => {
                                    const event = delivery.events.find((entry) => entry.status === key);
                                    const isComplete = Boolean(date);
                                    return (
                                        <li key={key} className="relative flex gap-3 pb-4 last:pb-0">
                                            {index < 4 && <span className={`absolute top-6 left-[11px] h-[calc(100%-12px)] w-px ${isComplete ? 'bg-[#5da979]' : 'bg-[#e2eae4]'}`} />}
                                            <span className={`relative z-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isComplete ? 'bg-[#24884d] text-white' : 'border border-[#d8e3db] bg-white text-[#a1afa5]'}`}>
                                                {isComplete ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                            </span>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <p className={`text-xs font-semibold ${isComplete ? 'text-[#2e5039]' : 'text-[#89968d]'}`}>{label}</p>
                                                <p className="mt-0.5 text-[10px] text-[#94a098]">{isComplete ? when(date) : 'Pending'}{event?.actor ? ` · ${event.actor}` : ''}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                            {delivery.events.length > 0 && (
                                <div className="mt-4 border-t border-[#edf2ee] pt-3">
                                    <h4 className="mb-2 text-[10px] font-bold tracking-wide text-[#788a7d] uppercase">Activity history</h4>
                                    <ul className="space-y-2.5">
                                        {delivery.events.slice(0, 6).map((event) => (
                                            <li key={event.id} className="flex min-w-0 items-start gap-2.5">
                                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#66a77a]" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-semibold text-[#405b47]">{event.note || statusNames[event.status as DeliveryStatus] || event.status}</p>
                                                    <p className="mt-0.5 text-[10px] text-[#94a098]">{when(event.at)}{event.actor ? ` · ${event.actor}` : ''}</p>
                                                </div>
                                                {event.proof_url && <a href={event.proof_url} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-semibold text-[#287b46] underline">View photo</a>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {isRider && delivery.status === 'ready' && (
                        <button type="button" disabled={working} onClick={() => post(`/delivery-list/${delivery.id}/start`)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168447] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#116d3a] disabled:opacity-60">
                            <Truck size={17} /> Start delivery
                        </button>
                    )}
                    {isRider && delivery.status === 'in_transit' && (
                        <div className="space-y-3 rounded-xl border border-[#e2ece4] p-4">
                            <h3 className="font-bold text-[#294333]">At the destination?</h3>
                            <p className="text-xs leading-relaxed text-[#748378]">Confirm arrival first. The customer will be asked to confirm receipt after you submit a delivery photo.</p>
                            <button type="button" disabled={working} onClick={() => post(`/delivery-list/${delivery.id}/arrive`)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168447] px-4 py-3 text-sm font-bold text-white hover:bg-[#116d3a] disabled:opacity-60"><MapPin size={17} /> Mark arrived</button>
                        </div>
                    )}
                    {isRider && delivery.status === 'arrived' && (
                        <form onSubmit={submitProof} className="space-y-3 rounded-xl border border-[#dcebe0] bg-[#fbfdfb] p-4">
                            <div><h3 className="font-bold text-[#294333]">Delivery confirmation</h3><p className="mt-1 text-xs leading-relaxed text-[#748378]">Take one photo of the delivered order. Photo proof is required before customer confirmation.</p></div>
                            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#9bc9a8] bg-white px-4 py-3 text-sm font-semibold text-[#287b46] hover:bg-[#f3faf4]">
                                <Camera size={18} /> {preview ? 'Retake photo' : 'Take photo'}
                                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => proofForm.setData('proof', event.target.files?.[0] ?? null)} />
                            </label>
                            {preview && <img src={preview} alt="Selected delivery photo preview" className="max-h-64 w-full rounded-lg border border-[#dfe8e1] object-contain" />}
                            {proofForm.errors.proof && <p className="text-xs text-red-600" role="alert">{proofForm.errors.proof}</p>}
                            <button type="submit" disabled={proofForm.processing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168447] px-4 py-3 text-sm font-bold text-white hover:bg-[#116d3a] disabled:opacity-60">
                                <CheckCircle2 size={17} /> {proofForm.processing ? 'Submitting photo…' : 'Submit delivery'}
                            </button>
                        </form>
                    )}
                    {isRider && ['in_transit', 'arrived'].includes(delivery.status) && (
                        <form onSubmit={(event) => { event.preventDefault(); if (failureReason.trim().length < 3) { setError('Add a short reason before reporting a failed delivery.'); return; } post(`/delivery-list/${delivery.id}/fail`, { reason: failureReason }); }} className="space-y-2 rounded-xl border border-[#f1dfdc] p-3.5">
                            <label htmlFor={`failure-${delivery.id}`} className="text-xs font-semibold text-[#745c58]">Can’t complete this delivery?</label>
                            <textarea id={`failure-${delivery.id}`} value={failureReason} onChange={(event) => setFailureReason(event.target.value)} maxLength={1000} rows={2} className="w-full resize-y rounded-lg border border-[#eadbd8] px-3 py-2 text-sm outline-none focus:border-[#bf756c]" placeholder="Briefly explain the issue" />
                            <button type="submit" disabled={working || failureReason.trim().length < 3} className="min-h-10 rounded-lg border border-[#e7c6c1] px-3 text-xs font-semibold text-[#a3453b] hover:bg-[#fff7f5] disabled:opacity-50">Report failed delivery</button>
                        </form>
                    )}
                    {isCustomer && delivery.status === 'delivered' && (
                        <div className="space-y-3 rounded-xl border border-[#cfe8d5] bg-[#f3faf4] p-4">
                            <div><h3 className="font-bold text-[#245b35]">Package delivered</h3><p className="mt-1 text-xs leading-relaxed text-[#647d6a]">Review the photo and confirm only after you have received your order.</p></div>
                            <button type="button" disabled={working} onClick={() => post(`/delivery-list/${delivery.id}/confirm-received`)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168447] px-4 py-3 text-sm font-bold text-white hover:bg-[#116d3a] disabled:opacity-60"><BadgeCheck size={18} /> Confirm received</button>
                            <form onSubmit={(event) => { event.preventDefault(); if (failureReason.trim().length < 3) { setError('Describe the issue before reporting it.'); return; } post(`/delivery-list/${delivery.id}/reject`, { reason: failureReason }); }} className="space-y-2 border-t border-[#deeee2] pt-3">
                                <label htmlFor={`reject-${delivery.id}`} className="text-xs font-semibold text-[#65796b]">Didn’t receive this order or is there a problem?</label>
                                <textarea id={`reject-${delivery.id}`} value={failureReason} onChange={(event) => setFailureReason(event.target.value)} maxLength={1000} rows={2} className="w-full resize-y rounded-lg border border-[#dce9df] bg-white px-3 py-2 text-sm outline-none focus:border-[#67a97c]" placeholder="Tell us what happened" />
                                <button type="submit" disabled={working || failureReason.trim().length < 3} className="min-h-10 rounded-lg border border-[#d4e7d8] px-3 text-xs font-semibold text-[#52745b] hover:bg-white disabled:opacity-50">Report a problem</button>
                            </form>
                        </div>
                    )}
                    {isCustomer && delivery.status === 'completed' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Link href={`/customer/orders/${delivery.order.id}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#168447] px-4 py-3 text-center text-sm font-bold text-white hover:bg-[#116d3a]">View order details <ArrowRight size={15} /></Link>
                            <Link href="/customer/orders" className="flex min-h-11 items-center justify-center rounded-xl border border-[#cfe4d4] px-4 py-3 text-sm font-semibold text-[#287b46] hover:bg-[#f2faf4]">Back to orders</Link>
                        </div>
                    )}
                    {error && <p className="rounded-lg bg-[#fff2ef] p-3 text-sm text-[#a3453b]" role="alert">{error}</p>}
                </aside>
            </div>
        </section>
    );
}

function DeliveryTable({ deliveries, onSelect, selectedId, role }: { deliveries: Delivery[]; onSelect: (id: number) => void; selectedId: number | null; role: Role }) {
    return (
        <>
            <div className="hidden overflow-hidden rounded-2xl border border-[#e0ebe3] bg-white shadow-[0_6px_22px_rgba(31,70,48,0.04)] lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-left">
                        <thead className="bg-[#f6faf7] text-[10px] font-bold tracking-wide text-[#74877a] uppercase">
                            <tr><th className="px-5 py-3.5">Product / order</th><th className="px-4 py-3.5">Customer</th><th className="px-4 py-3.5">Rider</th><th className="px-4 py-3.5">Qty</th><th className="px-4 py-3.5">Order total</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Updated</th><th className="px-4 py-3.5"><span className="sr-only">Open details</span></th></tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2ee]">
                            {deliveries.map((delivery) => {
                                const item = delivery.order.items[0];
                                return (
                                    <tr key={delivery.id} className={selectedId === delivery.id ? 'bg-[#f4faf5]' : 'hover:bg-[#fbfdfb]'}>
                                        <td className="px-5 py-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#edf5ef]">{imageUrl(item?.image) ? <img src={imageUrl(item?.image)!} alt="" className="h-full w-full object-cover" /> : <Package size={16} className="text-[#7b9b84]" />}</div>
                                                <div className="min-w-0"><p className="max-w-52 truncate text-xs font-semibold text-[#294333]">{item?.name ?? 'Order'}</p><p className="mt-0.5 text-[10px] text-[#839187]">{delivery.order.number}</p></div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-[#52675a]">{delivery.order.customer?.name ?? 'Customer'}</td>
                                        <td className="px-4 py-3 text-xs text-[#52675a]">{delivery.rider?.name ?? 'Unassigned'}</td>
                                        <td className="px-4 py-3 text-xs text-[#52675a]">{delivery.order.items.reduce((total, entry) => total + entry.quantity, 0)}</td>
                                        <td className="px-4 py-3 text-xs font-semibold text-[#294333]">{delivery.order.total != null ? money(delivery.order.total) : '—'}</td>
                                        <td className="px-4 py-3"><Badge status={delivery.status} /></td>
                                        <td className="whitespace-nowrap px-4 py-3 text-[10px] text-[#839187]">{when(delivery.confirmed_at ?? delivery.submitted_at ?? delivery.arrived_at ?? delivery.started_at ?? delivery.assigned_at)}</td>
                                        <td className="px-4 py-3"><button type="button" onClick={() => onSelect(delivery.id)} aria-expanded={selectedId === delivery.id} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d7e8dc] px-3 text-xs font-semibold text-[#287b46] hover:bg-[#f1f8f2]">{selectedId === delivery.id ? 'Close' : 'Details'} <ArrowRight size={13} /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="grid gap-3 lg:hidden">
                {deliveries.map((delivery) => {
                    const item = delivery.order.items[0];
                    return (
                        <article key={delivery.id} className={`rounded-2xl border bg-white p-3.5 shadow-[0_5px_18px_rgba(31,70,48,0.035)] sm:p-4 ${selectedId === delivery.id ? 'border-[#8fc69d]' : 'border-[#e0ebe3]'}`}>
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#edf5ef]">{imageUrl(item?.image) ? <img src={imageUrl(item?.image)!} alt="" className="h-full w-full object-cover" /> : <Package size={18} className="text-[#7b9b84]" />}</div>
                                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#294333]">{item?.name ?? 'Order'}</p><p className="mt-0.5 truncate text-xs text-[#829087]">{delivery.order.number}</p></div>
                                <Badge status={delivery.status} />
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                <div><p className="text-[10px] text-[#94a098]">Customer</p><p className="mt-0.5 truncate font-medium text-[#52675a]">{delivery.order.customer?.name ?? 'Customer'}</p></div>
                                <div><p className="text-[10px] text-[#94a098]">Rider</p><p className="mt-0.5 truncate font-medium text-[#52675a]">{delivery.rider?.name ?? 'Unassigned'}</p></div>
                                <div><p className="text-[10px] text-[#94a098]">Items</p><p className="mt-0.5 font-medium text-[#52675a]">{delivery.order.items.reduce((total, entry) => total + entry.quantity, 0)}</p></div>
                                <div><p className="text-[10px] text-[#94a098]">Total</p><p className="mt-0.5 font-semibold text-[#294333]">{delivery.order.total != null ? money(delivery.order.total) : '—'}</p></div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#eff3f0] pt-3">
                                <span className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-[#829087]"><Clock3 size={13} />{when(delivery.confirmed_at ?? delivery.submitted_at ?? delivery.arrived_at ?? delivery.started_at ?? delivery.assigned_at)}</span>
                                <button type="button" onClick={() => onSelect(delivery.id)} aria-expanded={selectedId === delivery.id} className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-[#eaf6ee] px-3 text-xs font-semibold text-[#287b46]">{selectedId === delivery.id ? 'Close details' : role === 'rider' ? 'Open delivery' : 'View details'} <ArrowRight size={13} /></button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </>
    );
}

function AdminDispatch({ orders, riders }: { orders: ReadyOrder[]; riders: Props['riders'] }) {
    const [assigned, setAssigned] = useState<Record<number, string>>({});
    const [error, setError] = useState('');
    const [workingOrder, setWorkingOrder] = useState<number | null>(null);

    function assign(order: ReadyOrder) {
        const riderId = assigned[order.id];
        if (!riderId) {
            setError('Choose an active logistics account before assigning this order.');
            return;
        }
        setError('');
        setWorkingOrder(order.id);
        router.post(`/delivery-list/orders/${order.id}/assign`, { rider_id: riderId }, {
            onError: (errors) => setError(Object.values(errors)[0] ?? 'Rider could not be assigned. Please retry.'),
            onFinish: () => setWorkingOrder(null),
        });
    }

    if (!orders.length) return null;
    return (
        <section className="mb-5 rounded-2xl border border-[#d8eadc] bg-white p-4 shadow-[0_6px_22px_rgba(31,70,48,0.04)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold tracking-[0.14em] text-[#328551] uppercase">Ready to dispatch</p><h2 className="mt-1 text-base font-bold text-[#203e2c] sm:text-lg">Orders awaiting rider assignment</h2><p className="mt-1 text-xs text-[#7c8d81]">Only orders with all active items marked shipped can be assigned.</p></div>
                <span className="rounded-full bg-[#eaf6ee] px-3 py-1.5 text-xs font-bold text-[#287b46]">{orders.length} ready</span>
            </div>
            {riders.length === 0 && <p className="mb-4 rounded-lg bg-[#fff7e8] p-3 text-sm text-[#885f15]">No active logistics accounts yet. An administrator can add one in Admin → Users before dispatching.</p>}
            {error && <p className="mb-3 rounded-lg bg-[#fff2ef] p-3 text-sm text-[#a3453b]" role="alert">{error}</p>}
            <div className="grid gap-3 xl:grid-cols-2">
                {orders.map((order) => (
                    <article key={order.id} className="min-w-0 rounded-xl border border-[#e6eee8] bg-[#fbfdfb] p-3.5 sm:p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="text-sm font-bold text-[#294333]">{order.number}</p><p className="mt-1 text-xs text-[#77887d]">{order.customer}</p></div>
                            <span className="rounded-full bg-[#e5f5e9] px-2.5 py-1 text-[10px] font-semibold text-[#26804a]">Ready for delivery</span>
                        </div>
                        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#62746a]"><MapPin size={14} className="mt-0.5 shrink-0 text-[#3b8b54]" /><span className="break-words">{order.address}</span></p>
                        {order.instructions && <p className="mt-2 rounded-lg bg-[#fffbf1] p-2.5 text-xs leading-relaxed text-[#745f34]"><span className="font-semibold">Instructions:</span> {order.instructions}</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">{order.items.map((item, index) => <span key={`${item.name}-${index}`} className="rounded-full border border-[#e1ebe3] bg-white px-2.5 py-1 text-[10px] text-[#607368]">{item.name} × {item.quantity}</span>)}</div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <label className="sr-only" htmlFor={`rider-${order.id}`}>Assign rider for {order.number}</label>
                            <select id={`rider-${order.id}`} value={assigned[order.id] ?? ''} onChange={(event) => setAssigned({ ...assigned, [order.id]: event.target.value })} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#d9e6dc] bg-white px-3 text-sm text-[#3c5545] outline-none focus:border-[#378a50]" disabled={!riders.length}>
                                <option value="">Choose a logistics account</option>{riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
                            </select>
                            <button type="button" onClick={() => assign(order)} disabled={!riders.length || workingOrder === order.id} className="min-h-11 rounded-lg bg-[#168447] px-4 text-sm font-bold text-white hover:bg-[#116d3a] disabled:cursor-not-allowed disabled:opacity-50">{workingOrder === order.id ? 'Assigning…' : 'Assign rider'}</button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

function SellerMonitoring({ orders }: { orders: SellerOrder[] }) {
    const [filter, setFilter] = useState<'all' | 'processing' | 'in_transit' | 'arrived' | 'delivered'>('all');
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => orders.filter((order) => {
        const statusMatches = filter === 'all' || order.status === filter;
        const searchMatches = `${order.order_number} ${order.product} ${order.customer}`.toLowerCase().includes(search.toLowerCase());
        return statusMatches && searchMatches;
    }), [filter, orders, search]);
    const counts = useMemo(() => ({
        all: orders.length,
        processing: orders.filter((order) => order.status === 'processing').length,
        in_transit: orders.filter((order) => order.status === 'in_transit').length,
        arrived: orders.filter((order) => order.status === 'arrived').length,
        delivered: orders.filter((order) => order.status === 'delivered').length,
    }), [orders]);
    const filters: { key: typeof filter; label: string }[] = [
        { key: 'all', label: 'All' }, { key: 'processing', label: 'Processing' }, { key: 'in_transit', label: 'In transit' }, { key: 'arrived', label: 'Arrived' }, { key: 'delivered', label: 'Delivered' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e0ebe3] bg-white p-3.5 shadow-[0_6px_22px_rgba(31,70,48,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex max-w-full gap-1 overflow-x-auto pb-1 sm:pb-0" aria-label="Filter seller deliveries">
                    {filters.map(({ key, label }) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${filter === key ? 'bg-[#168447] text-white' : 'bg-[#f4f8f5] text-[#6d7d72] hover:bg-[#eaf4ed]'}`}>{label}<span className={`ml-1.5 ${filter === key ? 'text-white/75' : 'text-[#9aa79e]'}`}>{counts[key]}</span></button>)}
                </div>
                <label className="relative block w-full sm:max-w-64"><span className="sr-only">Search this shop’s orders</span><Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#91a197]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders or customers" className="h-10 w-full rounded-lg border border-[#e0e9e2] bg-[#fcfdfc] pr-3 pl-9 text-xs outline-none focus:border-[#66a57a]" /></label>
            </div>
            <div className="hidden overflow-hidden rounded-2xl border border-[#e0ebe3] bg-white shadow-[0_6px_22px_rgba(31,70,48,0.04)] lg:block">
                <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left">
                    <thead className="bg-[#f6faf7] text-[10px] font-bold tracking-wide text-[#74877a] uppercase"><tr><th className="px-5 py-3.5">Product</th><th className="px-4 py-3.5">Order</th><th className="px-4 py-3.5">Customer</th><th className="px-4 py-3.5">Rider</th><th className="px-4 py-3.5">Qty</th><th className="px-4 py-3.5">Item total</th><th className="px-4 py-3.5">Progress</th><th className="px-4 py-3.5">Updated</th><th className="px-4 py-3.5">Proof</th></tr></thead>
                    <tbody className="divide-y divide-[#edf2ee]">{filtered.map((order) => <tr key={order.id} className="hover:bg-[#fbfdfb]">
                        <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#edf5ef]">{imageUrl(order.image) ? <img src={imageUrl(order.image)!} alt="" className="h-full w-full object-cover" /> : <Package size={16} className="text-[#7b9b84]" />}</div><span className="max-w-44 truncate text-xs font-semibold text-[#294333]">{order.product}</span></div></td>
                        <td className="px-4 py-3 text-xs text-[#52675a]">{order.order_number}</td><td className="px-4 py-3 text-xs text-[#52675a]">{order.customer}</td><td className="px-4 py-3 text-xs text-[#52675a]">{order.rider ?? '—'}</td><td className="px-4 py-3 text-xs text-[#52675a]">{order.quantity}</td><td className="px-4 py-3 text-xs font-semibold text-[#294333]">{money(order.total)}</td><td className="px-4 py-3"><Badge status={order.status} /></td><td className="whitespace-nowrap px-4 py-3 text-[10px] text-[#839187]">{when(order.updated_at)}</td><td className="px-4 py-3">{order.proof_url ? <a href={order.proof_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#287b46] underline">View photo</a> : <span className="text-xs text-[#a0aaa3]">—</span>}</td>
                    </tr>)}</tbody>
                </table></div>
            </div>
            <div className="grid gap-3 lg:hidden">{filtered.map((order) => <article key={order.id} className="rounded-xl border border-[#e0ebe3] bg-white p-3.5 shadow-sm">
                <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#edf5ef]">{imageUrl(order.image) ? <img src={imageUrl(order.image)!} alt="" className="h-full w-full object-cover" /> : <Package size={18} className="text-[#7b9b84]" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 flex-1 truncate text-sm font-bold text-[#294333]">{order.product}</h3><Badge status={order.status} /></div><p className="mt-1 text-xs text-[#839187]">{order.order_number}</p></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="text-[10px] text-[#98a49b]">Customer</span><p className="mt-0.5 truncate text-[#52675a]">{order.customer}</p></div><div><span className="text-[10px] text-[#98a49b]">Rider</span><p className="mt-0.5 truncate text-[#52675a]">{order.rider ?? 'Not assigned'}</p></div><div><span className="text-[10px] text-[#98a49b]">Quantity</span><p className="mt-0.5 text-[#52675a]">{order.quantity}</p></div><div><span className="text-[10px] text-[#98a49b]">Item total</span><p className="mt-0.5 font-semibold text-[#294333]">{money(order.total)}</p></div></div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#eff3f0] pt-3"><span className="text-[10px] text-[#839187]">{when(order.updated_at)}</span>{order.proof_url && <a href={order.proof_url} target="_blank" rel="noreferrer" className="min-h-10 rounded-lg bg-[#eaf6ee] px-3 py-2.5 text-xs font-semibold text-[#287b46]">View delivery photo</a>}</div>
            </article>)}</div>
            {!filtered.length && <div className="rounded-2xl border border-dashed border-[#d9e6dc] bg-white px-5 py-12 text-center"><Package className="mx-auto text-[#8da995]" size={26} /><h3 className="mt-3 font-semibold text-[#35533e]">No matching orders</h3><p className="mt-1 text-sm text-[#87948a]">Try another filter or search term.</p></div>}
        </div>
    );
}

export default function DeliveryList({ role, shopName, deliveries, readyOrders, riders, sellerOrders, stats }: Props) {
    const [filter, setFilter] = useState<Filter>('all');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const filteredDeliveries = useMemo(() => deliveries.filter((delivery) => {
        if (filter === 'all') return true;
        if (filter === 'delivered') return ['delivered', 'completed'].includes(delivery.status);
        return delivery.status === filter;
    }), [deliveries, filter]);
    const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;
    const isCustomer = role === 'customer';
    const title = role === 'admin' ? 'Delivery monitoring' : role === 'seller' ? 'Seller delivery progress' : role === 'rider' ? 'My deliveries' : 'My delivery updates';
    const subtitle = role === 'admin'
        ? 'Dispatch ready orders and follow every delivery through customer confirmation.'
        : role === 'seller'
          ? `${shopName || 'Your shop'} · Delivery progress for your products and orders only.`
          : role === 'rider'
            ? 'View only deliveries assigned to your account.'
            : 'Track your delivery, review photo proof, and confirm receipt.';
    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: deliveries.length },
        { key: 'in_transit', label: 'In transit', count: stats.in_transit },
        { key: 'delivered', label: 'Delivered', count: stats.delivered },
        { key: 'failed', label: 'Failed', count: stats.failed },
    ];

    return (
        <PortalLayout role={role} title={title} eyebrow="Delivery workflow" wideContent>
            <Head title={title} />
            <main className="mx-auto w-full max-w-[1680px] min-w-0 px-3 py-5 sm:px-6 sm:py-7 2xl:px-9">
                <section className="mb-5 overflow-hidden rounded-2xl border border-[#d5e9d9] bg-[linear-gradient(115deg,#f4fbf5_0%,#ffffff_60%,#edf8f0_100%)] p-4 shadow-[0_8px_26px_rgba(31,70,48,0.045)] sm:p-6 lg:p-7">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                            <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-[#338252] uppercase"><Truck size={14} /> BSAB-Shop delivery workspace</p>
                            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#173f2a] sm:text-3xl">{title}</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6f8175]">{subtitle}</p>
                        </div>
                        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#dcece0] bg-white/80 p-3.5 md:max-w-72">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf6ee] text-[#25854b]"><ShieldCheck size={21} /></span>
                            <div className="min-w-0"><p className="text-xs font-bold text-[#34533d]">Photo-only proof</p><p className="mt-1 text-[10px] leading-relaxed text-[#829087]">No OTP, signature, or extra verification.</p></div>
                        </div>
                    </div>
                </section>

                {role === 'seller' ? (
                    <>
                        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                            <Stat label="Your items" value={sellerOrders.length} note="Only your shop’s orders" Icon={Package} />
                            <Stat label="In transit" value={sellerOrders.filter((order) => order.status === 'in_transit').length} note="Rider is on the way" Icon={Truck} />
                            <Stat label="Arrived" value={sellerOrders.filter((order) => order.status === 'arrived').length} note="Photo submitted or arrival recorded" Icon={MapPin} />
                            <Stat label="Delivered" value={sellerOrders.filter((order) => order.status === 'delivered').length} note="Customer confirmed receipt" Icon={CheckCircle2} />
                        </div>
                        <SellerMonitoring orders={sellerOrders} />
                    </>
                ) : (
                    <>
                        {role === 'admin' && (
                            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                                <Stat label="Assigned deliveries" value={stats.total} note="Orders in the delivery workflow" Icon={Package} />
                                <Stat label="In transit" value={stats.in_transit} note="Logistics staff currently en route" Icon={Truck} />
                                <Stat label="Delivered" value={stats.delivered} note="Awaiting or completed confirmation" Icon={CheckCircle2} />
                                <Stat label="Needs attention" value={stats.failed} note="Failed or rejected deliveries" Icon={AlertCircle} />
                            </div>
                        )}
                        <AdminDispatch orders={readyOrders} riders={riders} />
                        <section>
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div><h2 className="text-lg font-bold text-[#203e2c]">{role === 'admin' ? 'All assigned deliveries' : isCustomer ? 'Your deliveries' : 'Assigned delivery list'}</h2><p className="mt-1 text-xs text-[#839187]">{role === 'rider' ? 'Only orders assigned to you are shown here.' : isCustomer ? 'Delivery progress, proof photos, and receipt confirmation.' : 'Select a delivery to view order details and its progress timeline.'}</p></div>
                                <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#e0ebe3] bg-white p-1" aria-label="Filter deliveries">
                                    {filters.map((entry) => <button key={entry.key} type="button" aria-pressed={filter === entry.key} onClick={() => { setFilter(entry.key); setSelectedId(null); }} className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${filter === entry.key ? 'bg-[#168447] text-white' : 'text-[#687a6e] hover:bg-[#f0f7f2]'}`}>{entry.label}<span className={`ml-1.5 ${filter === entry.key ? 'text-white/70' : 'text-[#99a69c]'}`}>{entry.count}</span></button>)}
                                </div>
                            </div>
                            {filteredDeliveries.length ? (
                                <>
                                    <DeliveryTable deliveries={filteredDeliveries} selectedId={selectedId} role={role} onSelect={(id) => setSelectedId((current) => current === id ? null : id)} />
                                    {selected && <DetailPanel key={selected.id} role={role} delivery={selected} />}
                                </>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-[#d9e6dc] bg-white px-5 py-14 text-center">
                                    {isCustomer ? <CheckCircle2 className="mx-auto text-[#85b292]" size={30} /> : <Package className="mx-auto text-[#8da995]" size={28} />}
                                    <h3 className="mt-3 font-semibold text-[#35533e]">{isCustomer ? 'No delivery updates yet' : role === 'rider' ? 'No deliveries assigned' : 'No deliveries match this filter'}</h3>
                                    <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#87948a]">{isCustomer ? 'When an order is assigned for delivery, you’ll see its route progress and photo proof here.' : role === 'rider' ? 'Your assigned orders will appear here with delivery instructions and customer details.' : 'When a seller marks an order ready, an administrator can assign a rider here.'}</p>
                                    {isCustomer && <Link href="/customer/orders" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#168447] px-4 py-2 text-sm font-semibold text-white hover:bg-[#116d3a]">Back to orders <ArrowRight size={15} /></Link>}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </PortalLayout>
    );
}
