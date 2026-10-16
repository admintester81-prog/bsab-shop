<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AIProductService
{
    public function analyze(UploadedFile|array $images): array
    {
        $normalizedImages = is_array($images) ? $images : [$images];

        if ($normalizedImages === []) {
            throw new \RuntimeException('Please upload at least one product image before analyzing it with AI.');
        }

        foreach ($normalizedImages as $image) {
            $mimeType = $image->getMimeType();
            $supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

            if (! $image->isValid() || ! in_array($mimeType, $supportedMimeTypes, true)) {
                throw new \RuntimeException('Invalid image file. Please upload a JPG, JPEG, PNG, or WebP image.');
            }
        }

        $baseUrl = rtrim((string) config('services.ollama.base_url', config('services.ollama.url', 'http://127.0.0.1:11434')), '/');
        $visionModel = trim((string) config('services.ollama.vision_model', 'moondream:1.8b'));
        $timeout = (int) config('services.ollama.timeout', 120);

        if ($visionModel === '') {
            throw new \RuntimeException('Ollama vision model is not configured. Set OLLAMA_VISION_MODEL in your environment.');
        }

        return $this->requestOllamaAnalysis($normalizedImages, $baseUrl, $visionModel, $timeout);
    }

    private function requestOllamaAnalysis(array $images, string $baseUrl, string $model, int $timeout): array
    {
        $phpExecutionLimit = (int) ini_get('max_execution_time');

        if ($phpExecutionLimit !== 0 && $phpExecutionLimit <= $timeout) {
            set_time_limit($timeout + 10);
        }

        $payload = [
            'model' => $model,
            'stream' => false,
            'keep_alive' => '10m',
            'options' => [
                'num_ctx' => 2048,
                'num_predict' => 512,
            ],
            'messages' => [[
                'role' => 'user',
                'content' => $this->buildPrompt(),
                'images' => array_map(fn (UploadedFile $image) => base64_encode($image->getContent()), $images),
            ]],
        ];

        $response = Http::acceptJson()
            ->timeout($timeout)
            ->connectTimeout(10)
            ->post($baseUrl.'/api/chat', $payload);

        if (! $response->successful()) {
            $status = $response->status();
            $message = $this->mapOllamaError($status, $response->body());

            Log::error('Ollama AI Error', [
                'model' => $model,
                'status' => $status,
                'message' => $message,
                'response_body' => $response->body(),
            ]);

            throw new \RuntimeException($message);
        }

        $payload = $response->json();
        $text = $this->extractOllamaResponseText($payload);

        return $this->normalizeAnalysis($this->parseJson($text));
    }

    private function mapOllamaError(int $status, string $responseBody): string
    {
        $normalizedBody = strtolower($responseBody);

        if ($status === 404 || str_contains($normalizedBody, 'model') && str_contains($normalizedBody, 'not found')) {
            return 'Ollama could not find the configured vision model. Pull the model locally or update OLLAMA_VISION_MODEL.';
        }

        if ($status === 0 || str_contains($normalizedBody, 'connection refused') || str_contains($normalizedBody, 'failed to connect')) {
            return 'Ollama is unavailable. Please start the local Ollama service and confirm OLLAMA_BASE_URL is correct.';
        }

        if ($status >= 500) {
            return 'Ollama is temporarily unavailable. Please try again in a moment.';
        }

        if (str_contains($normalizedBody, 'invalid image') || str_contains($normalizedBody, 'unsupported')) {
            return 'The uploaded product image could not be processed by the selected Ollama vision model. Please try a different JPG, PNG, or WebP image.';
        }

        return 'Unable to analyze this image with Ollama right now. Please try again or enter the product information manually.';
    }

    private function buildPrompt(): string
    {
        return <<<'PROMPT'
You are an e-commerce catalog assistant helping a seller prepare product listings from an uploaded product image.

Return only valid JSON that matches this structure:
{
    "name": "string or null",
    "category": "string or null",
    "product_type": "string or null",
    "description": "string or null",
    "colors": ["string"],
    "sizes": ["string"],
    "material": "string or null",
    "brand": "string or null",
    "attributes": {
        "style": "string or null"
    },
    "options": [
        {
            "name": "string",
            "values": ["string"]
        }
    ],
    "tags": ["string"]
}

Rules:
- Only include values that are clearly visible or strongly implied by the image.
- Do not guess business-critical values such as price, stock, shipping fee, or availability.
- Do not hallucinate. If uncertain, use null or an empty array.
- For sizes, only include sizes that are visually identifiable. If the size cannot be determined from the image, leave it empty.
- Keep category broad and realistic (for example: Shoes, Vegetables, Dresses, Electronics, Food, Clothing, Beauty, Home Decor).
- Return only JSON, with no markdown fences or extra explanation.
PROMPT;
    }

    private function extractOllamaResponseText(array $payload): string
    {
        $content = data_get($payload, 'message.content');

        if (is_string($content) && trim($content) !== '') {
            return $content;
        }

        throw new \RuntimeException('Ollama returned an invalid response.');
    }

    private function parseJson(string $text): array
    {
        $json = trim($text);

        if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $json, $matches)) {
            $json = trim($matches[1]);
        }

        $decoded = json_decode($json, true);

        if (! is_array($decoded)) {
            throw new \RuntimeException('Ollama returned a malformed JSON response.');
        }

        return $decoded;
    }

    private function normalizeAnalysis(array $data): array
    {
        $analysis = [
            'name' => $this->normalizeString(data_get($data, 'name')),
            'category' => $this->normalizeString(data_get($data, 'category')),
            'product_type' => $this->normalizeString(data_get($data, 'product_type')) ? Str::slug(data_get($data, 'product_type')) : null,
            'description' => $this->normalizeString(data_get($data, 'description')),
            'colors' => $this->normalizeStringList(data_get($data, 'colors', [])),
            'sizes' => $this->normalizeStringList(data_get($data, 'sizes', [])),
            'material' => $this->normalizeString(data_get($data, 'material')),
            'brand' => $this->normalizeString(data_get($data, 'brand')),
            'attributes' => $this->normalizeAttributes(data_get($data, 'attributes', [])),
            'options' => $this->normalizeOptions(data_get($data, 'options', [])),
            'tags' => $this->normalizeStringList(data_get($data, 'tags', []), true),
        ];

        $matchedCategory = $analysis['category'] ? $this->matchCategory($analysis['category']) : null;

        if ($matchedCategory) {
            $analysis['category_id'] = $matchedCategory->id;
            $analysis['category_name'] = $matchedCategory->name;
            $analysis['category_match_warning'] = null;
        } else {
            $analysis['category_id'] = null;
            $analysis['category_name'] = null;
            $analysis['category_match_warning'] = $analysis['category']
                ? 'No matching category was found in your catalog. Please choose a category manually.'
                : null;
        }

        return $analysis;
    }

    private function normalizeAttributes(mixed $attributes): array
    {
        if (! is_array($attributes)) {
            return [];
        }

        $normalized = [];

        foreach ($attributes as $key => $value) {
            $key = $this->normalizeString((string) $key);

            if ($key === null || $key === '') {
                continue;
            }

            $normalizedValue = $this->normalizeScalarValue($value);

            if ($normalizedValue !== null) {
                $normalized[$key] = $normalizedValue;
            }
        }

        return $normalized;
    }

    private function normalizeOptions(mixed $options): array
    {
        if (! is_array($options)) {
            return [];
        }

        $normalized = [];

        foreach ($options as $option) {
            if (! is_array($option)) {
                continue;
            }

            $name = $this->normalizeString(data_get($option, 'name'));
            $values = $this->normalizeStringList(data_get($option, 'values', []));

            if (! $name || empty($values)) {
                continue;
            }

            $normalized[] = [
                'name' => $name,
                'values' => $values,
            ];
        }

        return $normalized;
    }

    private function normalizeScalarValue(mixed $value): ?string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_scalar($value)) {
            return $this->normalizeString((string) $value);
        }

        if (is_array($value) && count($value) > 0) {
            $flattened = [];

            foreach ($value as $item) {
                $normalized = $this->normalizeString((string) $item);

                if ($normalized) {
                    $flattened[] = $normalized;
                }
            }

            return $flattened ? implode(', ', $flattened) : null;
        }

        return null;
    }

    private function matchCategory(string $category): ?Category
    {
        $normalized = $this->normalizeCategoryToken($category);

        if ($normalized === '') {
            return null;
        }

        $categories = Category::query()->get(['id', 'name']);

        foreach ($categories as $item) {
            if ($this->normalizeCategoryToken($item->name) === $normalized) {
                return $item;
            }
        }

        return null;
    }

    private function normalizeCategoryToken(string $value): string
    {
        return strtolower(preg_replace('/[^a-z0-9]+/i', ' ', trim($value)) ?? '');
    }

    private function normalizeStringList(mixed $items, bool $normalizeTags = false): array
    {
        if (! is_array($items)) {
            return [];
        }

        $normalized = [];

        foreach ($items as $item) {
            $value = $this->normalizeString((string) $item);

            if ($value === null || $value === '') {
                continue;
            }

            if ($normalizeTags) {
                $value = strtolower($value);
            }

            $normalized[] = $value;
        }

        return array_values(array_unique($normalized));
    }

    private function normalizeString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }
}
