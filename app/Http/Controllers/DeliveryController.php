<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\DeliveryEvent;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Notifications\DeliveryStatusUpdated;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class DeliveryController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $role = $user->role;
        abort_unless(in_array($role, ['admin', 'seller', 'rider', 'customer'], true), 403);

        $shopId = $role === 'seller' ? $user->shop?->id : null;
        if ($role === 'seller' && ! $shopId) {
            $deliveries = collect();
        } else {
            $deliveries = Delivery::query()
                ->when($role === 'rider', fn ($query) => $query->where('rider_id', $user->id))
                ->when($role === 'customer', fn ($query) => $query->whereHas('order', fn ($order) => $order->where('user_id', $user->id)))
                ->when($role === 'seller', fn ($query) => $query->whereHas('order.items', fn ($items) => $items->where('shop_id', $shopId)))
                ->with([
                    'rider:id,name,phone',
                    'order.user:id,name,phone',
                    'order.items' => fn ($query) => $query
                        ->when($role === 'seller', fn ($items) => $items->where('shop_id', $shopId))
                        ->with(['product:id,name', 'product.images:id,product_id,path,is_primary', 'shop:id,name']),
                    'events.actor:id,name',
                ])
                ->latest('updated_at')
                ->get();
        }

        $readyOrders = collect();
        $riders = collect();
        $sellerOrders = collect();
        if ($role === 'seller' && $shopId) {
            $sellerOrders = OrderItem::query()
                ->where('shop_id', $shopId)
                ->with(['product.images', 'order.user:id,name', 'order.delivery.rider:id,name'])
                ->latest()
                ->get()
                ->map(function (OrderItem $item) use ($shopId) {
                    $delivery = $item->order?->delivery;
                    $image = $item->product?->images->firstWhere('is_primary', true) ?? $item->product?->images->first();
                    $status = match ($delivery?->status) {
                        'in_transit' => 'in_transit',
                        'arrived', 'delivered' => 'arrived',
                        'completed' => 'delivered',
                        'failed' => 'failed',
                        default => 'processing',
                    };

                    return [
                        'id' => $item->id,
                        'delivery_id' => $delivery?->id,
                        'order_number' => $item->order?->order_number,
                        'product' => $item->product?->name ?? 'Product',
                        'image' => $image?->path ? (str_starts_with($image->path, 'http') || str_starts_with($image->path, '/') ? $image->path : '/storage/'.$image->path) : null,
                        'quantity' => $item->quantity,
                        'total' => $item->total_price,
                        'customer' => $item->order?->user?->name ?? 'Customer',
                        'status' => $status,
                        'rider' => $delivery?->rider?->name,
                        'proof_url' => $delivery?->proof_path ? route('delivery-list.proof', $delivery) : null,
                        'updated_at' => ($delivery?->updated_at ?? $item->updated_at)?->toIso8601String(),
                    ];
                });
        }

        if ($role === 'admin') {
            $readyOrders = Order::query()
                ->whereNotIn('status', ['cancelled', 'declined'])
                ->whereHas('items', fn ($query) => $query->where('fulfillment_status', 'shipped'))
                ->whereDoesntHave('items', fn ($query) => $query->whereNotIn('fulfillment_status', ['shipped', 'cancelled']))
                ->whereDoesntHave('delivery', fn ($query) => $query->whereNotIn('status', ['ready', 'failed']))
                ->with(['user:id,name,phone', 'items.product:id,name', 'items.product.images:id,product_id,path,is_primary', 'delivery.rider:id,name'])
                ->latest()
                ->get()
                ->map(fn (Order $order) => [
                    'id' => $order->id,
                    'number' => $order->order_number,
                    'customer' => $order->user?->name ?? 'Customer',
                    'address' => $this->addressText($order->shipping_address),
                    'instructions' => $order->shipping_address['delivery_instructions'] ?? null,
                    'items' => $order->items->map(fn ($item) => [
                        'name' => $item->product?->name ?? 'Product',
                        'quantity' => $item->quantity,
                    ])->values(),
                ]);
            $riders = User::query()
                ->where('role', 'rider')
                ->where(fn ($query) => $query->whereNull('status')->orWhere('status', 'active'))
                ->orderBy('name')
                ->get(['id', 'name']);
        }

        $mappedDeliveries = $deliveries->map(fn (Delivery $delivery) => $this->deliveryData($delivery, $role, $shopId));

        return Inertia::render('delivery-list', [
            'role' => $role,
            'shopName' => $user->shop?->name,
            'deliveries' => $mappedDeliveries,
            'sellerOrders' => $sellerOrders,
            'readyOrders' => $readyOrders,
            'riders' => $riders,
            'stats' => [
                'total' => $mappedDeliveries->count(),
                'in_transit' => $mappedDeliveries->where('status', 'in_transit')->count(),
                'delivered' => $mappedDeliveries->whereIn('status', ['delivered', 'completed'])->count(),
                'failed' => $mappedDeliveries->where('status', 'failed')->count(),
            ],
        ]);
    }

    public function assign(Request $request, Order $order): RedirectResponse
    {
        $this->requireRole($request, 'admin');
        $data = $request->validate(['rider_id' => ['required', 'integer', 'exists:users,id']]);

        $rider = User::query()
            ->whereKey($data['rider_id'])
            ->where('role', 'rider')
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', 'active'))
            ->firstOrFail();

        $delivery = DB::transaction(function () use ($order, $rider, $request) {
            $lockedOrder = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            abort_if(in_array($lockedOrder->status, ['cancelled', 'declined'], true), 422, 'This order cannot be dispatched.');
            abort_unless(
                $lockedOrder->items()->exists()
                    && $lockedOrder->items()->where('fulfillment_status', 'shipped')->exists()
                    && ! $lockedOrder->items()->whereNotIn('fulfillment_status', ['shipped', 'cancelled'])->exists(),
                422,
                'All active order items must be ready for delivery before dispatch.',
            );

            $delivery = Delivery::query()->where('order_id', $lockedOrder->id)->lockForUpdate()->first();
            abort_if($delivery && ! in_array($delivery->status, ['ready', 'failed'], true), 422, 'This delivery is already in progress.');

            $delivery ??= new Delivery(['order_id' => $lockedOrder->id]);
            $delivery->fill([
                'rider_id' => $rider->id,
                'status' => 'ready',
                'assigned_at' => now(),
                'started_at' => null,
                'arrived_at' => null,
                'submitted_at' => null,
                'confirmed_at' => null,
                'failed_at' => null,
                'proof_path' => null,
                'failure_reason' => null,
            ]);
            $delivery->save();
            $this->event($delivery, $request->user(), 'ready', "Assigned to {$rider->name}.");

            return $delivery->load('order.user', 'order.items.shop.user');
        });

        $this->notifyDelivery($delivery, 'ready', $request->user());

        return back()->with('success', 'Rider assigned and delivery is ready to start.');
    }

    public function start(Request $request, Delivery $delivery): RedirectResponse
    {
        $delivery = $this->changeDelivery($request, $delivery, ['ready'], 'in_transit', function (Delivery $delivery) {
            $delivery->started_at = now();
        });
        $this->notifyDelivery($delivery, 'in_transit', $request->user());

        return back()->with('success', 'Delivery started.');
    }

    public function arrive(Request $request, Delivery $delivery): RedirectResponse
    {
        $delivery = $this->changeDelivery($request, $delivery, ['in_transit'], 'arrived', function (Delivery $delivery) {
            $delivery->arrived_at = now();
        });
        $this->notifyDelivery($delivery, 'arrived', $request->user());

        return back()->with('success', 'Arrival recorded. Capture a delivery photo to submit.');
    }

    public function submit(Request $request, Delivery $delivery): RedirectResponse
    {
        $this->requireAssignedRider($request, $delivery);
        $data = $request->validate([
            'proof' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $delivery = DB::transaction(function () use ($delivery, $data, $request) {
            $locked = Delivery::query()->whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === 'arrived', 422, 'Mark the delivery as arrived before submitting proof.');
            $path = Storage::disk('local')->putFileAs(
                'delivery-proofs',
                $data['proof'],
                Str::uuid().'.'.$data['proof']->guessExtension(),
            );
            if (! $path) {
                throw new RuntimeException('The delivery photo could not be stored.');
            }

            $locked->fill(['status' => 'delivered', 'proof_path' => $path, 'submitted_at' => now()]);
            $locked->save();
            $this->event($locked, $request->user(), 'delivered', 'Delivery photo submitted.', $path);

            return $locked->load('order.user', 'order.items.shop.user');
        });

        $this->notifyDelivery($delivery, 'delivered', $request->user());

        return back()->with('success', 'Delivery photo submitted. The customer can now confirm receipt.');
    }

    public function fail(Request $request, Delivery $delivery): RedirectResponse
    {
        $this->requireAssignedRider($request, $delivery);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:1000']]);
        $delivery = $this->changeDelivery($request, $delivery, ['in_transit', 'arrived'], 'failed', function (Delivery $delivery) use ($data) {
            $delivery->failed_at = now();
            $delivery->failure_reason = $data['reason'];
        }, $data['reason']);
        $this->notifyDelivery($delivery, 'failed', $request->user());

        return back()->with('success', 'The failed delivery has been recorded.');
    }

    public function confirmReceived(Request $request, Delivery $delivery): RedirectResponse
    {
        $this->requireRole($request, 'customer');
        abort_unless($delivery->order()->where('user_id', $request->user()->id)->exists(), 403);
        $delivery = DB::transaction(function () use ($delivery, $request) {
            $order = Order::query()->whereKey($delivery->order_id)->lockForUpdate()->firstOrFail();
            $locked = Delivery::query()->whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            abort_unless($order->user_id === $request->user()->id, 403);
            abort_unless($locked->status === 'delivered' && $locked->proof_path, 422, 'A delivery photo must be submitted before confirming receipt.');
            $locked->fill(['status' => 'completed', 'confirmed_at' => now()]);
            $locked->save();
            $order->update(['status' => 'delivered']);
            $order->items()->where('fulfillment_status', '!=', 'cancelled')->update(['fulfillment_status' => 'delivered']);
            $this->event($locked, $request->user(), 'completed', 'Customer confirmed receipt.');

            return $locked->setRelation('order', $order->load('user', 'items.shop.user'));
        });

        $this->notifyDelivery($delivery, 'completed', $request->user());

        return back()->with('success', 'Receipt confirmed. This order is now complete.');
    }

    public function reject(Request $request, Delivery $delivery): RedirectResponse
    {
        $this->requireRole($request, 'customer');
        abort_unless($delivery->order()->where('user_id', $request->user()->id)->exists(), 403);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:1000']]);
        $delivery = $this->changeDelivery($request, $delivery, ['delivered'], 'failed', function (Delivery $delivery) use ($data) {
            $delivery->failed_at = now();
            $delivery->failure_reason = 'Customer rejected receipt: '.$data['reason'];
        }, 'Customer rejected receipt: '.$data['reason'], true);
        $this->notifyDelivery($delivery, 'failed', $request->user());

        return back()->with('success', 'Your delivery concern has been sent to the shop and support team.');
    }

    public function proof(Request $request, Delivery $delivery)
    {
        $this->authorizeDeliveryRead($request->user(), $delivery);
        $eventId = $request->integer('event');
        $path = $eventId
            ? $delivery->events()->whereKey($eventId)->whereNotNull('proof_path')->value('proof_path')
            : $delivery->proof_path;

        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), [
            'Content-Type' => mime_content_type(Storage::disk('local')->path($path)) ?: 'application/octet-stream',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function deliveryData(Delivery $delivery, string $role, ?int $shopId): array
    {
        $order = $delivery->order;
        $items = $order->items;

        return [
            'id' => $delivery->id,
            'status' => $delivery->status,
            'failure_reason' => $delivery->failure_reason,
            'assigned_at' => $delivery->assigned_at?->toIso8601String(),
            'started_at' => $delivery->started_at?->toIso8601String(),
            'arrived_at' => $delivery->arrived_at?->toIso8601String(),
            'submitted_at' => $delivery->submitted_at?->toIso8601String(),
            'confirmed_at' => $delivery->confirmed_at?->toIso8601String(),
            'failed_at' => $delivery->failed_at?->toIso8601String(),
            'proof_url' => $delivery->proof_path ? route('delivery-list.proof', $delivery) : null,
            'rider' => $delivery->rider ? ['id' => $delivery->rider->id, 'name' => $delivery->rider->name, 'phone' => $delivery->rider->phone] : null,
            'order' => [
                'id' => $order->id,
                'number' => $order->order_number,
                'total' => in_array($role, ['admin', 'rider', 'customer'], true) ? $order->total : null,
                'address' => in_array($role, ['admin', 'rider', 'customer'], true) ? $this->addressText($order->shipping_address) : null,
                'instructions' => in_array($role, ['admin', 'rider', 'customer'], true) ? ($order->shipping_address['delivery_instructions'] ?? null) : null,
                'eta' => in_array($role, ['admin', 'rider', 'customer'], true) ? ($order->shipping_address['delivery_estimate'] ?? null) : null,
                'customer' => $order->user ? [
                    'name' => $order->user->name,
                    'phone' => in_array($role, ['admin', 'rider'], true) ? $order->user->phone : null,
                ] : null,
                'items' => $items->map(function ($item) {
                    $image = $item->product?->images->firstWhere('is_primary', true) ?? $item->product?->images->first();

                    return [
                        'name' => $item->product?->name ?? 'Product',
                        'shop' => $item->shop?->name,
                        'quantity' => $item->quantity,
                        'total' => $item->total_price,
                        'image' => $image?->path ? (str_starts_with($image->path, 'http') || str_starts_with($image->path, '/') ? $image->path : '/storage/'.$image->path) : null,
                    ];
                })->values(),
            ],
            'events' => $delivery->events->map(fn (DeliveryEvent $event) => [
                'id' => $event->id,
                'status' => $event->status,
                'note' => $event->note,
                'actor' => $event->actor?->name,
                'at' => $event->created_at?->toIso8601String(),
                'proof_url' => $event->proof_path ? route('delivery-list.proof', ['delivery' => $delivery, 'event' => $event->id]) : null,
            ])->values(),
        ];
    }

    private function addressText(?array $address): string
    {
        if (! $address) {
            return 'Delivery address unavailable';
        }

        return collect(['house_number', 'line1', 'line2', 'barangay', 'city', 'province', 'postal_code'])
            ->map(fn (string $key) => $address[$key] ?? null)
            ->filter(fn ($value) => is_string($value) && trim($value) !== '')
            ->values()
            ->implode(', ')
            ?: 'Delivery address unavailable';
    }

    private function changeDelivery(Request $request, Delivery $delivery, array $allowedStatuses, string $nextStatus, callable $update, ?string $note = null, bool $allowCustomer = false): Delivery
    {
        if ($allowCustomer) {
            abort_unless($request->user()->role === 'customer' && $delivery->order()->where('user_id', $request->user()->id)->exists(), 403);
        } else {
            $this->requireAssignedRider($request, $delivery);
        }

        return DB::transaction(function () use ($request, $delivery, $allowedStatuses, $nextStatus, $update, $note) {
            $locked = Delivery::query()->whereKey($delivery->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->status, $allowedStatuses, true), 422, 'This delivery status has already changed.');
            $update($locked);
            $locked->status = $nextStatus;
            $locked->save();
            $this->event($locked, $request->user(), $nextStatus, $note);

            return $locked->load('order.user', 'order.items.shop.user');
        });
    }

    private function event(Delivery $delivery, User $actor, string $status, ?string $note = null, ?string $proofPath = null): void
    {
        $delivery->events()->create([
            'actor_id' => $actor->id,
            'status' => $status,
            'note' => $note,
            'proof_path' => $proofPath,
            'created_at' => now(),
        ]);
    }

    private function notifyDelivery(Delivery $delivery, string $status, User $actor): void
    {
        $delivery->loadMissing('order.items.shop.user', 'order.user', 'rider');
        $order = $delivery->order;
        $recipients = collect([$order->user, $delivery->rider])
            ->merge($order->items->map(fn ($item) => $item->shop?->user))
            ->merge(User::query()->where('role', 'admin')->get())
            ->filter()
            ->unique('id')
            ->reject(fn (User $recipient) => $recipient->is($actor));
        $labels = [
            'ready' => ['Rider assigned', 'A rider has been assigned to your order.'],
            'in_transit' => ['Order in transit', 'Your order is on its way to the delivery address.'],
            'arrived' => ['Rider arrived', 'The rider has arrived at the delivery address.'],
            'delivered' => ['Delivery photo submitted', 'The rider submitted a delivery photo. Please confirm receipt in your orders.'],
            'completed' => ['Order completed', 'The customer confirmed receipt of the delivered order.'],
            'failed' => ['Delivery needs attention', $delivery->failure_reason ?: 'The delivery could not be completed.'],
        ];
        [$title, $message] = $labels[$status];
        Notification::send($recipients, new DeliveryStatusUpdated($title, $message, $order->order_number, $status));
    }

    private function authorizeDeliveryRead(User $user, Delivery $delivery): void
    {
        if ($user->role === 'admin') {
            return;
        }
        if ($user->role === 'rider' && $delivery->rider_id === $user->id) {
            return;
        }
        if ($user->role === 'customer' && $delivery->order()->where('user_id', $user->id)->exists()) {
            return;
        }
        if ($user->role === 'seller' && $user->shop && $delivery->order()->whereHas('items', fn ($query) => $query->where('shop_id', $user->shop->id))->exists()) {
            return;
        }

        abort(403);
    }

    private function requireAssignedRider(Request $request, Delivery $delivery): void
    {
        abort_unless($request->user()->role === 'rider' && $delivery->rider_id === $request->user()->id, 403);
    }

    private function requireRole(Request $request, string $role): void
    {
        abort_unless($request->user()->role === $role, 403);
    }
}
