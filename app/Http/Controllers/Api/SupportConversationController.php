<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportMessage;
use App\Services\SupportAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportConversationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $conversation = $request->user()
            ->supportConversations()
            ->where('status', 'awaiting_agent')
            ->latest('updated_at')
            ->first();

        return response()->json([
            'conversation' => $conversation,
            'messages' => $conversation
                ? $conversation->messages()->latest()->limit(100)->get()->reverse()->values()
                : [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        set_time_limit(300);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        [$conversation, $message] = DB::transaction(function () use ($request, $validated): array {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $conversation = $user->supportConversations()
                ->where('status', 'awaiting_agent')
                ->latest('updated_at')
                ->first();

            if (! $conversation) {
                $conversation = $user->supportConversations()->create([
                    'status' => 'awaiting_agent',
                ]);
            }

            $message = $conversation->messages()->create([
                'user_id' => $user->id,
                'sender_type' => 'customer',
                'body' => $validated['body'],
                'delivery_status' => 'saved_for_follow_up',
            ]);

            $conversation->touch();

            return [$conversation, $message];
        });

        $history = $conversation->messages()
            ->latest()
            ->limit(7)
            ->get()
            ->reverse()
            ->map(fn (SupportMessage $item) => [
                'role' => $item->sender_type === 'customer' ? 'user' : 'assistant',
                'content' => $item->body,
            ])
            ->all();
        $reply = app(SupportAssistantService::class)->reply($history);
        $assistantMessage = null;

        if ($reply !== null) {
            [$assistantMessage] = DB::transaction(function () use ($conversation, $message, $reply): array {
                $assistantMessage = $conversation->messages()->create([
                    'sender_type' => 'support',
                    'body' => $reply,
                    'delivery_status' => 'answered_by_ai',
                ]);

                $message->update(['delivery_status' => 'answered_by_ai']);
                $conversation->touch();

                return [$assistantMessage];
            });
        }

        return response()->json([
            'conversation' => $conversation,
            'message' => $message,
            'assistant_message' => $assistantMessage,
            'assistant_available' => $reply !== null,
            'notice' => $reply === null
                ? 'Your message was saved, but the AI assistant is unavailable right now. It has not been delivered to a live agent.'
                : null,
        ], 201);
    }

    public function assistantStatus(SupportAssistantService $assistant): JsonResponse
    {
        return response()->json([
            'available' => $assistant->isAvailable(),
            'model' => $assistant->model(),
        ]);
    }

    public function guestAssistant(Request $request, SupportAssistantService $assistant): JsonResponse
    {
        set_time_limit(300);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'history' => ['sometimes', 'array', 'max:6'],
            'history.*.role' => ['required', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:2000'],
        ]);

        $history = array_map(
            fn (array $item) => ['role' => $item['role'], 'content' => $item['content']],
            $validated['history'] ?? [],
        );
        $history[] = ['role' => 'user', 'content' => $validated['body']];
        $reply = $assistant->reply($history);

        if ($reply === null) {
            return response()->json([
                'message' => 'The AI assistant is unavailable right now. Please use the configured email or phone support option.',
                'assistant_available' => false,
            ], 503);
        }

        return response()->json([
            'reply' => $reply,
            'assistant_available' => true,
            'model' => $assistant->model(),
        ]);
    }
}
