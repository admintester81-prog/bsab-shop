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
            'http://127.0.0.1:11434/api/chat' => Http::response([
                'message' => ['content' => 'Open Orders to check your order status.'],
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
            'http://127.0.0.1:11434/api/chat' => Http::response([
                'message' => ['content' => 'Open Orders to check your order status.'],
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
            ->assertJsonPath('reply', 'Open Orders to check your order status.')
            ->assertJsonPath('assistant_available', true);

        $this->assertDatabaseCount('support_conversations', 0);
        Http::assertSent(fn ($request) => $request['model'] === 'llama3.2:1b'
            && $request['stream'] === false
            && $request['options']['num_predict'] === 96
            && count($request['messages']) === 4);
    }

    public function test_assistant_status_reports_whether_the_configured_model_is_installed(): void
    {
        Http::fake([
            'http://127.0.0.1:11434/api/tags' => Http::response([
                'models' => [
                    ['name' => 'llama3.2:1b'],
                ],
            ]),
        ]);

        $this->getJson('/api/support/assistant/status')
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('model', 'llama3.2:1b');
    }

    public function test_guest_receives_an_explicit_offline_response_when_ollama_is_unavailable(): void
    {
        Http::fake([
            'http://127.0.0.1:11434/api/chat' => Http::response(['error' => 'Model not found'], 404),
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
