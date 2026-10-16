<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\DeliveryZone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CustomerAddressLocalityTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_address_must_be_in_hinoba_an_negros_occidental(): void
    {
        Role::findOrCreate('customer', 'web');
        $customer = User::factory()->create();
        $customer->assignRole('customer');
        DeliveryZone::create([
            'name' => 'Poblacion Zone',
            'barangay' => 'Poblacion',
            'delivery_fee' => 50,
            'is_free_delivery' => false,
            'estimated_delivery_text' => '1-2 days',
            'status' => 'active',
            'sort_order' => 1,
        ]);

        $address = [
            'full_name' => $customer->name,
            'phone' => '09171234567',
            'line1' => 'Villanueva Street',
            'barangay' => 'Poblacion',
            'city' => 'Dumaguete City',
            'province' => 'Negros Oriental',
            'postal_code' => '6200',
        ];

        $this->actingAs($customer)
            ->from(route('profile.edit'))
            ->patch(route('profile.update'), [
                'name' => $customer->name,
                'email' => $customer->email,
                'address' => $address,
            ])
            ->assertRedirect(route('profile.edit'))
            ->assertSessionHasErrors(['address.city', 'address.province']);

        $this->assertDatabaseMissing('addresses', ['user_id' => $customer->id]);

        $address['city'] = 'Hinoba-an';
        $address['province'] = 'Negros Occidental';
        $address['latitude'] = 9.5928123;
        $address['longitude'] = 122.4687456;

        $this->actingAs($customer)
            ->patch(route('profile.update'), [
                'name' => $customer->name,
                'email' => $customer->email,
                'address' => $address,
            ])
            ->assertRedirect(route('profile.edit'));

        $this->assertDatabaseHas('addresses', [
            'user_id' => $customer->id,
            'barangay' => 'Poblacion',
            'city' => 'Hinoba-an',
            'province' => 'Negros Occidental',
            'latitude' => '9.5928123',
            'longitude' => '122.4687456',
        ]);

        $address['barangay'] = 'Unlisted Barangay';
        $this->actingAs($customer)
            ->patch(route('profile.update'), [
                'name' => $customer->name,
                'email' => $customer->email,
                'address' => $address,
            ])
            ->assertRedirect(route('profile.edit'));

        $this->assertDatabaseHas('addresses', [
            'user_id' => $customer->id,
            'barangay' => 'Unlisted Barangay',
        ]);
    }
}
