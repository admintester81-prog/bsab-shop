<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Throwable;

class ProductSearchAssistant
{
    public function __construct(private readonly GeminiService $gemini) {}

    /**
     * @param  array<int, array{name: string, category: string|null}>  $catalog
     * @return array{intent: string, suggestions: array<int, string>, ai_enabled: bool}
     */
    public function analyze(string $query, array $catalog): array
    {
        $fallback = $this->fallback($query, $catalog);

        if (! $this->gemini->isConfigured() || $query === '' || $catalog === []) {
            return [...$fallback, 'ai_enabled' => false];
        }

        $cacheKey = 'product-search-ai:'.hash('sha256', mb_strtolower($query).'|'.serialize($catalog));
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['intent'], $cached['suggestions'], $cached['ai_enabled'])) {
            return $cached;
        }

        try {
            $catalogContext = json_encode([
                'search_query' => $query,
                'published_catalog_matches' => $catalog,
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $text = $this->gemini->generateText(
                [['parts' => [['text' => $catalogContext]]]],
                ['responseMimeType' => 'application/json', 'temperature' => 0.2],
                <<<'PROMPT'
You are a product-search assistant for a small e-commerce catalog.
Return only JSON: {"intent":"short phrase","suggestions":["search phrase", ...]}.
Only suggest related search phrases supported by the supplied published catalog matches. Do not invent products, sellers, prices, ratings, or availability. Keep suggestions concise and relevant to the user's query. If the catalog contains no relevant alternative, return an empty suggestions array. Do not repeat the original query.
PROMPT,
                8,
            );
            $decoded = json_decode($text, true, 16, JSON_THROW_ON_ERROR);
            $allowedTerms = collect($catalog)
                ->flatMap(fn (array $item) => preg_split('/[^\pL\pN]+/u', mb_strtolower($item['name'].' '.$item['category']), -1, PREG_SPLIT_NO_EMPTY))
                ->unique()
                ->all();
            $suggestions = collect(data_get($decoded, 'suggestions', []))
                ->filter(fn ($suggestion) => is_string($suggestion) && mb_strlen($suggestion) <= 80)
                ->map(fn (string $suggestion) => trim($suggestion))
                ->filter(fn (string $suggestion) => $suggestion !== '' && mb_strtolower($suggestion) !== mb_strtolower($query))
                ->filter(function (string $suggestion) use ($allowedTerms) {
                    $words = preg_split('/[^\pL\pN]+/u', mb_strtolower($suggestion), -1, PREG_SPLIT_NO_EMPTY);

                    return $words !== [] && collect($words)->every(fn (string $word) => in_array($word, $allowedTerms, true));
                })
                ->unique(fn (string $suggestion) => mb_strtolower($suggestion))
                ->take(6)
                ->values()
                ->all();

            $result = [
                'intent' => is_string(data_get($decoded, 'intent')) ? mb_substr(trim(data_get($decoded, 'intent')), 0, 100) : $fallback['intent'],
                'suggestions' => $suggestions !== [] ? $suggestions : $fallback['suggestions'],
                'ai_enabled' => true,
            ];
            Cache::put($cacheKey, $result, now()->addHours(12));

            return $result;
        } catch (Throwable $exception) {
            Log::warning('AI product search suggestions unavailable; using catalog-based suggestions.', [
                'message' => $exception->getMessage(),
            ]);

            return [...$fallback, 'ai_enabled' => false];
        }
    }

    private function fallback(string $query, array $catalog): array
    {
        $suggestions = collect($catalog)
            ->map(fn (array $item) => $item['name'])
            ->filter(fn (string $name) => mb_strtolower($name) !== mb_strtolower($query))
            ->unique()
            ->take(6)
            ->values()
            ->all();

        return [
            'intent' => $query === '' ? 'Explore available products' : 'Find published products matching “'.$query.'”',
            'suggestions' => $suggestions,
        ];
    }
}
