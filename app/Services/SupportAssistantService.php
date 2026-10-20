<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use RuntimeException;

class SupportAssistantService
{
    public function __construct(
        private readonly GeminiService $gemini,
    ) {}

    public function model(): string
    {
        return $this->gemini->model();
    }

    public function isAvailable(): bool
    {
        return $this->gemini->isConfigured();
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function reply(array $history): ?string
    {
        try {
            return $this->gemini->generateText(
                array_map(fn (array $message) => [
                    'role' => $message['role'] === 'assistant' ? 'model' : 'user',
                    'parts' => [['text' => $message['content']]],
                ], $history),
                [
                    'temperature' => 0.3,
                    'maxOutputTokens' => 512,
                ],
                'You are the BSAB-SHOP AI help assistant, not a human agent. Reply directly to the customer in no more than three short sentences. Return only the customer-facing answer; do not include labels, tone/style notes, internal reasoning, or role names. Use only these verified Help Center facts: To track an order, sign in to the BSAB-SHOP account, open Orders, and select the order to see its latest status and delivery details; contact support with the order number if help is needed. Vouchers can be claimed from the Vouchers section and applied at checkout when eligible. Password reset starts with “Forgot password?” on the sign-in page. Payment options appear at checkout and vary by seller and order. Return eligibility depends on the item and condition; direct customers to the Return Policy and support. Never invent other policies, delivery details, tracking numbers, emails, or payment results. You cannot access orders, accounts, payments, or private information. For topics not covered by these facts, say you are unsure and direct the customer to the Help Center contact options. Never ask for passwords or payment credentials.',
            );
        } catch (RuntimeException $exception) {
            Log::warning('BSAB-SHOP support assistant received a Gemini error.', [
                'message' => $exception->getMessage(),
            ]);

            return null;
        }
    }
}
