<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use Illuminate\Http\Request;

class CustomerProductReviewController extends Controller
{
    public function store(Request $request, OrderItem $item)
    {
        abort_unless($item->order()->where('user_id', $request->user()->id)->exists(), 403);
        abort_unless($item->fulfillment_status === 'delivered', 422, 'You can rate this product after it has been delivered.');

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
        ]);

        $review = $item->review()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'product_id' => $item->product_id,
                'rating' => $validated['rating'],
            ],
        );

        return response()->json($review);
    }
}
