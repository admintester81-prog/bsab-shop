<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class HelpCenterTest extends TestCase
{
    use RefreshDatabase;

    private const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.gemini.api_key' => 'test-gemini-key',
            'services.gemini.model' => 'gemini-3.6-flash',
        ]);
    }

    public function test_help_center_uses_its_dedicated_page_and_existing_contact_information(): void
    {
        $this->get('/pages/help-center')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('help-center')
                ->where('contactDetails.email', 'support@bsab-shop.com')
                ->where('contactDetails.phone', '+63 912 345 6789'));
    }

    public function test_support_conversation_requires_authentication(): void
    {
        $this->getJson('/api/support/conversation')->assertUnauthorized();
        $this->postJson('/api/support/conversation/messages', ['body' => 'I need help.'])->assertUnauthorized();
    }

    public function test_authenticated_user_can_save_and_reload_private_support_messages(): void
    {
        $customer = User::factory()->create();
        Http::fake([
            self::GEMINI_URL => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => 'Open Orders to check your order status.']]],
                ]],
            ]),
        ]);

        $this->actingAs($customer)
            ->postJson('/api/support/conversation/messages', ['body' => 'Can you help with my order?'])
            ->assertCreated()
            ->assertJsonPath('message.body', 'Can you help with my order?')
            ->assertJsonPath('message.delivery_status', 'answered_by_ai')
            ->assertJsonPath('assistant_message.body', 'Open Orders to check your order status.')
            ->assertJsonPath('conversation.status', 'awaiting_agent');

        $this->assertDatabaseHas('support_conversations', [
            'user_id' => $customer->id,
            'status' => 'awaiting_agent',
        ]);
        $this->assertDatabaseHas('support_messages', [
            'user_id' => $customer->id,
            'sender_type' => 'customer',
            'body' => 'Can you help with my order?',
            'delivery_status' => 'answered_by_ai',
        ]);
        $this->assertDatabaseHas('support_messages', [
            'sender_type' => 'support',
            'body' => 'Open Orders to check your order status.',
            'delivery_status' => 'answered_by_ai',
        ]);

        $this->actingAs($customer)
            ->getJson('/api/support/conversation')
            ->assertOk()
            ->assertJsonPath('messages.0.body', 'Can you help with my order?');

        $otherCustomer = User::factory()->create();
        $this->actingAs($otherCustomer)
            ->getJson('/api/support/conversation')
            ->assertOk()
            ->assertJsonPath('conversation', null)
            ->assertJsonPath('messages', []);
    }

    public function test_guest_can_get_an_ai_answer_without_creating_a_persisted_conversation(): void
    {
        Http::fake([
            self::GEMINI_URL => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [
                        ['text' => 'tone/style: Helpful', 'thought' => true],
                        ['text' => 'Sign in, open Orders, and select your order to see its latest status.'],
                    ]],
                ]],
            ]),
        ]);

        $this->postJson('/api/support/assistant', [
            'body' => 'How do I track my order?',
            'history' => [
                ['role' => 'user', 'content' => 'I placed an order.'],
                ['role' => 'assistant', 'content' => 'What would you like to know?'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('reply', 'Sign in, open Orders, and select your order to see its latest status.')
            ->assertJsonPath('assistant_available', true);

        $this->assertDatabaseCount('support_conversations', 0);
        Http::assertSent(fn ($request) => $request->hasHeader('x-goog-api-key', 'test-gemini-key')
            && count($request['contents']) === 3
            && $request['contents'][1]['role'] === 'model'
            && $request['generationConfig']['maxOutputTokens'] === 512
            && isset($request['systemInstruction']['parts'][0]['text']));
    }

    public function test_assistant_status_reports_whether_gemini_is_configured(): void
    {
        $this->getJson('/api/support/assistant/status')
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('model', 'gemini-3.6-flash');
    }

    public function test_guest_receives_an_explicit_offline_response_when_gemini_is_unavailable(): void
    {
        Http::fake([
            self::GEMINI_URL => Http::response(['error' => ['message' => 'Gemini service unavailable.']], 503),
        ]);

        $this->postJson('/api/support/assistant', ['body' => 'How do I track my order?'])
            ->assertServiceUnavailable()
            ->assertJsonPath('assistant_available', false);
    }

    public function test_guest_assistant_validates_message_and_history_size(): void
    {
        $this->postJson('/api/support/assistant', ['body' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->postJson('/api/support/assistant', [
            'body' => 'Question',
            'history' => array_fill(0, 7, ['role' => 'user', 'content' => 'Previous question']),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('history');
    }

    public function test_support_message_validation_rejects_empty_or_oversized_content(): void
    {
        $customer = User::factory()->create();

        $this->actingAs($customer)
            ->postJson('/api/support/conversation/messages', ['body' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');

        $this->actingAs($customer)
            ->postJson('/api/support/conversation/messages', ['body' => str_repeat('a', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('body');
    }
}
