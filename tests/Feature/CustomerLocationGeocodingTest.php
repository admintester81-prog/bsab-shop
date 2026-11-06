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

    public function test_seller_can_search_and_reverse_geocode_an_address(): void
    {
        Role::findOrCreate('seller', 'web');
        $seller = User::factory()->create(['role' => 'seller']);
        $seller->assignRole('seller');

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([
                ['lat' => '9.59', 'lon' => '122.47', 'display_name' => 'Central Philippines State University, Hinoba-an'],
            ]),
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'amenity' => 'Central Philippines State University - Hinoba-an Campus',
                    'municipality' => 'Hinoba-an',
                    'province' => 'Negros Occidental',
                    'country' => 'Philippines',
                ],
            ]),
        ]);

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/customer/location/search?query=Central%20Philippines%20State%20University%20-%20Hinoba-an%20Campus')
            ->assertOk()
            ->assertJsonPath('0.display_name', 'Central Philippines State University, Hinoba-an');

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/customer/location/reverse?lat=9.59&lon=122.47')
            ->assertOk()
            ->assertJsonPath('address.municipality', 'Hinoba-an');
    }

    public function test_seller_can_search_for_central_philippines_state_university_hinoba_an_campus(): void
    {
        Role::findOrCreate('seller', 'web');
        $seller = User::factory()->create(['role' => 'seller']);
        $seller->assignRole('seller');

        Http::fake([
            'https://nominatim.openstreetmap.org/search*' => Http::response([
                [
                    'lat' => '9.5948580',
                    'lon' => '122.4761242',
                    'display_name' => 'Central Philippines State University - Hinoba-an Campus, Bacolod South Road, Barangay II, Hinoba-an, Negros Occidental, Philippines',
                ],
            ]),
        ]);

        $this->actingAs($seller, 'sanctum')
            ->getJson('/api/customer/location/search?query=Central%20Philippines%20State%20University%20-%20Hinoba-an%20Campus')
            ->assertOk()
            ->assertJsonPath('0.lat', '9.5948580')
            ->assertJsonPath('0.lon', '122.4761242');

        Http::assertSent(fn ($request) => str_contains($request->url(), 'Central%20Philippines%20State%20University')
            && str_contains($request->url(), 'Hinoba-an'));
    }

    public function test_location_geocoding_still_requires_an_authenticated_customer_or_seller(): void
    {
        $this->getJson('/api/customer/location/search?query=Central%20Market')->assertUnauthorized();
    }
}
