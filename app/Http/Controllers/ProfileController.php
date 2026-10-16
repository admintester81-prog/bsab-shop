<?php

namespace App\Http\Controllers;

use App\Services\ImageOptimizationService;
use App\Models\DeliveryZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render($user->hasRole('admin') ? 'admin/profile' : ($user->hasRole('seller') ? 'seller/profile' : ($user->hasRole('customer') ? 'customer/profile' : 'welcome')), [
            'address' => $user->addresses()->where('is_default', true)->first() ?? $user->addresses()->first(),
            'avatarUrl' => $user->avatar ? '/storage/'.$user->avatar : null,
            'deliveryZones' => $user->hasRole('customer') ? DeliveryZone::active()->get(['id', 'name', 'barangay']) : [],
        ]);
    }

    public function update(Request $request, ImageOptimizationService $images): RedirectResponse
    {
        $user = $request->user();
        $isSeller = $user->hasRole('seller');
        $isCustomer = $user->hasRole('customer');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'phone' => [$isSeller ? 'required' : 'nullable', 'string', 'max:50'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.(($isSeller || $user->hasRole('admin')) ? 2048 : config('images.max_upload_kb'))],
            'address' => ['nullable', 'array'],
            'address.full_name' => ['required_with:address', 'string', 'max:255'],
            'address.phone' => ['required_with:address', 'string', 'max:50'],
            'address.line1' => ['required_with:address', 'string', 'max:255'],
            'address.barangay' => $isCustomer
                ? ['required_with:address', 'string', 'max:150']
                : ['nullable', 'string', 'max:150'],
            'address.city' => $isCustomer
                ? ['required_with:address', 'string', 'in:Hinoba-an']
                : ['required_with:address', 'string', 'max:255'],
            'address.province' => $isCustomer
                ? ['required_with:address', 'string', 'in:Negros Occidental']
                : ['required_with:address', 'string', 'max:255'],
            'address.postal_code' => ['required_with:address', 'string', 'max:20'],
            'address.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'address.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ], [
            'address.city.in' => 'Customer addresses must be in Hinoba-an, Negros Occidental.',
            'address.province.in' => 'Customer addresses must be in Hinoba-an, Negros Occidental.',
        ]);
        if ($data['email'] !== $user->email) {
            $user->email_verified_at = null;
        }
        $user->fill(['name' => $data['name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null]);
        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $images->store($request->file('avatar'), 'avatars', [
                'max_dimension' => config('images.profile_max_dimension'),
            ]);
        }
        $user->save();
        if (! empty($data['address'])) {
            $address = $user->addresses()->where('is_default', true)->first() ?? $user->addresses()->first();
            if ($address) {
                $address->update($data['address']);
            } else {
                $user->addresses()->create(array_merge($data['address'], ['label' => 'Home', 'is_default' => true]));
            }
        }

        if ($user->hasRole('admin')) {
            return to_route('admin.profile');
        }

        if ($user->hasRole('seller')) {
            return to_route('seller.profile');
        }

        return to_route('profile.edit');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();
        Auth::logout();
        $user->delete();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('home');
    }
}
