import { Head } from '@inertiajs/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
	AlertCircle,
	ArrowLeft,
	ArrowUpRight,
	BadgeCheck,
	CalendarDays,
	Check,
	CheckCircle2,
	ChevronDown,
	CircleDollarSign,
	Clock3,
	Copy,
	Download,
	Eye,
	Filter,
	Package,
	Printer,
	QrCode as QrCodeIcon,
	Search,
	ShoppingBag,
	Truck,
	UserRound,
	X,
} from 'lucide-react';
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { PortalLayout } from '@/components/portal-layout';
import { api, getApiErrorMessage, prepareSanctum } from '@/lib/api';

type OrderStatus = 'pending' | 'processing' | 'accepted' | 'declined' | 'shipped' | 'delivered' | 'cancelled';
type SellerOrderItem = {
	id: number;
	quantity: number;
	unit_price: number | string;
	total_price: number | string;
	fulfillment_status: OrderStatus;
	created_at?: string;
	product?: { name?: string; images?: Array<{ path: string; is_primary?: boolean }> };
	order?: {
		id?: number;
		order_number?: string;
		status?: string;
		payment_method?: string;
		payment_status?: string;
		subtotal?: number | string;
		shipping_fee?: number | string;
		discount?: number | string;
		tax?: number | string;
		total?: number | string;
		shipping_address?: string | Record<string, unknown> | null;
		created_at?: string;
		user?: { name?: string; email?: string; phone?: string };
		payments?: Array<{ status?: string; gateway?: string; amount?: number | string }>;
	};
};

type DateRange = 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Range';

const demoOrders: SellerOrderItem[] = [
	{
		id: -1,
		quantity: 1,
		unit_price: 520,
		total_price: 520,
		fulfillment_status: 'processing',
		created_at: '2026-09-29T10:45:00',
		product: { name: 'Electronics Pro' },
		order: { order_number: 'CG-260929-XV5TKO', payment_method: 'GCash', payment_status: 'paid', total: 520, created_at: '2026-09-29T10:45:00', user: { name: 'Joshua Macahipay' } },
	},
	{
		id: -2,
		quantity: 1,
		unit_price: 340,
		total_price: 340,
		fulfillment_status: 'accepted',
		created_at: '2026-09-29T09:32:00',
		product: { name: 'Fashion Essential' },
		order: { order_number: 'CG-260929-XV5TKO', payment_method: 'GCash', payment_status: 'paid', total: 340, created_at: '2026-09-29T09:32:00', user: { name: 'Joshua Macahipay' } },
	},
	{
		id: -3,
		quantity: 1,
		unit_price: 1250,
		total_price: 1250,
		fulfillment_status: 'accepted',
		created_at: '2026-09-28T08:17:00',
		product: { name: 'Electronics Essential' },
		order: { order_number: 'CG-260928-UOJOGA', payment_method: 'GCash', payment_status: 'paid', total: 1250, created_at: '2026-09-28T08:17:00', user: { name: 'Joshua Macahipay' } },
	},
];

const statusColors = ['#e6ad35', '#39a968', '#63b98a', '#4a9bd4', '#248b62', '#d76b70'];

function displayStatus(status: OrderStatus) {
	if (status === 'processing' || status === 'pending') return 'Pending';
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: OrderStatus) {
	if (status === 'processing' || status === 'pending') return 'bg-[#fff4dd] text-[#98640c]';
	if (status === 'accepted' || status === 'delivered') return 'bg-[#e7f5eb] text-[#28784a]';
	if (status === 'shipped') return 'bg-[#e8f3fb] text-[#397dab]';
	if (status === 'declined' || status === 'cancelled') return 'bg-[#faeaea] text-[#a64848]';
	return 'bg-[#edf3f0] text-[#64736a]';
}

function imageUrl(item: SellerOrderItem) {
	const image = item.product?.images?.find((entry) => entry.is_primary) ?? item.product?.images?.[0];
	if (!image?.path) return null;
	if (/^(https?:|\/)/i.test(image.path)) return image.path;
	return `/storage/${image.path}`;
}

function dateLabel(item: SellerOrderItem) {
	const timestamp = item.order?.created_at ?? item.created_at;
	if (!timestamp) return 'Date unavailable';
	return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function amount(value: number | string | undefined) {
	return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value ?? 0));
}

function addressText(address: SellerOrderItem['order'] extends infer O ? O extends { shipping_address?: infer A } ? A : never : never) {
	if (!address) return 'No shipping address provided.';
	if (typeof address === 'string') return address;
	return Object.values(address).filter((value) => typeof value === 'string' && value.trim()).join(', ') || 'No shipping address provided.';
}

