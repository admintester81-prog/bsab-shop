<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class CustomerOrderController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()->orders()
            ->with(
                'items.product.images',
                'items.shop.user.addresses:id,user_id,line1,barangay,city,province,postal_code,latitude,longitude,is_default',
                'items.variant',
                'items.review',
                'delivery.rider:id,name,phone'
            )
            ->latest()
            ->paginate(20)
            ->through(fn (Order $order) => $this->addTrackingData($order));
    }

    public function show(Request $request, Order $order)
    {
        abort_unless($order->user_id === $request->user()->id, 403);

        $order->load(
            'items.product.images',
            'items.shop.user.addresses:id,user_id,line1,barangay,city,province,postal_code,latitude,longitude,is_default',
            'items.variant',
            'items.review',
            'payments',
            'delivery.rider:id,name,phone'
        );

        return $this->addTrackingData($order);
    }

    private function addTrackingData(Order $order): Order
    {
        $order->items->each(function ($item) {
            $shop = $item->shop;
            if (! $shop) {
                return;
            }

            $seller = $shop->user;
            $address = $seller?->addresses->firstWhere('is_default', true) ?? $seller?->addresses->first();

            $shop->setAttribute('tracking_location', $address ? [
                'latitude' => $address->latitude,
                'longitude' => $address->longitude,
                'label' => implode(', ', array_filter([
                    $address->line1,
                    $address->barangay,
                    $address->city,
                    $address->province,
                    $address->postal_code,
                ])),
            ] : null);
            $shop->unsetRelation('user');
        });

        $delivery = $order->delivery;
        $order->setAttribute('delivery_tracking', $delivery ? [
            'status' => $delivery->status,
            'assigned_at' => $delivery->assigned_at?->toIso8601String(),
            'started_at' => $delivery->started_at?->toIso8601String(),
            'arrived_at' => $delivery->arrived_at?->toIso8601String(),
            'submitted_at' => $delivery->submitted_at?->toIso8601String(),
            'confirmed_at' => $delivery->confirmed_at?->toIso8601String(),
            'proof_url' => $delivery->proof_path ? route('delivery-list.proof', $delivery) : null,
            'rider' => $delivery->rider ? [
                'name' => $delivery->rider->name,
                'phone' => $delivery->rider->phone,
            ] : null,
        ] : null);

        return $order->makeHidden('delivery');
    }
}
