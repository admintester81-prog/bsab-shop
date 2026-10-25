import { PortalLayout } from '@/components/portal-layout';
import { api } from '@/lib/api';
import { Head, Link } from '@inertiajs/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    Clock3,
    Package,
    Search,
    ShoppingBag,
    Truck,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type OrderItem = {
    id?: number;
    quantity: number;
    unit_price?: string | number;
    total_price?: string | number;
    shop?: { name: string } | null;
    variant?: { name: string; sku?: string } | null;
    product?: { name: string; images?: { path: string; is_primary: boolean }[] } | null;
};
type Payment = { id: number; gateway: string; amount: string | number; status: string; transaction_id?: string | null; paid_at?: string | null };
type Order = {
    id: number;
    order_number: string;
    status: string;
    payment_status: string;
    payment_method?: string | null;
    subtotal?: string | number;
    shipping_fee?: string | number;
    total: string | number;
    shipping_address?: Record<string, string> | null;
    created_at: string;
    user?: { name: string; email: string } | null;
    items?: OrderItem[];
    payments?: Payment[];
};
type ChartPoint = {
    label: string;
    value: number;
    pending: number;
    processing: number;
    accepted: number;
    shipped: number;
    delivered: number;
};
type Count = { status: string; total: number };
type OrdersResponse = {
    data: Order[];
    current_page: number;
    last_page: number;
    total: number;
    stats: {
        total: number;
        today: number;
        in_progress: number;
        revenue: number;
        statuses: Count[];
        payments: Count[];
    };
    overview_chart: ChartPoint[];
    revenue_chart: ChartPoint[];
    recent_activity: (Pick<Order, 'id' | 'order_number' | 'status' | 'created_at'> & { user?: { name: string } | null })[];
};
type OrderStatus = 'pending' | 'processing' | 'accepted' | 'shipped' | 'delivered' | 'cancelled';
type Range = '7_days' | '30_days' | '3_months';
type RevenueRange = 'today' | '7_days' | '30_days' | 'this_year';

const statusColors: Record<string, string> = {
    pending: '#f9b847',
    processing: '#65c7bd',
    accepted: '#50ad71',
    shipped: '#3696ca',
    delivered: '#16834e',
    cancelled: '#ed6b62',
};
const statuses: OrderStatus[] = ['pending', 'processing', 'accepted', 'shipped', 'delivered', 'cancelled'];
const statusSteps: OrderStatus[] = ['pending', 'processing', 'accepted', 'shipped', 'delivered'];