export default function SellerOrders() {
	const queryClient = useQueryClient();
	const { data, isLoading, isError } = useQuery({
		queryKey: ['seller-orders'],
		queryFn: async () => (await api.get('/seller/orders')).data,
	});
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [paymentFilter, setPaymentFilter] = useState('all');
	const [dateRange, setDateRange] = useState<DateRange>('Last 30 Days');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [selectedItem, setSelectedItem] = useState<SellerOrderItem | null>(null);
	const [declineItem, setDeclineItem] = useState<SellerOrderItem | null>(null);
	const [actionError, setActionError] = useState('');

	const updateStatus = useMutation({
		mutationFn: async ({ id, status }: { id: number; status: OrderStatus }) => {
			await prepareSanctum();
			return api.patch(`/seller/orders/items/${id}`, { fulfillment_status: status });
		},
		onSuccess: async () => {
			setActionError('');
			setDeclineItem(null);
			setSelectedItem(null);
			await queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
		},
		onError: () => setActionError('Unable to update this order. Please try again.'),
	});

	const fetchedOrders = (data?.data ?? []) as SellerOrderItem[];
	const orders = fetchedOrders.length ? fetchedOrders : demoOrders;
	const pendingCount = orders.filter((item) => ['pending', 'processing'].includes(item.fulfillment_status)).length;
	const acceptedCount = orders.filter((item) => item.fulfillment_status === 'accepted').length;
	const completedCount = orders.filter((item) => item.fulfillment_status === 'delivered').length;

	const filteredOrders = useMemo(() => {
		const now = new Date();
		const start = new Date(now);
		if (dateRange === 'Today') start.setHours(0, 0, 0, 0);
		if (dateRange === 'Last 7 Days') start.setDate(start.getDate() - 6);
		if (dateRange === 'Last 30 Days') start.setDate(start.getDate() - 29);
		const customStart = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
		const customEnd = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

		return orders.filter((item) => {
			const itemStatus = ['processing', 'pending'].includes(item.fulfillment_status) ? 'pending' : item.fulfillment_status;
			const paymentStatus = (item.order?.payment_status ?? item.order?.payments?.[0]?.status ?? 'unknown').toLowerCase();
			const needle = search.trim().toLowerCase();
			const searchable = [item.order?.order_number, item.order?.user?.name, item.order?.user?.email, item.product?.name].join(' ').toLowerCase();
			const createdAt = new Date(item.order?.created_at ?? item.created_at ?? 0);
			const dateMatches = dateRange === 'Custom Range'
				? (!customStart || createdAt >= customStart) && (!customEnd || createdAt <= customEnd)
				: createdAt >= start && createdAt <= now;

			return (!needle || searchable.includes(needle))
				&& (statusFilter === 'all' || itemStatus === statusFilter)
				&& (paymentFilter === 'all' || paymentStatus === paymentFilter)
				&& dateMatches;
		});
	}, [orders, search, statusFilter, paymentFilter, dateRange, dateFrom, dateTo]);

	const chartData = useMemo(() => {
		const now = new Date();
		const rangeStart = new Date(now);
		rangeStart.setHours(0, 0, 0, 0);
		let rangeEnd = now;
		let interval: 'hour' | 'day' | 'month' | 'year' = 'day';

		if (dateRange === 'Last 7 Days') rangeStart.setDate(rangeStart.getDate() - 6);
		if (dateRange === 'Last 30 Days') rangeStart.setDate(rangeStart.getDate() - 29);
		if (dateRange === 'Today') {
			interval = 'hour';
		} else if (dateRange === 'Custom Range') {
			const orderDates = orders.flatMap((item) => {
				const timestamp = item.order?.created_at ?? item.created_at;
				if (!timestamp) return [];
				const date = new Date(timestamp);
				return Number.isNaN(date.getTime()) ? [] : [date];
			});
			const firstOrderDate = orderDates.length
				? new Date(Math.min(...orderDates.map((date) => date.getTime())))
				: now;
			const lastOrderDate = orderDates.length
				? new Date(Math.max(...orderDates.map((date) => date.getTime())))
				: now;
			rangeStart.setTime(dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : firstOrderDate.getTime());
			rangeStart.setHours(0, 0, 0, 0);
			if (dateTo) {
				rangeEnd = new Date(`${dateTo}T23:59:59.999`);
			} else if (lastOrderDate > rangeEnd) {
				rangeEnd = lastOrderDate;
			}

			const dayCount = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
			if (dayCount > 730) interval = 'year';
			else if (dayCount > 90) interval = 'month';
		}

		const bucketKey = (date: Date) => {
			if (interval === 'hour') return `${date.toDateString()} ${date.getHours()}`;
			if (interval === 'month') return `${date.getFullYear()}-${date.getMonth()}`;
			if (interval === 'year') return String(date.getFullYear());
			return date.toDateString();
		};
		const formatLabel = (date: Date) => {
			if (interval === 'hour') return new Intl.DateTimeFormat('en-PH', { hour: 'numeric' }).format(date);
			if (interval === 'month') return new Intl.DateTimeFormat('en-PH', { month: 'short', year: '2-digit' }).format(date);
			if (interval === 'year') return String(date.getFullYear());
			return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(date);
		};

		const buckets: Array<{ date: Date; label: string; key: string }> = [];
		const cursor = new Date(rangeStart);
		if (interval === 'hour') {
			for (let hour = 0; hour < 24; hour += 1) {
				const date = new Date(cursor);
				date.setHours(hour);
				buckets.push({ date, label: formatLabel(date), key: bucketKey(date) });
			}
		} else {
			if (interval === 'month') cursor.setDate(1);
			if (interval === 'year') {
				cursor.setMonth(0, 1);
			}
			cursor.setHours(0, 0, 0, 0);
			while (cursor <= rangeEnd) {
				const date = new Date(cursor);
				buckets.push({ date, label: formatLabel(date), key: bucketKey(date) });
				if (interval === 'year') cursor.setFullYear(cursor.getFullYear() + 1);
				else if (interval === 'month') cursor.setMonth(cursor.getMonth() + 1);
				else cursor.setDate(cursor.getDate() + 1);
			}
		}

		const counts = new Map(buckets.map(({ key }) => [key, {
			Pending: 0,
			Accepted: 0,
			Processing: 0,
			Shipped: 0,
			Delivered: 0,
		}]));
		for (const item of orders) {
			const createdAt = new Date(item.order?.created_at ?? item.created_at ?? 0);
			if (Number.isNaN(createdAt.getTime()) || createdAt < rangeStart || createdAt > rangeEnd) continue;
			const count = counts.get(bucketKey(createdAt));
			if (!count) continue;
			if (['processing', 'pending'].includes(item.fulfillment_status)) count.Pending += 1;
			else if (item.fulfillment_status === 'accepted') count.Accepted += 1;
			else if (item.fulfillment_status === 'in_progress') count.Processing += 1;
			else if (item.fulfillment_status === 'shipped') count.Shipped += 1;
			else if (item.fulfillment_status === 'delivered') count.Delivered += 1;
		}
		return buckets.map(({ label, key }) => ({ label, ...counts.get(key)! }));
	}, [orders, dateRange, dateFrom, dateTo]);

	const chartRangeLabel = dateRange === 'Custom Range'
		? [dateFrom, dateTo].filter(Boolean).join(' – ') || 'Custom Range'
		: dateRange;

	const statusData = [
		{ name: 'Pending', value: pendingCount },
		{ name: 'Accepted', value: acceptedCount },
		{ name: 'Processing', value: orders.filter((item) => item.fulfillment_status === 'in_progress').length },
		{ name: 'Shipped', value: orders.filter((item) => item.fulfillment_status === 'shipped').length },
		{ name: 'Delivered', value: completedCount },
		{ name: 'Cancelled', value: orders.filter((item) => item.fulfillment_status === 'cancelled').length },
	];

	function viewPending() {
		setStatusFilter('pending');
		document.getElementById('seller-orders-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function exportOrders() {
		const rows = [
			['Order ID', 'Product', 'Customer', 'Quantity', 'Amount', 'Status', 'Payment status', 'Date'],
			...filteredOrders.map((item) => [
				item.order?.order_number ?? '',
				item.product?.name ?? '',
				item.order?.user?.name ?? '',
				String(item.quantity),
				String(item.total_price),
				displayStatus(item.fulfillment_status),
				item.order?.payment_status ?? '',
				item.order?.created_at ?? item.created_at ?? '',
			]),
		];
		const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'seller-orders.csv';
		link.click();
		URL.revokeObjectURL(url);
	}

	return (
		<>
			<Head title="Orders Monitoring" />
			<PortalLayout role="seller" title="Orders" eyebrow="Order Monitoring" wideContent>
				<div className="min-w-0 space-y-4">
					<div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<p className="text-xs font-semibold text-[#27774a]">Orders</p>
							<h1 className="mt-1 text-2xl font-bold text-[#1d3327]">Order Monitoring</h1>
							<p className="mt-1 text-sm text-[#728078]">Monitor, review, and manage your incoming seller orders.</p>
						</div>
						<div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px] xl:w-120">
							<label className="flex h-10 items-center gap-2 rounded-lg border border-[#dce5df] bg-white px-3 focus-within:border-[#2a8b52]">
								<Search size={15} className="shrink-0 text-[#748279]" />
								<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, customer, or product..." className="min-w-0 flex-1 bg-transparent text-xs text-[#344238] outline-none placeholder:text-[#99a39d]" />
							</label>
							<label className="flex h-10 items-center gap-2 rounded-lg border border-[#dce5df] bg-white px-3 text-xs text-[#526157]">
								<CalendarDays size={14} className="shrink-0 text-[#577963]" />
								<select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)} className="min-w-0 flex-1 bg-transparent outline-none">
									<option>Today</option><option>Last 7 Days</option><option>Last 30 Days</option><option>Custom Range</option>
								</select>
							</label>
						</div>
					</div>

					{dateRange === 'Custom Range' && (
						<div className="flex flex-wrap gap-2">
							<label className="text-[10px] font-medium text-[#69776e]">From <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="ml-2 h-9 rounded-lg border border-[#dce5df] bg-white px-2 text-xs" /></label>
							<label className="text-[10px] font-medium text-[#69776e]">To <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="ml-2 h-9 rounded-lg border border-[#dce5df] bg-white px-2 text-xs" /></label>
						</div>
					)}

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<SummaryCard icon={ShoppingBag} label="Total Orders" value={orders.length} onClick={() => setStatusFilter('all')} />
						<SummaryCard icon={Clock3} label="Pending" value={pendingCount} tone="amber" onClick={() => setStatusFilter('pending')} />
						<SummaryCard icon={BadgeCheck} label="Accepted" value={acceptedCount} tone="green" onClick={() => setStatusFilter('accepted')} />
						<SummaryCard icon={CheckCircle2} label="Completed" value={completedCount} tone="blue" onClick={() => setStatusFilter('delivered')} />
					</div>

					<section className="flex flex-col gap-3 rounded-xl border border-[#dcebe0] bg-[#f0f8f2] p-3.5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dff1e4] text-[#247648]"><AlertCircle size={18} /></span>
							<div>
								<p className="text-sm font-bold text-[#253b2d]">{orders.length} {orders.length === 1 ? 'order is' : 'orders are'} ready for your attention.</p>
								<p className="mt-0.5 text-[10px] text-[#6e7f73]">Review pending orders and respond to customers.</p>
							</div>
						</div>
						<button type="button" onClick={viewPending} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#b8d6c1] bg-white px-3 text-[11px] font-semibold text-[#267748] hover:bg-[#f8fcf9]">
							View pending orders <ArrowUpRight size={13} />
						</button>
					</section>

					<div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.85fr)]">
						<section id="seller-orders-list" className="min-w-0 rounded-xl border border-[#e4ebe6] bg-white p-4 shadow-[0_3px_13px_rgba(31,70,48,0.045)] sm:p-5">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="text-sm font-bold text-[#25372c]">Recent Orders</h2>
									<p className="mt-0.5 text-[10px] text-[#7d8b82]">Review and manage your latest orders.</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<label className="flex h-9 items-center gap-1.5 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] text-[#59695e]">
										<Filter size={13} className="text-[#64786a]" />
										<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none">
											<option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option>
										</select>
									</label>
									<label className="flex h-9 items-center gap-1.5 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] text-[#59695e]">
										<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="bg-transparent outline-none">
											<option value="all">All payments</option><option value="paid">Paid</option><option value="pending">Payment pending</option><option value="failed">Failed</option>
										</select>
										<ChevronDown size={12} />
									</label>
									<button type="button" onClick={exportOrders} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] font-semibold text-[#4e6255] hover:bg-[#f7faf8]"><Download size={13} /> Export</button>
								</div>
							</div>

							<div className="mt-3 divide-y divide-[#edf1ee]">
								{isLoading ? <p className="py-10 text-center text-xs text-[#748178]">Loading seller orders…</p> : filteredOrders.length ? filteredOrders.map((item) => (
									<OrderRow key={item.id} item={item} updatePending={updateStatus.isPending} onAccept={() => { setActionError(''); updateStatus.mutate({ id: item.id, status: 'accepted' }); }} onDecline={() => { setActionError(''); setDeclineItem(item); }} onDetails={() => { setActionError(''); setSelectedItem(item); }} />
								)) : (
									<p className="py-10 text-center text-xs text-[#748178]">{isError ? 'Unable to load orders right now.' : 'No orders match these filters.'}</p>
								)}
							</div>
							{actionError && <p role="alert" className="mt-3 rounded-lg bg-[#faeaea] px-3 py-2 text-xs font-medium text-[#a64848]">{actionError}</p>}
						</section>

						<div className="min-w-0 space-y-4">
							<section className="rounded-xl border border-[#e4ebe6] bg-white p-4 shadow-[0_3px_13px_rgba(31,70,48,0.045)]">
								<div className="flex items-center justify-between">
									<div><h2 className="text-sm font-bold text-[#25372c]">Order Status</h2><p className="mt-0.5 text-[10px] text-[#7d8b82]">Current order distribution.</p></div>
									<span className="rounded-md border border-[#e6ece8] px-2 py-1 text-[9px] text-[#65746b]">All time</span>
								</div>
								<div className="mt-2 flex items-center gap-2">
									<div className="relative h-36 w-36 shrink-0">
										<ResponsiveContainer width="100%" height="100%">
											<PieChart>
												<Pie data={statusData.filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius={43} outerRadius={65} paddingAngle={2} stroke="white" strokeWidth={2}>
													{statusData.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={statusColors[statusData.indexOf(item)]} />)}
												</Pie>
												<Tooltip formatter={(value) => [value, 'Orders']} contentStyle={{ borderColor: '#dce7df', borderRadius: 8, fontSize: 11 }} />
											</PieChart>
										</ResponsiveContainer>
										<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg font-bold text-[#1d3426]">{orders.length}</strong><span className="text-[9px] text-[#819087]">Total Orders</span></div>
									</div>
									<div className="min-w-0 flex-1 space-y-2">
										{statusData.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-1 text-[10px] text-[#586a5e]"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColors[index] }} /><span className="truncate">{item.name}</span></span><strong className="shrink-0 text-[#34473b]">{item.value}</strong></div>)}
									</div>
								</div>
							</section>

						</div>
					</div>

					<div className="grid min-w-0 gap-4">
						<section className="min-w-0 rounded-xl border border-[#e4ebe6] bg-white p-4 shadow-[0_3px_13px_rgba(31,70,48,0.045)] sm:p-5">
							<div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-[#25372c]">Orders Overview</h2><p className="mt-0.5 text-[10px] text-[#7d8b82]">Order activity for the selected period.</p></div><span className="inline-flex items-center gap-1 rounded-md border border-[#e6ece8] px-2 py-1 text-[9px] text-[#65746b]"><CalendarDays size={11} /> {chartRangeLabel}</span></div>
							<div className="mt-3 h-52 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={chartData} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
										<CartesianGrid stroke="#edf1ee" strokeDasharray="3 4" vertical={false} />
										<XAxis dataKey="label" tick={{ fill: '#819087', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#dfe7e1' }} />
										<YAxis allowDecimals={false} width={28} tick={{ fill: '#819087', fontSize: 9 }} tickLine={false} axisLine={false} />
										<Tooltip contentStyle={{ borderColor: '#dce7df', borderRadius: 8, fontSize: 11 }} />
										<Area type="monotone" dataKey="Pending" stroke="#d6a13a" fill="#f8edd2" strokeWidth={1.5} />
										<Area type="monotone" dataKey="Accepted" stroke="#299359" fill="#e2f3e7" strokeWidth={1.5} />
										<Area type="monotone" dataKey="Processing" stroke="#63aa84" fill="#edf7f0" strokeWidth={1.5} />
										<Area type="monotone" dataKey="Shipped" stroke="#4a9bd4" fill="#e7f2fa" strokeWidth={1.5} />
										<Area type="monotone" dataKey="Delivered" stroke="#267b52" fill="#d9eee1" strokeWidth={1.5} />
									</AreaChart>
								</ResponsiveContainer>
							</div>
						</section>
					</div>
				</div>

				{selectedItem && <OrderDetails item={selectedItem} busy={updateStatus.isPending} onClose={() => setSelectedItem(null)} onUpdate={(status) => updateStatus.mutate({ id: selectedItem.id, status })} />}
				{declineItem && (
					<div className="fixed inset-0 z-70 flex items-center justify-center bg-[#122219]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="decline-order-title">
						<div className="w-full max-w-sm rounded-xl border border-[#e3e9e5] bg-white p-5 shadow-xl">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#faeaea] text-[#a64848]"><AlertCircle size={18} /></div>
							<h2 id="decline-order-title" className="mt-3 text-base font-bold text-[#26382d]">Decline this order?</h2>
							<p className="mt-1 text-xs leading-5 text-[#758179]">Are you sure you want to decline this order?</p>
							{actionError && <p role="alert" className="mt-3 text-xs text-[#a64848]">{actionError}</p>}
							<div className="mt-5 flex justify-end gap-2">
								<button type="button" onClick={() => setDeclineItem(null)} className="rounded-lg border border-[#dce5df] px-3 py-2 text-xs font-semibold text-[#526157]">Cancel</button>
								<button type="button" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: declineItem.id, status: 'declined' })} className="rounded-lg bg-[#a64848] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Decline Order</button>
							</div>
						</div>
					</div>
				)}
			</PortalLayout>
		</>
	);
}

function SummaryCard({ icon: Icon, label, value, tone = 'green', onClick }: { icon: typeof Package; label: string; value: number; tone?: 'green' | 'amber' | 'blue'; onClick: () => void }) {
	const colors = tone === 'amber' ? 'bg-[#fff3d9] text-[#a26d14]' : tone === 'blue' ? 'bg-[#e8f3fb] text-[#377dad]' : 'bg-[#e8f5ec] text-[#28784a]';
	return (
		<button type="button" onClick={onClick} className="min-w-0 rounded-xl border border-[#e4ebe6] bg-white p-3 text-left shadow-[0_3px_12px_rgba(31,70,48,0.035)] transition hover:border-[#c5ddcc]">
			<div className="flex items-start justify-between gap-2"><span className="text-[10px] font-medium text-[#748178]">{label}</span><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors}`}><Icon size={15} /></span></div>
			<p className="mt-1 text-xl font-bold text-[#20352a]">{value}</p>
			<span className="mt-1 block text-[9px] text-[#849188]">Current orders</span>
		</button>
	);
}

function OrderRow({ item, updatePending, onAccept, onDecline, onDetails }: { item: SellerOrderItem; updatePending: boolean; onAccept: () => void; onDecline: () => void; onDetails: () => void }) {
	const actionable = ['pending', 'processing'].includes(item.fulfillment_status);
	const paymentStatus = item.order?.payment_status ?? item.order?.payments?.[0]?.status ?? 'Unknown';
	return (
		<div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e5ebe7] bg-[#f4f8f5] text-[#487259]">
					{imageUrl(item) ? <img src={imageUrl(item) || ''} alt={item.product?.name ?? 'Order product'} className="h-full w-full object-cover" /> : <Package size={21} />}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-bold text-[#293b30]">{item.product?.name ?? 'Order item'}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusTone(item.fulfillment_status)}`}>{displayStatus(item.fulfillment_status)}</span></div>
					<p className="mt-1 truncate text-[10px] text-[#718076]">Order #{item.order?.order_number ?? item.order?.id ?? item.id} · {item.quantity} {item.quantity === 1 ? 'item' : 'items'}</p>
					<p className="mt-1 truncate text-[9px] text-[#8a958e]">{item.order?.user?.name ?? 'Customer'} · {dateLabel(item)}</p>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 sm:justify-end">
				<div className="sm:text-right"><p className="text-xs font-bold text-[#2b4033]">{amount(item.total_price)}</p><p className="mt-0.5 text-[9px] text-[#829087]">Payment {paymentStatus}</p></div>
				<div className="flex shrink-0 items-center gap-1.5">
					{actionable && <>
						<button type="button" disabled={updatePending} onClick={onAccept} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#188747] px-2.5 text-[10px] font-semibold text-white hover:bg-[#126d39] disabled:opacity-50"><Check size={12} /> Accept</button>
						<button type="button" disabled={updatePending} onClick={onDecline} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#d99a9a] bg-white px-2.5 text-[10px] font-semibold text-[#a64848] hover:bg-[#fff7f7] disabled:opacity-50"><X size={12} /> Decline</button>
					</>}
					<button type="button" onClick={onDetails} aria-label="View order details" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe7e1] text-[#54705e] hover:bg-[#f5faf6]"><Eye size={14} /></button>
				</div>
			</div>
		</div>
	);
}

