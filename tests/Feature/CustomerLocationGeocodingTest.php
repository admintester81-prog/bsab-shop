<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerLocationGeocodingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_location_search_is_proxied_and_scoped_to_hinoba_an(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([
                ['lat' => '9.6', 'lon' => '122.4', 'display_name' => 'Hinoba-an, Philippines'],
            ]),
        ]);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/customer/location/search?query=Central%20Market')
            ->assertOk()
            ->assertJsonPath('0.lat', '9.6');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'nominatim.openstreetmap.org/search')
            && str_contains($request->url(), 'Central%20Market')
            && str_contains($request->url(), 'Hinoba-an')
            && $request->hasHeader('User-Agent'));
    }

    public function test_customer_location_reverse_lookup_is_proxied(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');

        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => ['municipality' => 'Hinoba-an', 'province' => 'Negros Occidental'],
            ]),
        ]);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/customer/location/reverse?lat=9.6&lon=122.4')
            ->assertOk()
            ->assertJsonPath('address.municipality', 'Hinoba-an');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'nominatim.openstreetmap.org/reverse')
            && $request['lat'] === '9.6'
            && $request['lon'] === '122.4');
    }
}