function money(value: string | number | undefined) {
    return `₱${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: string) {
    if (status === 'delivered' || status === 'accepted' || status === 'paid') return 'bg-[#e4f7ed] text-[#26854f]';
    if (status === 'processing') return 'bg-[#eaf5f4] text-[#327d79]';
    if (status === 'shipped') return 'bg-[#e8f2fb] text-[#347ba6]';
    if (status === 'cancelled' || status === 'failed') return 'bg-[#fff0ed] text-[#bd5144]';
    return 'bg-[#fff2cd] text-[#9c6b0d]';
}

function orderImage(order: Order) {
    return order.items?.[0]?.product?.images?.find((image) => image.is_primary) ?? order.items?.[0]?.product?.images?.[0];
}

function imageUrl(path: string) {
    return path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`;
}

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={`min-w-0 rounded-xl border border-[#e4ebe6] bg-white p-3.5 shadow-[0_3px_13px_rgba(31,70,48,0.045)] sm:p-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-[#25372c]">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-[9px] text-[#7d8b82]">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function LineChart({ points, label, currency = false }: { points: ChartPoint[]; label: string; currency?: boolean }) {
    const values = points.map((point) => Number.isFinite(point.value) ? point.value : 0);
    const max = Math.max(...values, 1);
    const coords = points.map((point, index) => ({
        ...point,
        x: points.length < 2 ? 300 : (index / (points.length - 1)) * 600,
        value: values[index],
        y: 150 - (values[index] / max) * 120,
    }));
    const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
    const area = coords.length ? `0,160 ${line} 600,160` : '';
    const labelStep = Math.max(1, Math.ceil(points.length / 6));

    return (
        <div className="min-w-0">
            <svg viewBox="0 0 600 170" className="h-36 w-full overflow-visible" role="img" aria-label={label} preserveAspectRatio="none">
                {[30, 70, 110, 150].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#edf2ee" strokeDasharray="3 5" />)}
                {coords.length > 0 && <polygon points={area} fill="#34a874" fillOpacity=".12" />}
                {coords.length > 0 && <polyline points={line} fill="none" stroke="#25945b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {coords.map((point) => (
                    <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="white" stroke="#25945b" strokeWidth="2" vectorEffect="non-scaling-stroke">
                        <title>{`${point.label}: ${currency ? money(point.value) : point.value} orders`}</title>
                    </circle>
                ))}
            </svg>
            <div className="mt-1 flex justify-between gap-1 overflow-hidden text-[8px] text-[#7e8e83]">
                {points.filter((_, index) => index % labelStep === 0 || index === points.length - 1).map((point) => <span key={point.label}>{point.label}</span>)}
            </div>
        </div>
    );
}

function BarChart({ points }: { points: ChartPoint[] }) {
    const values = points.map((point) => Number.isFinite(point.value) ? point.value : 0);
    const max = Math.max(...values, 1);
    const labelStep = Math.max(1, Math.ceil(points.length / 6));
    return (
        <div className="flex h-[174px] min-w-0 flex-col">
            <div className="flex min-h-0 flex-1 items-end gap-[2px] border-b border-l border-[#edf2ee] px-1">
                {points.map((point, index) => (
                    <div key={point.label} title={`${point.label}: ${point.value} orders`} className="group relative flex h-full min-w-0 flex-1 items-end">
                        <span className="w-full rounded-t-sm bg-[#55b58b] transition-colors group-hover:bg-[#218a57]" style={{ height: `${values[index] ? Math.max((values[index] / max) * 100, 4) : 1}%` }} />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between gap-1 text-[8px] text-[#7e8e83]">
                {points.filter((_, index) => index % labelStep === 0 || index === points.length - 1).map((point) => <span key={point.label}>{point.label}</span>)}
            </div>
        </div>
    );
}

export default function AdminOrders() {
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [paymentStatus, setPaymentStatus] = useState('all');
    const [date, setDate] = useState('all');
    const [sort, setSort] = useState('newest');
    const [page, setPage] = useState(1);
    const [overviewRange, setOverviewRange] = useState<Range>('30_days');
    const [revenueRange, setRevenueRange] = useState<RevenueRange>('30_days');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [actionError, setActionError] = useState('');
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQuery(search);
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const { data, isLoading, isError } = useQuery<OrdersResponse>({
        queryKey: ['admin-orders', query, status, paymentStatus, date, sort, page, overviewRange, revenueRange],
        queryFn: async () => (await api.get('/admin/orders', {
            params: {
                search: query || undefined,
                status,
                payment_status: paymentStatus,
                date,
                sort,
                page,
                overview_range: overviewRange,
                revenue_range: revenueRange,
            },
        })).data,
    });
    const updateStatus = useMutation({
        mutationFn: async ({ id, nextStatus }: { id: number; nextStatus: OrderStatus }) => (await api.patch(`/admin/orders/${id}`, { status: nextStatus })).data as Order,
        onSuccess: (updatedOrder) => {
            setSelectedOrder(updatedOrder);
            setActionError('');
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        },
        onError: () => setActionError('Unable to update this order. Please try again.'),
    });

    const orders = data?.data ?? [];
    const stats = data?.stats;
    const statusCounts = stats?.statuses ?? [];
    const paymentCounts = stats?.payments ?? [];
    const totalStatusOrders = statusCounts.reduce((total, item) => total + item.total, 0);
    const donutBackground = useMemo(() => {
        if (!totalStatusOrders) return '#edf3ee 0% 100%';
        let cursor = 0;
        return statusCounts.filter((item) => item.total > 0).map((item) => {
            const start = cursor;
            cursor += (item.total / totalStatusOrders) * 100;
            return `${statusColors[item.status] ?? '#83a18d'} ${start}% ${cursor}%`;
        }).join(', ');
    }, [statusCounts, totalStatusOrders]);

    const changeFilter = (setter: (value: string) => void, value: string) => {
        setter(value);
        setPage(1);
    };
    const confirmStatus = (order: Order, nextStatus: OrderStatus) => {
        if (nextStatus === order.status) return;
        const label = nextStatus[0].toUpperCase() + nextStatus.slice(1);
        if (window.confirm(`Update order #${order.order_number} to ${label}?`)) {
            setActionError('');
            updateStatus.mutate({ id: order.id, nextStatus });
        }
    };

    const openDetails = (order: Order) => {
        setActionError('');
        setSelectedOrder(order);
    };
    const orderOverviewPoints = data?.overview_chart ?? [];
    const revenuePoints = data?.revenue_chart ?? [];
    const activities = data?.recent_activity ?? [];
    const currentPage = data?.current_page ?? page;

    return (
        <>
            <Head title="Order Management" />
            <PortalLayout role="admin" title="Order monitoring" eyebrow="Platform operations">
                <div className="mb-4 flex min-w-0 flex-col justify-between gap-2 sm:mb-5 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-semibold text-[#16834b]">‹ &nbsp; Orders</p>
                        <h1 className="mt-1 text-2xl leading-tight font-bold tracking-tight text-[#174c3e] sm:text-[29px]">Order Management</h1>
                        <p className="mt-1 text-xs leading-5 text-[#6a7c70]">Keep a close eye on every customer purchase and fulfillment stage.</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#eaf6ef] px-2.5 py-1 text-[9px] font-semibold text-[#287d48] sm:self-auto">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#26945d]" /> Live order data
                    </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: 'All orders', value: stats?.total ?? 0, detail: 'Across the marketplace', Icon: ShoppingBag, trend: orderOverviewPoints.map((point) => point.value) },
                        { label: 'Placed today', value: stats?.today ?? 0, detail: 'New customer orders', Icon: CalendarDays, trend: orderOverviewPoints.map((point) => point.value) },
                        { label: 'In progress', value: stats?.in_progress ?? 0, detail: 'Needs fulfillment', Icon: Clock3, trend: orderOverviewPoints.map((point) => point.pending + point.processing + point.accepted + point.shipped) },
                        { label: 'Gross revenue', value: money(stats?.revenue), detail: 'From all orders', Icon: CircleDollarSign, trend: revenuePoints.map((point) => point.value) },
                    ].map(({ label, value, detail, Icon, trend }) => (
                        <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e4ebe6] bg-white p-3.5 shadow-[0_3px_13px_rgba(31,70,48,0.045)]">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eaf6ef] text-[#258553]"><Icon size={18} /></span>
                            <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-[#607166]">{label}</p><p className="mt-0.5 truncate text-xl leading-none font-bold text-[#1c4b3d]">{value}</p><p className="mt-1 truncate text-[9px] text-[#829087]">{detail}</p></div>
                            <TinyTrend values={trend} />
                        </div>
                    ))}
                </div>

                <section className="mt-3 overflow-hidden rounded-xl border border-[#e4ebe6] bg-white shadow-[0_3px_13px_rgba(31,70,48,0.045)]">
                    <div className="border-b border-[#edf1ee] p-3.5 sm:p-4">
                        <div className="mb-3"><p className="text-[9px] font-bold tracking-[0.12em] text-[#5a8068] uppercase">Order ledger</p><h2 className="mt-1 text-sm font-bold text-[#25372c]">All customer orders</h2></div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dce5df] px-2.5 focus-within:border-[#2a8b52] sm:min-w-[210px]">
                                <Search size={14} className="shrink-0 text-[#748279]" />
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, customer, or product..." className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-[#99a39d]" />
                                {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-[#829087]"><X size={13} /></button>}
                            </label>
                            <FilterSelect value={status} onChange={(value) => changeFilter(setStatus, value)} ariaLabel="Filter order status" options={[['all', 'All order statuses'], ...statuses.map((item) => [item, titleCase(item)] as [string, string])]} />
                            <FilterSelect value={paymentStatus} onChange={(value) => changeFilter(setPaymentStatus, value)} ariaLabel="Filter payment status" options={[['all', 'All payments'], ['pending', 'Payment pending'], ['paid', 'Paid'], ['failed', 'Failed']]} />
                            <FilterSelect value={date} onChange={(value) => changeFilter(setDate, value)} ariaLabel="Filter order date" options={[['all', 'All dates'], ['today', 'Today'], ['7_days', 'Last 7 days'], ['30_days', 'Last 30 days'], ['this_year', 'This year']]} />
                            <FilterSelect value={sort} onChange={(value) => changeFilter(setSort, value)} ariaLabel="Sort orders" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['highest_total', 'Highest total'], ['lowest_total', 'Lowest total']]} />
                        </div>
                    </div>
                    {actionError && <div role="alert" className="mx-3 mt-3 rounded-lg border border-[#f0d2cd] bg-[#fff4f2] px-3 py-2 text-[10px] text-[#a64135]">{actionError}</div>}
                    {isError ? (
                        <div className="p-10 text-center text-xs text-[#a23b2d]">Unable to load orders. Please refresh and try again.</div>
                    ) : isLoading ? (
                        <div className="p-10 text-center text-xs text-[#657066]">Loading order activity...</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] text-left text-[9px]">
                                    <thead className="border-b border-[#eaf0ec] bg-[#f5faf7] text-[#668073]">
                                        <tr>
                                            <th className="px-3 py-2.5 font-medium">Item</th><th className="px-3 py-2.5 font-medium">Order</th><th className="px-3 py-2.5 font-medium">Customer</th><th className="px-3 py-2.5 font-medium">Items / shops</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Payment</th><th className="px-3 py-2.5 text-right font-medium">Total</th><th className="px-3 py-2.5 font-medium">Placed</th><th className="px-3 py-2.5 text-right font-medium">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#edf1ee]">
                                        {orders.map((order) => {
                                            const image = orderImage(order);
                                            const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
                                            const shops = [...new Set(order.items?.map((item) => item.shop?.name).filter((name): name is string => Boolean(name)))];
                                            const productName = order.items?.[0]?.product?.name ?? 'Order items';
                                            const placed = new Date(order.created_at);
                                            return (
                                                <tr key={order.id} className="hover:bg-[#fbfdfb]">
                                                    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#edf4ef] text-[#52725c]">{image ? <img src={imageUrl(image.path)} alt={productName} className="h-full w-full object-cover" /> : <Package size={15} />}</span><span className="max-w-32 truncate font-semibold text-[#405449]">{productName}</span></div></td>
                                                    <td className="px-3 py-2.5"><p className="max-w-32 truncate font-semibold text-[#405449]">#{order.order_number}</p><p className="mt-0.5 text-[8px] text-[#8a9790]">ID {order.id}</p></td>
                                                    <td className="px-3 py-2.5"><p className="max-w-28 truncate font-semibold text-[#405449]">{order.user?.name ?? 'Guest customer'}</p><p className="mt-0.5 max-w-32 truncate text-[8px] text-[#89968e]">{order.user?.email ?? 'No email'}</p></td>
                                                    <td className="px-3 py-2.5"><p className="text-[#53655a]">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p><p className="mt-0.5 flex max-w-32 items-center gap-1 truncate text-[8px] text-[#89968e]"><ShoppingBag size={10} /> {shops.join(', ') || 'Marketplace'}</p></td>
                                                    <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-semibold capitalize ${statusClass(order.status)}`}><Clock3 size={10} />{order.status}</span></td>
                                                    <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-[8px] font-semibold capitalize ${statusClass(order.payment_status ?? 'pending')}`}>{order.payment_status ?? 'pending'}</span></td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-[#405449]">{money(order.total)}</td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap text-[#64746a]">{placed.toLocaleDateString('en-GB')}<p className="mt-0.5 text-[8px] text-[#8a9790]">{placed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></td>
                                                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => openDetails(order)} className="inline-flex h-7 items-center gap-1 rounded-md border border-[#cfe3d5] px-2.5 text-[9px] font-semibold text-[#287d48] hover:bg-[#f0f8f3]">View <ArrowRight size={11} /></button></td>
                                                </tr>
                                            );
                                        })}
                                        {!orders.length && <tr><td colSpan={9} className="py-10 text-center text-[10px] text-[#819087]"><Package size={18} className="mx-auto mb-1 text-[#83a18d]" />No orders match these filters.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-2 border-t border-[#edf1ee] px-3 py-2.5 text-[9px] text-[#748279] sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                <span>Showing {orders.length ? (currentPage - 1) * 20 + 1 : 0}–{(currentPage - 1) * 20 + orders.length} of {data?.total ?? 0} orders</span>
                                <div className="flex items-center justify-between gap-1 sm:justify-end">
                                    <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-[#f3f8f4] disabled:opacity-40"><ChevronLeft size={13} /> Previous</button>
                                    <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-[#188747] px-2 font-semibold text-white">{data?.current_page ?? page}</span>
                                    <button type="button" disabled={page >= (data?.last_page ?? 1)} onClick={() => setPage((current) => current + 1)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-[#f3f8f4] disabled:opacity-40">Next <ChevronRight size={13} /></button>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                <div className="mt-3 grid min-w-0 gap-2.5 xl:grid-cols-3">
                    <Panel title="Order Status" subtitle="Distribution of order status">
                        <div className="mt-3 flex items-center justify-center gap-4">
                            <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${donutBackground})` }}>
                                <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-white"><strong className="text-xl leading-none text-[#254c3b]">{stats?.total ?? 0}</strong><span className="mt-1 text-[8px] text-[#78877e]">Total orders</span></div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                {statusCounts.map((item) => <div key={item.status} className="flex items-center justify-between gap-2 text-[9px]"><span className="flex items-center gap-1.5 capitalize text-[#617168]"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColors[item.status] ?? '#83a18d' }} />{item.status}</span><span className="whitespace-nowrap text-[#77857c]">{item.total} <small>({stats?.total ? Math.round((item.total / stats.total) * 100) : 0}%)</small></span></div>)}
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Sales Trend" subtitle="Total sales over time" action={<RangeSelect value={revenueRange} onChange={(value) => setRevenueRange(value as RevenueRange)} options={[['today', 'Today'], ['7_days', '7 Days'], ['30_days', '30 Days'], ['this_year', 'This Year']]} />}>
                        <p className="mt-2 text-[9px] text-[#73847a]">Gross revenue <strong className="ml-1 text-[#285541]">{money(stats?.revenue)}</strong></p>
                        <div className="mt-2"><LineChart points={revenuePoints} label="Gross revenue over time" currency /></div>
                    </Panel>
                    <Panel title="Order Trend" subtitle="Orders over time" action={<RangeSelect value={overviewRange} onChange={(value) => setOverviewRange(value as Range)} options={[['7_days', '7 Days'], ['30_days', '30 Days'], ['3_months', '3 Months']]} />}>
                        <div className="mt-3"><BarChart points={orderOverviewPoints} /></div>
                    </Panel>
                </div>

                <div className="mt-3 grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
                    <Panel title="Payment Status" subtitle="Payment collection summary">
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {paymentCounts.map((item) => {
                                const total = paymentCounts.reduce((sum, payment) => sum + payment.total, 0);
                                return <div key={item.status} className="rounded-lg bg-[#f8fbf9] p-3">
                                    <div className="flex items-center justify-between gap-2"><span className="text-[9px] capitalize text-[#718077]">{item.status === 'pending' ? 'Payment pending' : item.status}</span><span className={`h-2 w-2 rounded-full ${item.status === 'failed' ? 'bg-[#ed6b62]' : item.status === 'paid' ? 'bg-[#16834e]' : 'bg-[#f9b847]'}`} /></div>
                                    <strong className="mt-1 block text-lg text-[#254c3b]">{item.total}</strong>
                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e9efeb]"><span className={`block h-full rounded-full ${item.status === 'failed' ? 'bg-[#ed6b62]' : item.status === 'paid' ? 'bg-[#16834e]' : 'bg-[#f9b847]'}`} style={{ width: `${total ? Math.max((item.total / total) * 100, item.total ? 4 : 0) : 0}%` }} /></div>
                                </div>;
                            })}
                        </div>
                    </Panel>
                    <Panel title="Fulfillment monitoring" subtitle="Orders by current fulfillment stage">
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {statusCounts.map((item) => <div key={item.status} className="flex items-center gap-2 rounded-lg bg-[#f8fbf9] p-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#398259]"><Truck size={13} /></span><div className="min-w-0"><p className="truncate text-[8px] capitalize text-[#78877e]">{item.status === 'pending' ? 'Pending fulfillment' : item.status}</p><strong className="text-sm text-[#254c3b]">{item.total}</strong></div></div>)}
                        </div>
                    </Panel>
                </div>

                <Panel title="Recent order activity" subtitle="Latest customer purchases" className="mt-3">
                    <div className="mt-3 grid gap-0 sm:grid-cols-2">
                        {activities.slice(0, 4).map((activity, index) => (
                            <div key={activity.id} className="relative flex gap-3 py-2.5 first:pt-0">
                                <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eaf6ef] text-[#318052]"><ShoppingBag size={13} />{index < activities.length - 1 && <i className="absolute top-7 left-1/2 h-6 w-px -translate-x-1/2 bg-[#dce9df] sm:hidden" />}</span>
                                <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#405449]">Order #{activity.order_number}</p><p className="mt-0.5 text-[9px] text-[#78877e]">{activity.user?.name ?? 'Customer'} placed an order</p><p className="mt-0.5 text-[8px] text-[#96a199]">{new Date(activity.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                                <span className={`h-fit rounded-full px-2 py-0.5 text-[8px] font-semibold capitalize ${statusClass(activity.status)}`}>{activity.status}</span>
                            </div>
                        ))}
                        {!activities.length && <p className="py-4 text-center text-[10px] text-[#829087]">No recent order activity.</p>}
                    </div>
                </Panel>

                {selectedOrder && <OrderDetails order={selectedOrder} busy={updateStatus.isPending} actionError={actionError} onClose={() => setSelectedOrder(null)} onUpdate={(nextStatus) => confirmStatus(selectedOrder, nextStatus)} />}
            </PortalLayout>
        </>
    );
}

function TinyTrend({ values }: { values: number[] }) {
    const safeValues = values.map((value) => Number.isFinite(value) ? value : 0);
    const max = Math.max(...safeValues, 1);
    const points = safeValues.map((value, index) => `${(index / Math.max(safeValues.length - 1, 1)) * 100},${27 - (value / max) * 22}`).join(' ');
    return <svg viewBox="0 0 100 30" className="hidden h-7 w-12 shrink-0 sm:block" aria-hidden="true"><polyline points={points} fill="none" stroke="#299462" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function titleCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function FilterSelect({ value, onChange, options, ariaLabel }: { value: string; onChange: (value: string) => void; options: [string, string][]; ariaLabel: string }) {
    return (
        <label className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-[#dce5df] bg-white px-2.5 text-[9px] text-[#526157]">
            <span className="sr-only">{ariaLabel}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent outline-none">
                {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
            </select>
            <ChevronDown size={12} className="shrink-0 text-[#7a8d82]" />
        </label>
    );
}

function RangeSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: [T, string][] }) {
    return (
        <select value={value} onChange={(event) => onChange(event.target.value as T)} aria-label="Chart date range" className="max-w-20 rounded-md border border-[#e1e9e3] bg-white px-1.5 py-1 text-[8px] text-[#5e7466] outline-none">
            {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
        </select>
    );
}

function OrderDetails({ order, busy, actionError, onClose, onUpdate }: { order: Order; busy: boolean; actionError: string; onClose: () => void; onUpdate: (status: OrderStatus) => void }) {
    const [nextStatus, setNextStatus] = useState<OrderStatus>(order.status as OrderStatus);
    const stepsIndex = statusSteps.indexOf(order.status as OrderStatus);
    const address = order.shipping_address;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10271b]/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#e3e9e5] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-[#edf1ee] p-4">
                    <div><h2 id="order-detail-title" className="text-base font-bold text-[#26382d]">Order #{order.order_number}</h2><p className="mt-1 text-[10px] text-[#7c8981]">{new Date(order.created_at).toLocaleString()}</p></div>
                    <button type="button" aria-label="Close order details" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8e4] text-[#68766d]"><X size={15} /></button>
                </div>
                <div className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold capitalize ${statusClass(order.status)}`}>Order: {order.status}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold capitalize ${statusClass(order.payment_status)}`}>Payment: {order.payment_status}</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Detail label="Customer" value={order.user?.name ?? 'Guest customer'} /><Detail label="Email" value={order.user?.email ?? 'No email'} />
                        <Detail label="Shop" value={[...new Set(order.items?.map((item) => item.shop?.name).filter(Boolean))].join(', ') || 'Marketplace'} />
                        <Detail label="Payment method" value={order.payment_method ?? 'Not specified'} />
                        {address && <Detail label="Shipping address" value={Object.values(address).filter(Boolean).join(', ')} />}
                    </div>
                    <div>
                        <h3 className="mb-2 text-[10px] font-bold text-[#43574a]">Products</h3>
                        <div className="divide-y divide-[#edf1ee] rounded-lg border border-[#edf1ee]">
                            {order.items?.map((item, index) => {
                                const image = item.product?.images?.find((entry) => entry.is_primary) ?? item.product?.images?.[0];
                                return <div key={item.id ?? index} className="flex items-center gap-2.5 p-2.5">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#edf4ef] text-[#52725c]">{image ? <img src={imageUrl(image.path)} alt={item.product?.name ?? 'Product'} className="h-full w-full object-cover" /> : <Package size={14} />}</span>
                                    <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-[#405449]">{item.product?.name ?? 'Product'}</p><p className="mt-0.5 text-[8px] text-[#829087]">{item.variant?.name ? `${item.variant.name} · ` : ''}Qty {item.quantity} · {money(item.unit_price)}</p></div>
                                    <strong className="text-[10px] text-[#405449]">{money(item.total_price ?? Number(item.unit_price ?? 0) * item.quantity)}</strong>
                                </div>;
                            })}
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3"><Detail label="Subtotal" value={money(order.subtotal ?? order.total)} /><Detail label="Shipping" value={money(order.shipping_fee)} /><Detail label="Total" value={money(order.total)} /></div>
                    <div>
                        <h3 className="mb-2 text-[10px] font-bold text-[#43574a]">Order timeline</h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {statusSteps.map((step, index) => {
                                const reached = order.status === 'cancelled' ? false : stepsIndex >= index;
                                const current = order.status === step;
                                return <div key={step} className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-[8px] capitalize ${current ? 'border-[#a8d6b8] bg-[#edf8f1] text-[#267b49]' : reached ? 'border-[#d9ebdf] text-[#568166]' : 'border-[#edf1ee] text-[#9aa59e]'}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${reached ? 'bg-[#27925b] text-white' : 'bg-[#edf1ee]'}`}>{reached ? <Check size={10} /> : index + 1}</span>{step}</div>;
                            })}
                        </div>
                        {order.status === 'cancelled' && <p className="mt-2 text-[9px] font-semibold text-[#bd5144]">This order was cancelled.</p>}
                    </div>
                    {actionError && <p role="alert" className="rounded-lg bg-[#fff4f2] px-3 py-2 text-[9px] text-[#a64135]">{actionError}</p>}
                    <div className="flex flex-col justify-end gap-2 border-t border-[#edf1ee] pt-3 sm:flex-row sm:items-center">
                        <div className="mr-auto flex gap-2">
                            <Link href="/admin/customers" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dfe7e1] px-2.5 text-[9px] font-semibold text-[#557060] hover:bg-[#f5faf6]"><Users size={12} /> View customer</Link>
                            <Link href="/admin/sellers" className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dfe7e1] px-2.5 text-[9px] font-semibold text-[#557060] hover:bg-[#f5faf6]"><ShoppingBag size={12} /> View shop</Link>
                        </div>
                        <label className="flex items-center gap-2 text-[9px] text-[#68766d]">Update order status
                            <select disabled={busy} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as OrderStatus)} className="rounded-lg border border-[#dfe7e1] bg-white px-2 py-2 text-[10px] capitalize">
                                {statuses.filter((status) => status !== 'delivered' || order.status === 'delivered').map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </label>
                        <button type="button" disabled={busy || nextStatus === order.status} onClick={() => onUpdate(nextStatus)} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#188747] px-3 text-[10px] font-semibold text-white hover:bg-[#126d39] disabled:cursor-not-allowed disabled:bg-[#e5ece7] disabled:text-[#8b998d]">{busy ? 'Updating…' : 'Update status'}</button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="min-w-0 rounded-lg border border-[#edf1ee] p-2.5"><p className="text-[8px] font-semibold uppercase text-[#89948d]">{label}</p><p className="mt-1 break-words text-[10px] text-[#36483d]">{value}</p></div>;
}
