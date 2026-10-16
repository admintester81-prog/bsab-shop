<?php

namespace App\Http\Controllers;

use App\Models\SiteSetting;
use Inertia\Inertia;
use Inertia\Response;

class HelpCenterController extends Controller
{
    public function show(): Response
    {
        $settings = SiteSetting::homeSettings();
        $defaultContactPage = collect(SiteSetting::defaults()['footer_pages'])->firstWhere('slug', 'contact-us');
        $contactPage = collect($settings['footer_pages'])->firstWhere('slug', 'contact-us') ?? [];
        $contactDetails = array_replace(
            $defaultContactPage['contact_details'] ?? [],
            $contactPage['contact_details'] ?? [],
        );

        return Inertia::render('help-center', [
            'contactDetails' => [
                'email' => $contactDetails['email'] ?? null,
                'phone' => $contactDetails['phone'] ?? null,
                'supportHours' => $contactDetails['support_hours'] ?? null,
            ],
        ]);
    }
}
