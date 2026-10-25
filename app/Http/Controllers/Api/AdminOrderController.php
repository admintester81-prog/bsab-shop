<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\VoucherService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = Order::query()
            ->with([
                'user:id,name,email',
                'items.shop:id,name',
                'items.product:id,name',
                'items.product.images:id,product_id,path,is_primary',
                'items.variant:id,product_id,name,sku',
                'payments',
            ]);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('payment_status') && $request->payment_status !== 'all') {
            $query->where('payment_status', $request->string('payment_status'));
        }

        if ($request->filled('date') && $request->date !== 'all') {
            if ($request->date === 'today') {
                $query->whereDate('created_at', today());
            } elseif ($request->date === '7_days') {
                $query->where('created_at', '>=', now()->startOfDay()->subDays(6));
            } elseif ($request->date === '30_days') {
                $query->where('created_at', '>=', now()->startOfDay()->subDays(29));
            } elseif ($request->date === 'this_year') {
                $query->where('created_at', '>=', now()->startOfYear());
            }
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(function ($orderQuery) use ($search) {
                $orderQuery->where('order_number', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($userQuery) => $userQuery
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('items.product', fn ($productQuery) => $productQuery->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items.shop', fn ($shopQuery) => $shopQuery->where('name', 'like', "%{$search}%"));
            });
        }

        match ($request->input('sort', 'newest')) {
            'oldest' => $query->oldest(),
            'highest_total' => $query->orderByDesc('total')->orderByDesc('created_at'),
            'lowest_total' => $query->orderBy('total')->orderByDesc('created_at'),
            default => $query->latest(),
        };

        $orders = $query->paginate(20)->withQueryString();
        $statusCounts = Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');
        $paymentCounts = Order::query()
            ->selectRaw('payment_status, COUNT(*) as total')
            ->groupBy('payment_status')
            ->pluck('total', 'payment_status');

        return response()->json(array_merge($orders->toArray(), [
            'stats' => [
                'total' => Order::query()->count(),
                'today' => Order::query()->whereDate('created_at', today())->count(),
                'in_progress' => Order::query()->whereIn('status', ['pending', 'processing', 'accepted', 'shipped'])->count(),
                'revenue' => round((float) Order::query()->sum('total'), 2),
                'statuses' => collect(['pending', 'processing', 'accepted', 'shipped', 'delivered', 'cancelled'])
                    ->map(fn (string $status) => ['status' => $status, 'total' => (int) $statusCounts->get($status, 0)])
                    ->values(),
                'payments' => collect(['pending', 'paid', 'failed'])
                    ->map(fn (string $status) => ['status' => $status, 'total' => (int) $paymentCounts->get($status, 0)])
                    ->values(),
            ],
            'overview_chart' => $this->chartData((string) $request->input('overview_range', '30_days'), false),
            'revenue_chart' => $this->chartData((string) $request->input('revenue_range', '30_days'), true),
            'recent_activity' => Order::query()
                ->with('user:id,name')
                ->latest()
                ->limit(5)
                ->get(['id', 'order_number', 'user_id', 'status', 'created_at']),
        ]));
    }

    public function update(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'processing', 'accepted', 'shipped', 'delivered', 'cancelled'])],
        ]);

        DB::transaction(function () use ($order, $data) {
            $lockedOrder = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $delivery = $lockedOrder->delivery()->lockForUpdate()->first();
            if ($data['status'] === 'delivered') {
                abort_unless($delivery?->status === 'completed', 422, 'Customer confirmation is required before completing this order.');
            }
            if ($delivery && in_array($delivery->status, ['ready', 'in_transit', 'arrived', 'delivered', 'completed'], true)) {
                abort_unless($data['status'] === $lockedOrder->status, 422, 'An active delivery cannot be moved to another order status.');
            }

            $lockedOrder->update(['status' => $data['status']]);
            $lockedOrder->items()->update([
                'fulfillment_status' => $data['status'] === 'pending'
                    ? 'processing'
                    : $data['status'],
            ]);

            if ($data['status'] === 'cancelled') {
                app(VoucherService::class)->releaseUsageForCancelledOrder($lockedOrder);
            }
        });

        return response()->json($order->fresh()->load([
            'user:id,name,email',
            'items.shop:id,name',
            'items.product:id,name',
            'items.product.images:id,product_id,path,is_primary',
            'items.variant:id,product_id,name,sku',
            'payments',
        ]));
    }

    private function chartData(string $range, bool $revenue): array
    {
        if ($range === 'today') {
            $start = now()->startOfDay();
            $orders = Order::query()
                ->whereBetween('created_at', [$start, now()])
                ->get(['created_at', 'total', 'status']);

            return collect(range(0, 23))->map(function (int $hour) use ($orders, $revenue) {
                $matching = $orders->filter(fn (Order $order) => $order->created_at->hour === $hour);

                return [
                    'label' => Carbon::createFromTime($hour)->format('g A'),
                    'value' => $revenue
                        ? round((float) $matching->sum(fn (Order $order) => (float) $order->total), 2)
                        : $matching->count(),
                    'pending' => $matching->where('status', 'pending')->count(),
                    'processing' => $matching->where('status', 'processing')->count(),
                    'accepted' => $matching->where('status', 'accepted')->count(),
                    'shipped' => $matching->where('status', 'shipped')->count(),
                    'delivered' => $matching->where('status', 'delivered')->count(),
                ];
            })->all();
        }

        $days = match ($range) {
            '7_days' => 7,
            '3_months' => 90,
            'this_year' => 365,
            default => 30,
        };
        $start = now()->startOfDay()->subDays($days - 1);
        $rows = Order::query()
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as date, status, COUNT(*) as orders, SUM(total) as revenue')
            ->groupBy('date', 'status')
            ->get()
            ->groupBy('date');

        return collect(range(0, $days - 1))->map(function (int $offset) use ($start, $rows, $revenue) {
            $date = $start->copy()->addDays($offset);
            $dailyRows = $rows->get($date->toDateString(), collect());
            $counts = $dailyRows->keyBy('status');

            return [
                'label' => $date->format('M j'),
                'value' => $revenue
                    ? round((float) $dailyRows->sum('revenue'), 2)
                    : (int) $dailyRows->sum('orders'),
                'pending' => (int) ($counts->get('pending')->orders ?? 0),
                'processing' => (int) ($counts->get('processing')->orders ?? 0),
                'accepted' => (int) ($counts->get('accepted')->orders ?? 0),
                'shipped' => (int) ($counts->get('shipped')->orders ?? 0),
                'delivered' => (int) ($counts->get('delivered')->orders ?? 0),
            ];
        })->all();
    }
}