function SellerOrderTrackingQrCard({ orderId, orderNumber }: { orderId?: number; orderNumber: string | number }) {
	const [trackingUrl, setTrackingUrl] = useState('');
	const [qrImage, setQrImage] = useState('');
	const [qrError, setQrError] = useState('');
	const [qrLoading, setQrLoading] = useState(Boolean(orderId));
	const [copyMessage, setCopyMessage] = useState('');

	useEffect(() => {
		if (!orderId) {
			setQrLoading(false);
			setQrError('Tracking is unavailable for this order.');
			return;
		}

		let cancelled = false;
		setQrLoading(true);
		setQrError('');
		setQrImage('');

		const url = new URL('/customer/order-tracking', window.location.origin);
		url.searchParams.set('order_id', String(orderId));
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

		return () => {
			cancelled = true;
		};
	}, [orderId]);

	async function copyTrackingUrl() {
		try {
			await navigator.clipboard.writeText(trackingUrl);
			setCopyMessage('Tracking link copied.');
		} catch {
			setCopyMessage('Could not copy the tracking link. Please copy it from the browser address bar.');
		}
	}

	return (
		<section className="rounded-lg border border-[#edf1ee] p-3">
			<div className="mb-3 flex items-center gap-2">
				<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f5ec] text-[#188747]"><QrCodeIcon size={17} /></span>
				<div>
					<h3 className="text-xs font-bold text-[#26382d]">Order Tracking QR Code</h3>
					<p className="mt-0.5 text-[10px] text-[#7c8981]">Scan to open this order’s customer tracking page.</p>
				</div>
			</div>
			<div className="grid items-center gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
				<div className="flex min-h-28 items-center justify-center rounded-lg border border-[#c6ebd4] bg-white p-2 text-center" aria-live="polite">
					{qrLoading ? (
						<span className="text-[10px] text-[#78988f]">Generating QR code…</span>
					) : qrError ? (
						<span className="text-[10px] text-[#a94435]" role="alert">{qrError}</span>
					) : (
						<img src={qrImage} alt="QR code linking to this order's customer tracking page" className="block h-auto w-full max-w-24 [image-rendering:pixelated]" />
					)}
				</div>
				<div className="min-w-0">
					<p className="break-all text-xs font-extrabold text-[#145b52]">{orderNumber}</p>
					<p className="mt-1 text-[10px] text-[#78988f]">Customers must sign in to view order tracking.</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{qrImage && (
							<a href={qrImage} download={`order-${orderNumber}-tracking-qr.png`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5e3d9] px-2.5 py-2 text-[10px] font-semibold text-[#346848] hover:bg-[#f5faf6]">
								<Download size={13} /> Download QR Code
							</a>
						)}
						<button type="button" onClick={copyTrackingUrl} disabled={!trackingUrl} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5e3d9] px-2.5 py-2 text-[10px] font-semibold text-[#346848] hover:bg-[#f5faf6] disabled:opacity-50">
							<Copy size={13} /> Copy Tracking Link
						</button>
					</div>
					{copyMessage && <p className="mt-2 text-[10px] font-semibold text-[#138a55]" role="status">{copyMessage}</p>}
				</div>
			</div>
		</section>
	);
}

function OrderDetails({ item, busy, onClose, onUpdate }: { item: SellerOrderItem; busy: boolean; onClose: () => void; onUpdate: (status: OrderStatus) => void }) {
	const productImage = imageUrl(item);
	const order = item.order;
	const orderNumber = order?.order_number ?? order?.id ?? item.id;
	const paymentMethod = order?.payment_method ?? order?.payments?.[0]?.gateway ?? 'Not available';
	const paymentStatus = order?.payment_status ?? order?.payments?.[0]?.status ?? 'Unknown';
	return (
		<>
			<style>{`
				@media print {
					body * { visibility: hidden !important; }
					#seller-order-invoice, #seller-order-invoice * { visibility: visible !important; }
					#seller-order-invoice {
						display: block !important;
						position: absolute;
						inset: 0 auto auto 0;
						width: 100%;
						padding: 32px;
						color: #17251b;
						background: white;
						font: 12px Arial, sans-serif;
					}
					@page { margin: 12mm; }
				}
			`}</style>
			<div className="fixed inset-0 z-70 flex items-center justify-center bg-[#122219]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
				<div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[#e3e9e5] bg-white shadow-xl">
				<div className="flex items-start justify-between border-b border-[#edf1ee] p-4">
					<div><h2 id="order-detail-title" className="text-base font-bold text-[#26382d]">Order #{orderNumber}</h2><p className="mt-1 text-[10px] text-[#7c8981]">{dateLabel(item)}</p></div>
					<button type="button" onClick={onClose} aria-label="Close order details" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8e4] text-[#68766d]"><X size={15} /></button>
				</div>
				<div className="space-y-4 p-4">
					<div className="flex items-center gap-3 rounded-lg bg-[#f8fbf9] p-3">
						<span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#edf4ef] text-[#52725c]">{productImage ? <img src={productImage} alt={item.product?.name ?? 'Product'} className="h-full w-full object-cover" /> : <Package size={20} />}</span>
						<div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#314438]">{item.product?.name ?? 'Order item'}</p><p className="mt-1 text-[10px] text-[#7e8982]">Quantity {item.quantity} · {amount(item.unit_price)} each</p></div>
						<strong className="text-xs text-[#2c4234]">{amount(item.total_price)}</strong>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<Detail label="Customer" value={order?.user?.name ?? 'Customer'} />
						<Detail label="Contact" value={order?.user?.email ?? order?.user?.phone ?? 'Not available'} />
						<Detail label="Subtotal" value={amount(order?.subtotal)} />
						<Detail label="Shipping" value={amount(order?.shipping_fee)} />
						<Detail label="Total" value={amount(order?.total ?? item.total_price)} />
						<Detail label="Payment method" value={paymentMethod} />
						<Detail label="Payment status" value={paymentStatus} />
						<Detail label="Order status" value={displayStatus(item.fulfillment_status)} />
						<Detail label="Shipping address" value={addressText(order?.shipping_address)} className="sm:col-span-2" />
					</div>
					<SellerOrderTrackingQrCard orderId={order?.id} orderNumber={orderNumber} />
					{busy && <p className="text-xs text-[#718076]">Updating order…</p>}
					<div className="flex flex-wrap justify-end gap-2 border-t border-[#edf1ee] pt-3">
						<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-[#d5e3d9] px-3 py-2 text-xs font-semibold text-[#346848] hover:bg-[#f5faf6]"><Printer size={14} /> Print invoice</button>
						{['pending', 'processing'].includes(item.fulfillment_status) && <>
							<button type="button" disabled={busy} onClick={() => onUpdate('accepted')} className="rounded-lg bg-[#188747] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept Order</button>
							<button type="button" disabled={busy} onClick={() => onUpdate('declined')} className="rounded-lg border border-[#d99a9a] px-3 py-2 text-xs font-semibold text-[#a64848] disabled:opacity-50">Decline</button>
						</>}
					</div>
				</div>
			</div>
			</div>
			<article id="seller-order-invoice" className="hidden">
				<header style={{ borderBottom: '2px solid #267748', paddingBottom: 16, marginBottom: 24 }}>
					<h1 style={{ margin: 0, fontSize: 24 }}>Invoice</h1>
					<p style={{ margin: '8px 0 0', color: '#526157' }}>Order #{orderNumber}</p>
					<p style={{ margin: '4px 0 0', color: '#526157' }}>{dateLabel(item)}</p>
				</header>
				<section style={{ marginBottom: 24 }}>
					<h2 style={{ fontSize: 14 }}>Customer</h2>
					<p>{order?.user?.name ?? 'Customer'}</p>
					<p>{order?.user?.email ?? order?.user?.phone ?? 'Contact not available'}</p>
					<p>{addressText(order?.shipping_address)}</p>
				</section>
				<table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
					<thead>
						<tr>
							<th style={{ borderBottom: '1px solid #cbd5ce', padding: '8px 0', textAlign: 'left' }}>Item</th>
							<th style={{ borderBottom: '1px solid #cbd5ce', padding: '8px 0', textAlign: 'right' }}>Qty</th>
							<th style={{ borderBottom: '1px solid #cbd5ce', padding: '8px 0', textAlign: 'right' }}>Unit price</th>
							<th style={{ borderBottom: '1px solid #cbd5ce', padding: '8px 0', textAlign: 'right' }}>Amount</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td style={{ borderBottom: '1px solid #e5ebe7', padding: '10px 0' }}>{item.product?.name ?? 'Order item'}</td>
							<td style={{ borderBottom: '1px solid #e5ebe7', padding: '10px 0', textAlign: 'right' }}>{item.quantity}</td>
							<td style={{ borderBottom: '1px solid #e5ebe7', padding: '10px 0', textAlign: 'right' }}>{amount(item.unit_price)}</td>
							<td style={{ borderBottom: '1px solid #e5ebe7', padding: '10px 0', textAlign: 'right' }}>{amount(item.total_price)}</td>
						</tr>
					</tbody>
				</table>
				<div style={{ marginLeft: 'auto', maxWidth: 260 }}>
					<p style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><strong>{amount(order?.subtotal ?? item.total_price)}</strong></p>
					<p style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping</span><strong>{amount(order?.shipping_fee)}</strong></p>
					<p style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5ce', paddingTop: 10, fontSize: 15 }}><span>Total</span><strong>{amount(order?.total ?? item.total_price)}</strong></p>
				</div>
				<footer style={{ borderTop: '1px solid #e5ebe7', marginTop: 32, paddingTop: 12, color: '#526157' }}>
					Payment method: {paymentMethod} · Payment status: {paymentStatus}
				</footer>
			</article>
		</>
	);
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
	return <div className={`min-w-0 rounded-lg border border-[#edf1ee] p-2.5 ${className}`}><p className="text-[9px] font-semibold uppercase text-[#89948d]">{label}</p><p className="mt-1 wrap-break-word text-[11px] text-[#36483d]">{value}</p></div>;
}