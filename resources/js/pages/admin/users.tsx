import { Head, router, useForm } from '@inertiajs/react';
import {
    Activity,
    Check,
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    Mail,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    ShieldCheck,
    ShieldEllipsis,
    Store,
    Trash2,
    Truck,
    UserRound,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { PortalLayout } from '@/components/portal-layout';

type UserRole = { id: number; name: string };
type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string | null;
    avatar: string | null;
    created_at: string;
    orders_count: number;
    roles: UserRole[];
};
type UserStats = {
    total: number;
    admins: number;
    sellers: number;
    logistics: number;
    customers: number;
    active: number;
    suspended: number;
    new_this_month: number;
};
type ActivityPoint = { date: string; label: string; value: number };
type Props = { users: AdminUser[]; userStats: UserStats; activity: ActivityPoint[] };
type UserFormData = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: string;
    status: string;
    avatar: File | null;
};
type SortOption = 'newest' | 'oldest' | 'name';

const PAGE_SIZE = 10;
const emptyForm: UserFormData = { name: '', email: '', password: '', password_confirmation: '', role: 'customer', status: 'active', avatar: null };

function avatarUrl(path?: string | null) {
    if (!path) return null;
    return path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`;
}

function roleName(user: AdminUser) {
    return user.role || user.roles?.[0]?.name || 'customer';
}

function roleClass(role: string) {
    if (role === 'admin') return 'bg-[#f0edff] text-[#7164b5]';
    if (role === 'seller') return 'bg-[#e9f5fb] text-[#4282a2]';
    if (role === 'rider') return 'bg-[#e9f1fb] text-[#3d719e]';
    return 'bg-[#e5f6f3] text-[#288779]';
}

function dateLabel(value: string) {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function StatCard({ label, value, detail, Icon }: { label: string; value: number; detail: string; Icon: typeof UsersRound }) {
    return (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e4ebe6] bg-white p-3.5 shadow-[0_3px_13px_rgba(31,70,48,0.045)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eaf6ef] text-[#258553]">
                <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-medium text-[#607166]">{label}</p>
                <strong className="mt-0.5 block text-xl leading-none text-[#1c4b3d]">{value}</strong>
                <p className="mt-1 truncate text-[9px] text-[#829087]">{detail}</p>
            </div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    action,
    children,
    className = '',
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`min-w-0 rounded-xl border border-[#e4ebe6] bg-white p-3.5 shadow-[0_3px_13px_rgba(31,70,48,0.045)] sm:p-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-[#25372c]">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-[9px] text-[#7d8b82]">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function ActivityChart({ points }: { points: ActivityPoint[] }) {
    const hasActivity = points.some((point) => point.value > 0);
    const max = Math.max(1, ...points.map((point) => point.value));
    const coords = points.map((point, index) => ({
        ...point,
        x: points.length < 2 ? 300 : (index / (points.length - 1)) * 600,
        y: 144 - (point.value / max) * 112,
    }));
    const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
    const area = coords.length ? `0,150 ${line} 600,150` : '';
    const labelStep = Math.max(1, Math.ceil(points.length / 8));

    return hasActivity ? (
        <div className="mt-3">
            <svg
                viewBox="0 0 600 160"
                className="h-32 w-full overflow-visible sm:h-36"
                role="img"
                aria-label="User registrations over time"
                preserveAspectRatio="none"
            >
                {[30, 67, 104, 141].map((y) => (
                    <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#edf2ee" strokeDasharray="3 5" />
                ))}
                <polygon points={area} fill="#34a874" fillOpacity=".11" />
                <polyline
                    points={line}
                    fill="none"
                    stroke="#25945b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {coords.map((point) => (
                    <circle
                        key={point.date}
                        cx={point.x}
                        cy={point.y}
                        r="2.7"
                        fill="#fff"
                        stroke="#25945b"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                    >
                        <title>{`${point.label}: ${point.value} registrations`}</title>
                    </circle>
                ))}
            </svg>
            <div className="mt-1 flex justify-between gap-1 overflow-hidden text-[8px] text-[#7e8e83]">
                {points
                    .filter((_, index) => index % labelStep === 0 || index === points.length - 1)
                    .map((point) => (
                        <span key={point.date}>{point.label}</span>
                    ))}
            </div>
        </div>
    ) : (
        <div className="mt-3 flex h-36 items-center justify-center rounded-lg bg-[#f8fbf8] text-center text-[10px] text-[#849188]">
            No user registrations in this period.
        </div>
    );
}

