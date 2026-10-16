<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        'fallback_model' => env('GEMINI_FALLBACK_MODEL', 'gemini-2.0-flash'),
    ],

    'ollama' => [
        'base_url' => env('OLLAMA_BASE_URL', env('OLLAMA_URL', 'http://127.0.0.1:11434')),
        'url' => env('OLLAMA_BASE_URL', env('OLLAMA_URL', 'http://127.0.0.1:11434')),
        'model' => env('OLLAMA_MODEL', 'llama3.2:1b'),
        'vision_model' => env('OLLAMA_VISION_MODEL', 'moondream:1.8b'),
        'timeout' => (int) env('OLLAMA_TIMEOUT', 300),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
