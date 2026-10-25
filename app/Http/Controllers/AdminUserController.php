<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Order;
use Carbon\Carbon;
use App\Services\ImageOptimizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class AdminUserController extends Controller
{
    public function index(): Response
    {
        $today = Carbon::today();
        $rangeStart = $today->copy()->subDays(89);
        $users = User::query()
            ->with('roles:id,name')
            ->withCount('orders')
            ->latest()
            ->get(['id', 'name', 'email', 'role', 'status', 'avatar', 'created_at']);
        $registrations = User::query()
            ->whereBetween('created_at', [$rangeStart, $today->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as activity_date, COUNT(*) as activity_count')
            ->groupBy('activity_date')
            ->pluck('activity_count', 'activity_date');
        $activity = collect(range(0, 89))->map(function (int $daysAgo) use ($today, $registrations): array {
            $date = $today->copy()->subDays(89 - $daysAgo);
            $key = $date->toDateString();

            return ['date' => $key, 'label' => $date->format('M j'), 'value' => (int) ($registrations[$key] ?? 0)];
        })->values();

        return Inertia::render('admin/users', [
            'users' => $users,
            'userStats' => [
                'total' => $users->count(),
                'admins' => $users->where('role', 'admin')->count(),
                'sellers' => $users->where('role', 'seller')->count(),
                'logistics' => $users->where('role', 'rider')->count(),
                'customers' => $users->where('role', 'customer')->count(),
                'active' => $users->filter(fn (User $user) => ($user->status ?? 'active') === 'active')->count(),
                'suspended' => $users->filter(fn (User $user) => $user->status === 'suspended')->count(),
                'new_this_month' => $users->filter(fn (User $user) => Carbon::parse($user->created_at)->isSameMonth($today))->count(),
            ],
            'activity' => $activity,
        ]);
    }

    public function customers(): Response
    {
        $today = Carbon::today();
        $rangeStart = $today->copy()->subDays(89);
        $customers = User::query()
            ->where('role', 'customer')
            ->withCount('orders')
            ->with(['orders' => fn ($query) => $query
                ->select(['id', 'user_id', 'order_number', 'total', 'status', 'created_at'])
                ->latest()
                ->limit(20)])
            ->latest()
            ->get(['id', 'name', 'email', 'status', 'created_at']);

        $registrations = User::query()
            ->where('role', 'customer')
            ->whereBetween('created_at', [$rangeStart, $today->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as activity_date, COUNT(*) as activity_count')
            ->groupBy('activity_date')
            ->pluck('activity_count', 'activity_date');

        $orders = Order::query()
            ->whereHas('user', fn ($query) => $query->where('role', 'customer'))
            ->whereBetween('created_at', [$rangeStart, $today->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as activity_date, COUNT(*) as activity_count')
            ->groupBy('activity_date')
            ->pluck('activity_count', 'activity_date');

        $activity = collect(range(0, 89))->map(function (int $daysAgo) use ($today, $registrations, $orders): array {
            $date = $today->copy()->subDays(89 - $daysAgo);
            $key = $date->toDateString();

            return [
                'date' => $key,
                'label' => $date->format('M j'),
                'registrations' => (int) ($registrations[$key] ?? 0),
                'orders' => (int) ($orders[$key] ?? 0),
            ];
        })->values();
        $customersWithOrders = $customers->where('orders_count', '>', 0)->count();

        return Inertia::render('admin/customers', [
            'customers' => $customers,
            'customerStats' => [
                'total' => $customers->count(),
                'active' => $customers->filter(fn (User $user) => ($user->status ?? 'active') === 'active')->count(),
                'with_orders' => $customersWithOrders,
                'new_this_month' => $customers->filter(fn (User $user) => Carbon::parse($user->created_at)->isSameMonth($today))->count(),
                'orders' => $customers->sum('orders_count'),
            ],
            'activity' => $activity,
        ]);
    }

    public function updateCustomer(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->role === 'customer', 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);

        $user->update($data);

        return back();
    }

    public function store(Request $request, ImageOptimizationService $images): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'role' => ['required', Rule::in(['admin', 'seller', 'rider', 'customer'])],
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('images.max_upload_kb')],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'password' => Hash::make($data['password']),
            'status' => $data['status'],
            'avatar' => $request->hasFile('avatar')
                ? $images->store($request->file('avatar'), 'avatars', ['max_dimension' => config('images.profile_max_dimension')])
                : null,
        ]);
        Role::findOrCreate($data['role'], 'web');
        $user->assignRole($data['role']);
        $user->forceFill(['role' => $data['role']])->save();

        return to_route('admin.users');
    }

    public function update(Request $request, User $user, ImageOptimizationService $images): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
            'role' => ['required', Rule::in(['admin', 'seller', 'rider', 'customer'])],
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('images.max_upload_kb')],
        ]);

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'status' => $data['status'],
        ]);
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }
        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $images->store($request->file('avatar'), 'avatars', ['max_dimension' => config('images.profile_max_dimension')]);
        }
        $user->save();
        Role::findOrCreate($data['role'], 'web');
        $user->syncRoles([$data['role']]);
        $user->forceFill(['role' => $data['role']])->save();

        return to_route('admin.users');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($request->user()->is($user), 422, 'You cannot delete your own admin account.');
        $user->delete();

        return to_route('admin.users');
    }
}
