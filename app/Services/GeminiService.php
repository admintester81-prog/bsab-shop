<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiService
{
    public function model(): string
    {
        return (string) config('services.gemini.model', 'gemini-3.6-flash');
    }

    public function isConfigured(): bool
    {
        return filled(config('services.gemini.api_key'));
    }

    /**
     * @param  array<int, array<string, mixed>>  $contents
     * @param  array<string, mixed>  $generationConfig
     */
    public function generateText(
        array $contents,
        array $generationConfig = [],
        ?string $systemInstruction = null,
        ?int $timeout = null,
    ): string {
        $apiKey = trim((string) config('services.gemini.api_key'));

        if ($apiKey === '') {
            throw new RuntimeException('GEMINI_API_KEY is not configured.');
        }

        $timeout ??= (int) config('services.gemini.timeout', 60);
        $phpExecutionLimit = (int) ini_get('max_execution_time');

        if ($phpExecutionLimit !== 0 && $phpExecutionLimit <= $timeout) {
            set_time_limit($timeout + 10);
        }

        $payload = ['contents' => $contents];

        if ($generationConfig !== []) {
            $payload['generationConfig'] = $generationConfig;
        }

        if ($systemInstruction !== null) {
            $payload['systemInstruction'] = [
                'parts' => [['text' => $systemInstruction]],
            ];
        }

        try {
            $response = Http::acceptJson()
                ->timeout($timeout)
                ->connectTimeout(10)
                ->withHeaders([
                    'x-goog-api-key' => $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post('https://generativelanguage.googleapis.com/v1beta/models/'.$this->model().':generateContent', $payload);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('Unable to connect to the Gemini API.', 0, $exception);
        }

        if (! $response->successful()) {
            $responsePayload = $response->json();
            $message = data_get($responsePayload, 'error.message');

            if (! is_string($message) || trim($message) === '') {
                $message = match ($response->status()) {
                    401 => 'Gemini API key is invalid.',
                    403 => 'Gemini API access is forbidden.',
                    404 => 'The configured Gemini model is unavailable.',
                    429 => 'Gemini API rate limit reached. Please try again later.',
                    default => 'Gemini API request failed with status '.$response->status().'.',
                };
            }

            throw new RuntimeException(trim($message));
        }

        $parts = data_get($response->json(), 'candidates.0.content.parts', []);
        $text = collect(is_array($parts) ? $parts : [])
            ->reject(fn (mixed $part) => is_array($part) && ($part['thought'] ?? false))
            ->pluck('text')
            ->filter(fn (mixed $part) => is_string($part) && trim($part) !== '')
            ->implode("\n");

        if (trim($text) === '') {
            throw new RuntimeException('Gemini returned an empty response.');
        }

        return trim($text);
    }
}
