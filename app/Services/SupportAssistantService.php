<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SupportAssistantService
{
    public function model(): string
    {
        return (string) config('services.ollama.model', 'llama3.2:1b');
    }

    public function isAvailable(): bool
    {
        try {
            $response = Http::acceptJson()
                ->connectTimeout(2)
                ->timeout(4)
                ->get(rtrim((string) config('services.ollama.url'), '/').'/api/tags');
        } catch (ConnectionException) {
            return false;
        }

        if (! $response->successful()) {
            return false;
        }

        $model = $this->model();

        return collect($response->json('models', []))
            ->contains(fn (array $availableModel) => ($availableModel['name'] ?? null) === $model);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function reply(array $history): ?string
    {
        try {
            $response = Http::acceptJson()
                ->connectTimeout(3)
                ->timeout(240)
                ->post(rtrim((string) config('services.ollama.url'), '/').'/api/chat', [
                    'model' => $this->model(),
                    'stream' => false,
                    'keep_alive' => '10m',
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are the BSAB-SHOP AI help assistant, not a human agent. Answer helpfully and concisely in no more than three short sentences. Use only these verified Help Center facts: To track an order, sign in to the BSAB-SHOP account, open Orders, and select the order to see its latest status and delivery details; contact support with the order number if help is needed. Vouchers can be claimed from the Vouchers section and applied at checkout when eligible. Password reset starts with “Forgot password?” on the sign-in page. Payment options appear at checkout and vary by seller and order. Return eligibility depends on the item and condition; direct customers to the Return Policy and support. Never invent other policies, delivery details, tracking numbers, emails, or payment results. You cannot access orders, accounts, payments, or private information. For topics not covered by these facts, say you are unsure and direct the customer to the Help Center contact options. Never ask for passwords or payment credentials.',
                        ],
                        ...$history,
                    ],
                    'options' => [
                        'temperature' => 0.3,
                        'num_ctx' => 2048,
                        'num_predict' => 96,
                    ],
                ]);
        } catch (ConnectionException $exception) {
            Log::warning('BSAB-SHOP support assistant could not connect to Ollama.', [
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('BSAB-SHOP support assistant received an unsuccessful Ollama response.', [
                'status' => $response->status(),
            ]);

            return null;
        }

        $content = $response->json('message.content');

        if (! is_string($content) || trim($content) === '') {
            Log::warning('BSAB-SHOP support assistant received an empty Ollama response.');

            return null;
        }

        return trim($content);
    }
}
