<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'manage-users', 'manage-roles', 'manage-categories', 'create-sellers', 'manage-payouts', 'view-platform-analytics',
            'manage-own-products', 'manage-own-orders', 'view-own-analytics', 'manage-shop-profile',
            'place-order', 'manage-own-cart', 'write-review', 'manage-own-addresses',
        ];

        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        Role::findOrCreate('admin', 'web')->syncPermissions($permissions);
        Role::findOrCreate('seller', 'web')->syncPermissions([
            'manage-own-products', 'manage-own-orders', 'view-own-analytics', 'manage-shop-profile',
        ]);
        Role::findOrCreate('customer', 'web')->syncPermissions([
            'place-order', 'manage-own-cart', 'write-review', 'manage-own-addresses',
        ]);
        Role::findOrCreate('rider', 'web');
    }
}
