<?php

namespace App\Http\Controllers\AI;

use App\Http\Controllers\Controller;
use App\Services\AIProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProductAIController extends Controller
{
    public function __construct(
        protected AIProductService $aiProductService,
    ) {}

    public function analyze(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['sometimes', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'images' => ['sometimes', 'array'],
            'images.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        if (! $request->user()?->hasRole('seller')) {
            return response()->json([
                'message' => 'Only sellers can analyze products with AI.',
            ], 403);
        }

        $images = array_values(array_filter([
            $request->file('image'),
            ...($request->file('images', []) ?? []),
        ], fn ($file) => $file instanceof \Illuminate\Http\UploadedFile));

        if ($images === []) {
            return response()->json([
                'success' => false,
                'message' => 'Please upload at least one product image before analyzing it with AI.',
            ], 422);
        }

        try {
            $analysis = $this->aiProductService->analyze($images);

            return response()->json([
                'success' => true,
                'data' => $analysis,
            ]);
        } catch (\Throwable $exception) {
            Log::error('AI product analysis failed', [
                'message' => $exception->getMessage(),
                'exception_class' => $exception::class,
                'user_id' => $request->user()?->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage() ?: 'Unable to analyze this image. Please try again or enter the product information manually.',
            ], 422);
        }
    }
}