function Donut({
    segments,
    total,
    centerValue = total,
    centerLabel,
}: {
    segments: { label: string; value: number; color: string }[];
    total: number;
    centerValue?: number;
    centerLabel: string;
}) {
    let cumulative = 0;
    const stops = segments
        .map((segment) => {
            const start = total ? (cumulative / total) * 100 : 0;
            cumulative += segment.value;
            const end = total ? (cumulative / total) * 100 : 0;
            return `${segment.color} ${start}% ${end}%`;
        })
        .join(', ');
    return (
        <div
            className="relative flex h-26 w-26 shrink-0 items-center justify-center rounded-full"
            style={{ background: total ? `conic-gradient(${stops})` : '#eaf1ec' }}
        >
            <div className="flex h-16.5 w-16.5 flex-col items-center justify-center rounded-full bg-white">
                <strong className="text-base leading-none text-[#1c4b3d]">{centerValue}</strong>
                <span className="mt-1 text-[8px] text-[#7d8b82]">{centerLabel}</span>
            </div>
        </div>
    );
}

function Modal({
    title,
    subtitle,
    onClose,
    children,
    alert = false,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    alert?: boolean;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#12251a]/40 p-3 backdrop-blur-[2px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role={alert ? 'alertdialog' : 'dialog'}
                aria-modal="true"
                aria-label={title}
                className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#e2ebe4] bg-white p-5 shadow-[0_20px_70px_rgba(17,47,30,0.2)] sm:p-6"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-[#1c4b3d]">{title}</h2>
                        {subtitle && <p className="mt-1 text-xs text-[#7d8b82]">{subtitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-[#718075] hover:bg-[#f1f6f2]">
                        <X size={18} />
                    </button>
                </div>
                {children}
            </section>
        </div>
    );
}

export default function AdminUsers({ users, userStats, activity }: Props) {
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState<SortOption>('newest');
    const [page, setPage] = useState(1);
    const [range, setRange] = useState<7 | 30 | 90>(30);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AdminUser | null>(null);
    const [viewing, setViewing] = useState<AdminUser | null>(null);
    const [deleting, setDeleting] = useState<AdminUser | null>(null);
    const [suspending, setSuspending] = useState<AdminUser | null>(null);
    const [menuId, setMenuId] = useState<number | null>(null);
    const form = useForm<UserFormData>(emptyForm);
    const previewUrl = useMemo(() => (form.data.avatar ? URL.createObjectURL(form.data.avatar) : null), [form.data.avatar]);
    const currentAvatar = previewUrl ?? avatarUrl(editing?.avatar);

    useEffect(
        () => () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        },
        [previewUrl],
    );

    const filteredUsers = useMemo(
        () =>
            users
                .filter((user) => {
                    const query = search.trim().toLowerCase();
                    return (
                        (!query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) &&
                        (role === 'all' || roleName(user) === role) &&
                        (status === 'all' || (user.status ?? 'active') === status)
                    );
                })
                .sort((a, b) => {
                    if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    if (sort === 'name') return a.name.localeCompare(b.name);
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                }),
        [users, search, role, status, sort],
    );
    const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const pageUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const visibleActivity = activity.slice(-range);

    function openCreate() {
        setEditing(null);
        form.setData(emptyForm);
        form.clearErrors();
        setFormOpen(true);
    }

    function openEdit(user: AdminUser) {
        setViewing(null);
        setEditing(user);
        form.setData({ ...emptyForm, name: user.name, email: user.email, role: roleName(user), status: user.status ?? 'active' });
        form.clearErrors();
        setFormOpen(true);
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setFormOpen(false);
                setEditing(null);
                form.reset();
            },
        };
        if (editing) {
            form.transform((data) => ({ ...data, _method: 'PATCH' })).post(route('admin.users.update', editing.id), {
                ...options,
                onFinish: () => form.transform((data) => data),
            });
        } else {
            form.post(route('admin.users.store'), options);
        }
    }

    function closeForm() {
        setFormOpen(false);
        setEditing(null);
        form.reset();
        form.clearErrors();
    }

    function confirmDelete() {
        if (!deleting) return;
        router.delete(route('admin.users.destroy', deleting.id), {
            preserveScroll: true,
            onSuccess: () => {
                if (viewing?.id === deleting.id) setViewing(null);
                setDeleting(null);
            },
        });
    }

    function confirmSuspend() {
        if (!suspending) return;
        router.patch(
            route('admin.users.update', suspending.id),
            {
                name: suspending.name,
                email: suspending.email,
                role: roleName(suspending),
                status: 'suspended',
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSuspending(null);
                    setViewing(null);
                },
            },
        );
    }

    return (
        <>
            <Head title="All users" />
            <PortalLayout role="admin" title="All users" eyebrow="People and access">
                <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <p className="font-mono text-[10px] font-bold tracking-[0.17em] text-[#328152] uppercase">Users</p>
                        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#173b27] sm:text-3xl">All users</h1>
                        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#6a7c70]">
                            Manage registered accounts, roles, and account status across the marketplace.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#269653] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#207e46]"
                    >
                        <Plus size={15} /> Add user
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total users" value={userStats.total} detail="Registered accounts" Icon={UsersRound} />
                    <StatCard label="Customers" value={userStats.customers} detail="Shopping accounts" Icon={UserRound} />
                    <StatCard label="Active users" value={userStats.active} detail="Currently enabled" Icon={ShieldCheck} />
                    <StatCard label="User activity" value={userStats.new_this_month} detail="Accounts this month" Icon={Activity} />
                </div>

                <section className="mt-4 overflow-hidden rounded-xl border border-[#e4ebe6] bg-white shadow-[0_3px_13px_rgba(31,70,48,0.045)]">
                    <div className="border-b border-[#e1ebe0] p-4">
                        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                            <div className="shrink-0">
                                <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.16em] text-[#328152] uppercase">
                                    <UsersRound size={13} /> Directory
                                </p>
                                <h2 className="mt-1 text-base font-bold text-[#173b27]">All users</h2>
                                <p className="mt-0.5 text-[10px] text-[#7a897d]">
                                    {filteredUsers.length} of {users.length} accounts shown
                                </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1fr)_auto_auto_auto_auto]">
                                <label className="relative min-w-0">
                                    <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#91a095]" />
                                    <input
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value);
                                            setPage(1);
                                        }}
                                        placeholder="Search users..."
                                        className="h-9 w-full rounded-lg border border-[#dfe7e1] bg-[#fbfdfb] pr-3 pl-8 text-[10px] outline-none focus:border-[#287e4a]"
                                    />
                                </label>
                                <select
                                    aria-label="Filter user roles"
                                    value={role}
                                    onChange={(event) => {
                                        setRole(event.target.value);
                                        setPage(1);
                                    }}
                                    className="h-9 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] text-[#53665a] outline-none focus:border-[#287e4a]"
                                >
                                    <option value="all">All roles</option>
                                    <option value="admin">Admins</option>
                                    <option value="seller">Sellers</option>
                                    <option value="rider">Logistics</option>
                                    <option value="customer">Customers</option>
                                </select>
                                <select
                                    aria-label="Filter user status"
                                    value={status}
                                    onChange={(event) => {
                                        setStatus(event.target.value);
                                        setPage(1);
                                    }}
                                    className="h-9 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] text-[#53665a] outline-none focus:border-[#287e4a]"
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                                <select
                                    aria-label="Sort users"
                                    value={sort}
                                    onChange={(event) => {
                                        setSort(event.target.value as SortOption);
                                        setPage(1);
                                    }}
                                    className="h-9 rounded-lg border border-[#dfe7e1] bg-white px-2.5 text-[10px] text-[#53665a] outline-none focus:border-[#287e4a]"
                                >
                                    <option value="newest">Sort by: Newest</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="name">Name A–Z</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={openCreate}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#269653] px-3 text-[10px] font-semibold text-white hover:bg-[#207e46]"
                                >
                                    <Plus size={13} /> Add user
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-190 text-left text-xs">
                            <thead className="bg-[#f1f6f0] text-[9px] tracking-[0.12em] text-[#718075] uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">User</th>
                                    <th className="px-4 py-3 font-semibold">Role</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Joined</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                    <th className="w-12 px-3 py-3" aria-label="More actions" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#edf1eb]">
                                {pageUsers.map((user) => {
                                    const userRole = roleName(user);
                                    const image = avatarUrl(user.avatar);
                                    return (
                                        <tr key={user.id} className="transition hover:bg-[#fbfdfb]">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f5ec] text-[#28834f]">
                                                        {image ? (
                                                            <img src={image} alt="" className="h-full w-full object-cover" />
                                                        ) : userRole === 'seller' ? (
                                                            <Store size={15} />
                                                        ) : (
                                                            <UserRound size={15} />
                                                        )}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <strong className="block truncate text-[10px] text-[#294231]">{user.name}</strong>
                                                        <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-[#829087]">
                                                            <Mail size={10} />
                                                            {user.email}
                                                        </span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className={`rounded-full px-2 py-1 text-[9px] font-semibold capitalize ${roleClass(userRole)}`}>
                                                    {userRole === 'rider' ? 'Logistics' : userRole}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span
                                                    className={`rounded-full px-2 py-1 text-[9px] font-semibold ${(user.status ?? 'active') === 'active' ? 'bg-[#e4f7ed] text-[#25834d]' : 'bg-[#fff0ed] text-[#bd5144]'}`}
                                                >
                                                    {(user.status ?? 'active') === 'active' ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-[9px] text-[#718075]">{dateLabel(user.created_at)}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Edit ${user.name}`}
                                                        onClick={() => openEdit(user)}
                                                        className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[#dce9de] bg-[#f8fcf8] text-[#21804b] hover:bg-[#edf7ef]"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Delete ${user.name}`}
                                                        onClick={() => setDeleting(user)}
                                                        className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[#f0dfdc] text-[#d45f53] hover:bg-[#fff4f2]"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="relative px-3 py-2.5">
                                                <button
                                                    type="button"
                                                    aria-label={`More actions for ${user.name}`}
                                                    aria-expanded={menuId === user.id}
                                                    onClick={() => setMenuId(menuId === user.id ? null : user.id)}
                                                    className="rounded-md p-1.5 text-[#328152] hover:bg-[#edf5ef]"
                                                >
                                                    <MoreHorizontal size={16} />
                                                </button>
                                                {menuId === user.id && (
                                                    <div className="absolute top-9 right-3 z-20 w-40 rounded-lg border border-[#e1e9e2] bg-white p-1 shadow-lg">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setViewing(user);
                                                                setMenuId(null);
                                                            }}
                                                            className="w-full rounded-md px-2.5 py-2 text-left text-[10px] text-[#405348] hover:bg-[#f3f8f4]"
                                                        >
                                                            View profile
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                openEdit(user);
                                                                setMenuId(null);
                                                            }}
                                                            className="w-full rounded-md px-2.5 py-2 text-left text-[10px] text-[#405348] hover:bg-[#f3f8f4]"
                                                        >
                                                            Edit user
                                                        </button>
                                                        {(user.status ?? 'active') === 'active' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSuspending(user);
                                                                    setMenuId(null);
                                                                }}
                                                                className="w-full rounded-md px-2.5 py-2 text-left text-[10px] text-[#a7463e] hover:bg-[#fff5f3]"
                                                            >
                                                                Suspend user
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDeleting(user);
                                                                setMenuId(null);
                                                            }}
                                                            className="w-full rounded-md px-2.5 py-2 text-left text-[10px] text-[#a7463e] hover:bg-[#fff5f3]"
                                                        >
                                                            Delete user
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pageUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-14 text-center text-xs text-[#718075]">
                                            No users match the current filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-[#edf1eb] px-4 py-3 text-[9px] text-[#718075] sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Showing {filteredUsers.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
                            {Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
                        </span>
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                            <button
                                type="button"
                                disabled={currentPage === 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#dfe7e1] px-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft size={12} /> Previous
                            </button>
                            <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-[#259653] px-2 font-semibold text-white">
                                {currentPage}
                            </span>
                            <button
                                type="button"
                                disabled={currentPage >= pageCount}
                                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#dfe7e1] px-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                </section>

                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.85fr)_minmax(240px,0.85fr)]">
                    <Panel
                        title="User activity"
                        subtitle="Monitor account registration and status activity"
                        action={
                            <div className="inline-flex rounded-lg border border-[#e1e9e2] bg-[#f8fbf8] p-0.5">
                                {([7, 30, 90] as const).map((days) => (
                                    <button
                                        key={days}
                                        type="button"
                                        aria-pressed={range === days}
                                        onClick={() => setRange(days)}
                                        className={`rounded-md px-2 py-1.5 text-[8px] font-semibold ${range === days ? 'bg-white text-[#287e4a] shadow-sm' : 'text-[#7b897e]'}`}
                                    >
                                        {days === 90 ? '3 Months' : `${days} Days`}
                                    </button>
                                ))}
                            </div>
                        }
                    >
                        <ActivityChart points={visibleActivity} />
                    </Panel>
                    <Panel title="Users by role" subtitle="Role distribution across all users">
                        <div className="mt-4 flex items-center gap-3">
                            <Donut
                                total={userStats.total}
                                centerLabel="Total users"
                                segments={[
                                    { label: 'Admins', value: userStats.admins, color: '#9bceae' },
                                    { label: 'Sellers', value: userStats.sellers, color: '#52b86e' },
                                    { label: 'Logistics', value: userStats.logistics, color: '#4a9bd4' },
                                    { label: 'Customers', value: userStats.customers, color: '#14864d' },
                                ]}
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                                {[
                                    ['Admins', userStats.admins, '#9bceae'],
                                    ['Sellers', userStats.sellers, '#52b86e'],
                                    ['Logistics', userStats.logistics, '#4a9bd4'],
                                    ['Customers', userStats.customers, '#14864d'],
                                ].map(([label, value, color]) => (
                                    <div key={String(label)} className="flex items-center justify-between gap-1 text-[9px] text-[#6c7d72]">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} />
                                            {label}
                                        </span>
                                        <strong className="text-[#587064]">{value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                    <Panel title="Account status" subtitle="Status distribution">
                        <div className="mt-4 flex items-center gap-3">
                            <Donut
                                total={userStats.total}
                                centerValue={userStats.active}
                                centerLabel="Active"
                                segments={[
                                    { label: 'Active', value: userStats.active, color: '#269c5b' },
                                    { label: 'Suspended', value: userStats.suspended, color: '#ee8277' },
                                ]}
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                                {[
                                    ['Active', userStats.active, '#48b86f'],
                                    ['Suspended', userStats.suspended, '#ee8277'],
                                ].map(([label, value, color]) => (
                                    <div key={String(label)} className="flex items-center justify-between gap-1 text-[9px] text-[#6c7d72]">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} />
                                            {label}
                                        </span>
                                        <strong className="text-[#587064]">{value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
                    <StatCard label="Total users" value={userStats.total} detail="All accounts" Icon={UsersRound} />
                    <StatCard label="Admins" value={userStats.admins} detail="Admin accounts" Icon={ShieldEllipsis} />
                    <StatCard label="Sellers" value={userStats.sellers} detail="Seller accounts" Icon={Store} />
                    <StatCard label="Logistics" value={userStats.logistics} detail="Delivery accounts" Icon={Truck} />
                    <StatCard label="Customers" value={userStats.customers} detail="Customer accounts" Icon={UserRound} />
                    <StatCard label="Active users" value={userStats.active} detail="Currently enabled" Icon={ShieldCheck} />
                    <StatCard label="Suspended users" value={userStats.suspended} detail="Access suspended" Icon={X} />
                </div>
            </PortalLayout>

            {formOpen && (
                <Modal
                    title={editing ? 'Edit user' : 'Add user'}
                    subtitle={editing ? 'Update the account details and access.' : 'Create a new marketplace account.'}
                    onClose={closeForm}
                >
                    <form onSubmit={submit} className="mt-5 space-y-3">
                        <label className="block text-[10px] font-semibold text-[#53665a]">
                            Full name
                            <input
                                required
                                value={form.data.name}
                                onChange={(event) => form.setData('name', event.target.value)}
                                className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                            />
                            {form.errors.name && <span className="mt-1 block text-[10px] text-red-600">{form.errors.name}</span>}
                        </label>
                        <label className="block text-[10px] font-semibold text-[#53665a]">
                            Email address
                            <input
                                required
                                type="email"
                                value={form.data.email}
                                onChange={(event) => form.setData('email', event.target.value)}
                                className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                            />
                            {form.errors.email && <span className="mt-1 block text-[10px] text-red-600">{form.errors.email}</span>}
                        </label>
                        {!editing && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-[10px] font-semibold text-[#53665a]">
                                    Password
                                    <input
                                        required
                                        type="password"
                                        value={form.data.password}
                                        onChange={(event) => form.setData('password', event.target.value)}
                                        className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                                    />
                                    {form.errors.password && <span className="mt-1 block text-[10px] text-red-600">{form.errors.password}</span>}
                                </label>
                                <label className="block text-[10px] font-semibold text-[#53665a]">
                                    Confirm password
                                    <input
                                        required
                                        type="password"
                                        value={form.data.password_confirmation}
                                        onChange={(event) => form.setData('password_confirmation', event.target.value)}
                                        className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                                    />
                                </label>
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-[10px] font-semibold text-[#53665a]">
                                Role
                                <select
                                    value={form.data.role}
                                    onChange={(event) => form.setData('role', event.target.value)}
                                    className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] bg-white px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="seller">Seller</option>
                                    <option value="rider">Logistics</option>
                                    <option value="customer">Customer</option>
                                </select>
                                {form.errors.role && <span className="mt-1 block text-[10px] text-red-600">{form.errors.role}</span>}
                            </label>
                            <label className="block text-[10px] font-semibold text-[#53665a]">
                                Status
                                <select
                                    value={form.data.status}
                                    onChange={(event) => form.setData('status', event.target.value)}
                                    className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe7e1] bg-white px-3 text-xs font-normal outline-none focus:border-[#287e4a]"
                                >
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                                {form.errors.status && <span className="mt-1 block text-[10px] text-red-600">{form.errors.status}</span>}
                            </label>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-[#53665a]">Profile image</label>
                            <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#d4e2d7] bg-[#fbfdfb] p-3 hover:bg-[#f5faf6]">
                                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#e8f5ec] text-[#28834f]">
                                    {currentAvatar ? (
                                        <img src={currentAvatar} alt="Profile preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <ImagePlus size={18} />
                                    )}
                                </span>
                                <span className="text-[10px] text-[#65766b]">
                                    {form.data.avatar?.name ??
                                        (editing?.avatar
                                            ? 'Choose a new image to replace this profile photo'
                                            : 'Choose JPG, PNG, or WebP · max 2 MB')}
                                </span>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    onChange={(event) => form.setData('avatar', event.target.files?.[0] ?? null)}
                                />
                            </label>
                            {form.errors.avatar && <span className="mt-1 block text-[10px] text-red-600">{form.errors.avatar}</span>}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[#edf1eb] pt-4">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="h-9 rounded-lg border border-[#dfe7e1] px-4 text-xs font-semibold text-[#647369]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#269653] px-4 text-xs font-semibold text-white disabled:opacity-60"
                            >
                                <Check size={14} /> {editing ? 'Save changes' : 'Create user'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {viewing && (
                <Modal title={viewing.name} subtitle={`Account #${viewing.id}`} onClose={() => setViewing(null)}>
                    <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f7faf7] p-3">
                        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#e8f5ec] text-[#28834f]">
                            {avatarUrl(viewing.avatar) ? (
                                <img src={avatarUrl(viewing.avatar) ?? ''} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <UserRound size={20} />
                            )}
                        </span>
                        <div>
                            <strong className="text-sm text-[#294231]">{viewing.name}</strong>
                            <p className="mt-0.5 text-[10px] text-[#819087]">{viewing.email}</p>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                            ['Name', viewing.name],
                            ['Email', viewing.email],
                            ['Role', roleName(viewing)],
                            ['Status', (viewing.status ?? 'active') === 'active' ? 'Active' : 'Suspended'],
                            ['Joined date', dateLabel(viewing.created_at)],
                            ['Account activity', `${viewing.orders_count} orders`],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-[#eaf0eb] p-3">
                                <p className="text-[9px] text-[#829087]">{label}</p>
                                <p className="mt-1 text-[10px] font-semibold text-[#405348] capitalize">{value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex justify-end gap-2 border-t border-[#edf1eb] pt-4">
                        {(viewing.status ?? 'active') === 'active' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSuspending(viewing);
                                    setViewing(null);
                                }}
                                className="h-8 rounded-md border border-[#f0d9d5] px-3 text-[10px] font-semibold text-[#ad4c42]"
                            >
                                Suspend user
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => openEdit(viewing)}
                            className="h-8 rounded-md bg-[#287e4a] px-3 text-[10px] font-semibold text-white"
                        >
                            Edit user
                        </button>
                    </div>
                </Modal>
            )}

            {deleting && (
                <Modal alert title="Delete user?" subtitle="Are you sure you want to delete this user account?" onClose={() => setDeleting(null)}>
                    <div className="mt-5 rounded-lg bg-[#fff8f6] p-3 text-xs text-[#53665a]">
                        <strong className="text-[#294231]">{deleting.name}</strong>
                        <br />
                        {deleting.email}
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setDeleting(null)}
                            className="h-9 rounded-lg border border-[#dfe7e1] px-4 text-xs font-semibold text-[#647369]"
                        >
                            Cancel
                        </button>
                        <button type="button" onClick={confirmDelete} className="h-9 rounded-lg bg-[#bd5144] px-4 text-xs font-semibold text-white">
                            Delete user
                        </button>
                    </div>
                </Modal>
            )}

            {suspending && (
                <Modal alert title="Suspend user?" subtitle="Are you sure you want to suspend this account?" onClose={() => setSuspending(null)}>
                    <div className="mt-5 rounded-lg bg-[#fff8f6] p-3 text-xs text-[#53665a]">
                        <strong className="text-[#294231]">{suspending.name}</strong>
                        <br />
                        {suspending.email}
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setSuspending(null)}
                            className="h-9 rounded-lg border border-[#dfe7e1] px-4 text-xs font-semibold text-[#647369]"
                        >
                            Cancel
                        </button>
                        <button type="button" onClick={confirmSuspend} className="h-9 rounded-lg bg-[#bd5144] px-4 text-xs font-semibold text-white">
                            Suspend user
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
}
