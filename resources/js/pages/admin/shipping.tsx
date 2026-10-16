import { PortalLayout } from '@/components/portal-layout';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Check, Plus, Save, Trash2, X } from 'lucide-react';
import { FormEvent, useState } from 'react';

type DeliveryZone = {
    id: number;
    name: string;
    barangay: string;
    description: string | null;
    delivery_fee: string;
    is_free_delivery: boolean;
    free_delivery_minimum: string | null;
    estimated_delivery_min: number | null;
    estimated_delivery_max: number | null;
    estimated_delivery_text: string;
    status: 'active' | 'inactive';
    sort_order: number;
};

type ZoneForm = {
    name: string;
    barangay: string;
    description: string;
    delivery_fee: string;
    is_free_delivery: boolean;
    free_delivery_minimum: string;
    estimated_delivery_min: string;
    estimated_delivery_max: string;
    estimated_delivery_text: string;
    status: 'active' | 'inactive';
};

type DeliveryOptionKey = 'local_delivery' | 'seller_delivery' | 'pickup';
type ShippingStep = { title: string; description: string };
type ContentForm = { delivery_options: Record<DeliveryOptionKey, boolean>; delivery_steps: ShippingStep[] };

const emptyZone: ZoneForm = {
    name: '',
    barangay: '',
    description: '',
    delivery_fee: '',
    is_free_delivery: false,
    free_delivery_minimum: '',
    estimated_delivery_min: '',
    estimated_delivery_max: '',
    estimated_delivery_text: '',
    status: 'active',
};

const optionLabels: Record<DeliveryOptionKey, { title: string; description: string }> = {
    local_delivery: { title: 'Local Delivery', description: 'Seller or BSAB-Shop delivery personnel delivers orders.' },
    seller_delivery: { title: 'Seller Delivery', description: 'The seller personally handles delivery.' },
    pickup: { title: 'Pickup', description: 'Customers collect orders from the seller when available.' },
};

const fieldClassName = 'w-full rounded-lg border border-[#dfe8e1] bg-white px-3 py-2.5 text-sm text-[#173b27] outline-none focus:border-[#2c9350]';
const labelClassName = 'grid gap-1.5 text-xs font-semibold text-[#315947]';

function formatPeso(value: string | number) {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminShipping({
    deliveryZones,
    deliveryOptions,
    deliverySteps,
}: {
    deliveryZones: DeliveryZone[];
    deliveryOptions: Record<DeliveryOptionKey, boolean>;
    deliverySteps: ShippingStep[];
}) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const zoneForm = useForm<ZoneForm>(emptyZone);
    const contentForm = useForm<ContentForm>({
        delivery_options: deliveryOptions,
        delivery_steps: deliverySteps,
    });

    function startCreate() {
        setEditingId(null);
        zoneForm.setData(emptyZone);
        zoneForm.clearErrors();
        setShowForm(true);
    }

    function startEdit(zone: DeliveryZone) {
        setEditingId(zone.id);
        zoneForm.setData({
            name: zone.name,
            barangay: zone.barangay,
            description: zone.description ?? '',
            delivery_fee: zone.delivery_fee,
            is_free_delivery: zone.is_free_delivery,
            free_delivery_minimum: zone.free_delivery_minimum ?? '',
            estimated_delivery_min: zone.estimated_delivery_min?.toString() ?? '',
            estimated_delivery_max: zone.estimated_delivery_max?.toString() ?? '',
            estimated_delivery_text: zone.estimated_delivery_text,
            status: zone.status,
        });
        zoneForm.clearErrors();
        setShowForm(true);
    }

    function submitZone(event: FormEvent) {
        event.preventDefault();
        const values = {
            ...zoneForm.data,
            free_delivery_minimum: zoneForm.data.free_delivery_minimum || null,
            estimated_delivery_min: zoneForm.data.estimated_delivery_min || null,
            estimated_delivery_max: zoneForm.data.estimated_delivery_max || null,
        };
        if (editingId) {
            zoneForm.transform(() => values);
            zoneForm.put(route('admin.shipping.zones.update', editingId), {
                preserveScroll: true,
                onSuccess: () => setShowForm(false),
            });
        } else {
            zoneForm.transform(() => values);
            zoneForm.post(route('admin.shipping.zones.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    setShowForm(false);
                    zoneForm.reset();
                },
            });
        }
    }

    function toggleZone(zone: DeliveryZone) {
        const values: ZoneForm = {
            name: zone.name,
            barangay: zone.barangay,
            description: zone.description ?? '',
            delivery_fee: zone.delivery_fee,
            is_free_delivery: zone.is_free_delivery,
            free_delivery_minimum: zone.free_delivery_minimum ?? '',
            estimated_delivery_min: zone.estimated_delivery_min?.toString() ?? '',
            estimated_delivery_max: zone.estimated_delivery_max?.toString() ?? '',
            estimated_delivery_text: zone.estimated_delivery_text,
            status: zone.status === 'active' ? 'inactive' : 'active',
        };
        router.put(route('admin.shipping.zones.update', zone.id), values, { preserveScroll: true });
    }

    function reorderZone(index: number, direction: -1 | 1) {
        const ids = deliveryZones.map((zone) => zone.id);
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= ids.length) return;
        [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
        router.put(route('admin.shipping.zones.reorder'), { delivery_zone_ids: ids }, { preserveScroll: true });
    }

    function updateStep(index: number, field: keyof ShippingStep, value: string) {
        contentForm.setData((data) => ({
            ...data,
            delivery_steps: data.delivery_steps.map((step, stepIndex) => (stepIndex === index ? { ...step, [field]: value } : step)),
        }));
    }

    function submitContent(event: FormEvent) {
        event.preventDefault();
        contentForm.put(route('admin.shipping.content'), { preserveScroll: true });
    }

    return (
        <>
            <Head title="Shipping information management" />
            <PortalLayout role="admin" title="Shipping information" eyebrow="Local delivery management" wideContent>
                <div className="mx-auto max-w-6xl space-y-6">
                    <header className="rounded-2xl border border-[#dcebe0] bg-white p-5 shadow-sm sm:p-7">
                        <p className="text-xs font-bold tracking-[0.18em] text-[#4e8b62] uppercase">Hinoba-an local delivery</p>
                        <h1 className="font-display mt-1 text-2xl font-bold text-[#173b27]">Shipping information</h1>
                        <p className="mt-2 max-w-3xl text-sm text-[#6a7c70]">
                            Manage delivery zones and fees shown on the Shipping Information page and used by checkout.
                        </p>
                    </header>

                    <section className="rounded-2xl border border-[#dcebe0] bg-white p-5 shadow-sm sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="font-display text-lg font-bold text-[#173b27]">Delivery zones &amp; fees</h2>
                                <p className="mt-1 text-sm text-[#6a7c70]">Only active zones are available at checkout.</p>
                            </div>
                            <button
                                type="button"
                                onClick={startCreate}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#188747] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#126d39]"
                            >
                                <Plus size={16} /> Add delivery zone
                            </button>
                        </div>

                        {showForm && (
                            <form onSubmit={submitZone} className="mt-5 rounded-xl border border-[#cfe5d3] bg-[#f7fbf7] p-4 sm:p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-semibold text-[#173b27]">{editingId ? 'Edit delivery zone' : 'Add delivery zone'}</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        aria-label="Close delivery zone form"
                                        className="rounded-lg p-2 text-[#647568] hover:bg-white"
                                    >
                                        <X size={17} />
                                    </button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className={labelClassName}>
                                        Zone name
                                        <input
                                            value={zoneForm.data.name}
                                            onChange={(event) => zoneForm.setData('name', event.target.value)}
                                            className={fieldClassName}
                                            required
                                        />
                                        {zoneForm.errors.name && <span className="font-normal text-red-600">{zoneForm.errors.name}</span>}
                                    </label>
                                    <label className={labelClassName}>
                                        Barangay
                                        <input
                                            value={zoneForm.data.barangay}
                                            onChange={(event) => zoneForm.setData('barangay', event.target.value)}
                                            className={fieldClassName}
                                            required
                                        />
                                        {zoneForm.errors.barangay && <span className="font-normal text-red-600">{zoneForm.errors.barangay}</span>}
                                    </label>
                                    <label className={`${labelClassName} md:col-span-2`}>
                                        Description
                                        <textarea
                                            rows={2}
                                            value={zoneForm.data.description}
                                            onChange={(event) => zoneForm.setData('description', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        {zoneForm.errors.description && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.description}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Delivery fee (PHP)
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={zoneForm.data.delivery_fee}
                                            onChange={(event) => zoneForm.setData('delivery_fee', event.target.value)}
                                            className={fieldClassName}
                                            required
                                        />
                                        {zoneForm.errors.delivery_fee && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.delivery_fee}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Estimated delivery
                                        <input
                                            placeholder="Same day–2 days"
                                            value={zoneForm.data.estimated_delivery_text}
                                            onChange={(event) => zoneForm.setData('estimated_delivery_text', event.target.value)}
                                            className={fieldClassName}
                                            required
                                        />
                                        {zoneForm.errors.estimated_delivery_text && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.estimated_delivery_text}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Minimum delivery days (optional)
                                        <input
                                            type="number"
                                            min="0"
                                            max="365"
                                            value={zoneForm.data.estimated_delivery_min}
                                            onChange={(event) => zoneForm.setData('estimated_delivery_min', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        {zoneForm.errors.estimated_delivery_min && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.estimated_delivery_min}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Maximum delivery days (optional)
                                        <input
                                            type="number"
                                            min="0"
                                            max="365"
                                            value={zoneForm.data.estimated_delivery_max}
                                            onChange={(event) => zoneForm.setData('estimated_delivery_max', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        {zoneForm.errors.estimated_delivery_max && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.estimated_delivery_max}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Free delivery minimum (optional)
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={zoneForm.data.free_delivery_minimum}
                                            onChange={(event) => zoneForm.setData('free_delivery_minimum', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        <span className="font-normal text-[#758579]">
                                            When free delivery is enabled, leave blank for all orders to qualify.
                                        </span>
                                        {zoneForm.errors.free_delivery_minimum && (
                                            <span className="font-normal text-red-600">{zoneForm.errors.free_delivery_minimum}</span>
                                        )}
                                    </label>
                                    <label
                                        className={`${labelClassName} flex grid-cols-[auto_1fr] items-center gap-3 self-center rounded-lg border border-[#dfe8e1] bg-white p-3`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={zoneForm.data.is_free_delivery}
                                            onChange={(event) => zoneForm.setData('is_free_delivery', event.target.checked)}
                                            className="h-4 w-4 accent-[#188747]"
                                        />
                                        <span>Enable free delivery for this zone</span>
                                    </label>
                                    <label className={labelClassName}>
                                        Status
                                        <select
                                            value={zoneForm.data.status}
                                            onChange={(event) => zoneForm.setData('status', event.target.value as ZoneForm['status'])}
                                            className={fieldClassName}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="rounded-lg border border-[#d7e5d9] px-4 py-2 text-sm font-semibold text-[#526157] hover:bg-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={zoneForm.processing}
                                        className="inline-flex items-center gap-2 rounded-lg bg-[#188747] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126d39] disabled:opacity-50"
                                    >
                                        <Save size={15} /> {zoneForm.processing ? 'Saving...' : 'Save delivery zone'}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="mt-5 overflow-x-auto rounded-xl border border-[#e4ebe6]">
                            <table className="w-full min-w-190 text-left text-sm">
                                <thead className="bg-[#f7faf7] text-xs text-[#647568] uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Delivery zone</th>
                                        <th className="px-4 py-3">Estimated delivery</th>
                                        <th className="px-4 py-3">Delivery fee</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e4ebe6]">
                                    {deliveryZones.map((zone, index) => (
                                        <tr key={zone.id} className="bg-white">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-[#173b27]">{zone.name}</p>
                                                <p className="text-xs text-[#6a7c70]">
                                                    {zone.barangay}
                                                    {zone.description ? ` · ${zone.description}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-[#526157]">{zone.estimated_delivery_text}</td>
                                            <td className="px-4 py-3 font-semibold text-[#315947]">
                                                {zone.is_free_delivery ? (
                                                    <span>
                                                        {zone.free_delivery_minimum
                                                            ? `${formatPeso(zone.delivery_fee)} · FREE at/over ${formatPeso(zone.free_delivery_minimum)}`
                                                            : 'FREE'}
                                                    </span>
                                                ) : (
                                                    formatPeso(zone.delivery_fee)
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${zone.status === 'active' ? 'bg-[#e8f6eb] text-[#1f7a42]' : 'bg-[#f1f2f1] text-[#69736c]'}`}
                                                >
                                                    {zone.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => reorderZone(index, -1)}
                                                        aria-label={`Move ${zone.name} up`}
                                                        className="rounded-lg p-2 text-[#526157] hover:bg-[#f3f8f4] disabled:opacity-30"
                                                    >
                                                        <ArrowUp size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === deliveryZones.length - 1}
                                                        onClick={() => reorderZone(index, 1)}
                                                        aria-label={`Move ${zone.name} down`}
                                                        className="rounded-lg p-2 text-[#526157] hover:bg-[#f3f8f4] disabled:opacity-30"
                                                    >
                                                        <ArrowDown size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(zone)}
                                                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1f7a42] hover:bg-[#f3f8f4]"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleZone(zone)}
                                                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#526157] hover:bg-[#f3f8f4]"
                                                    >
                                                        {zone.status === 'active' ? 'Disable' : 'Activate'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm(`Delete the ${zone.name} delivery zone?`))
                                                                router.delete(route('admin.shipping.zones.destroy', zone.id), {
                                                                    preserveScroll: true,
                                                                });
                                                        }}
                                                        aria-label={`Delete ${zone.name}`}
                                                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {deliveryZones.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#6a7c70]">
                                                No delivery zones configured. Add a zone to make local checkout available.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <form onSubmit={submitContent} className="space-y-5 rounded-2xl border border-[#dcebe0] bg-white p-5 shadow-sm sm:p-7">
                        <div>
                            <h2 className="font-display text-lg font-bold text-[#173b27]">Delivery options &amp; process</h2>
                            <p className="mt-1 text-sm text-[#6a7c70]">
                                Choose which fulfillment options customers can select and edit the five process steps.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {(Object.entries(optionLabels) as [DeliveryOptionKey, (typeof optionLabels)[DeliveryOptionKey]][]).map(
                                ([key, option]) => (
                                    <label key={key} className="flex gap-3 rounded-xl border border-[#e4ebe6] bg-[#fbfdfb] p-4">
                                        <input
                                            type="checkbox"
                                            checked={contentForm.data.delivery_options[key]}
                                            onChange={(event) =>
                                                contentForm.setData('delivery_options', {
                                                    ...contentForm.data.delivery_options,
                                                    [key]: event.target.checked,
                                                })
                                            }
                                            className="mt-1 h-4 w-4 accent-[#188747]"
                                        />
                                        <span>
                                            <span className="block text-sm font-semibold text-[#173b27]">{option.title}</span>
                                            <span className="mt-1 block text-xs text-[#6a7c70]">{option.description}</span>
                                        </span>
                                    </label>
                                ),
                            )}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            {contentForm.data.delivery_steps.map((step, index) => (
                                <div key={`step-${index}`} className="grid gap-3 rounded-xl border border-[#e4ebe6] bg-[#fbfdfb] p-4">
                                    <label className={labelClassName}>
                                        Step {index + 1} title
                                        <input
                                            value={step.title}
                                            onChange={(event) => updateStep(index, 'title', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        {contentForm.errors[`delivery_steps.${index}.title`] && (
                                            <span className="font-normal text-red-600">{contentForm.errors[`delivery_steps.${index}.title`]}</span>
                                        )}
                                    </label>
                                    <label className={labelClassName}>
                                        Description
                                        <textarea
                                            rows={2}
                                            value={step.description}
                                            onChange={(event) => updateStep(index, 'description', event.target.value)}
                                            className={fieldClassName}
                                        />
                                        {contentForm.errors[`delivery_steps.${index}.description`] && (
                                            <span className="font-normal text-red-600">
                                                {contentForm.errors[`delivery_steps.${index}.description`]}
                                            </span>
                                        )}
                                    </label>
                                </div>
                            ))}
                        </div>
                        <button
                            type="submit"
                            disabled={contentForm.processing}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#188747] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#126d39] disabled:opacity-50"
                        >
                            <Check size={16} /> {contentForm.processing ? 'Saving...' : 'Save shipping options'}
                        </button>
                        {contentForm.recentlySuccessful && (
                            <span role="status" className="ml-3 text-sm font-semibold text-[#23824a]">
                                Shipping options saved.
                            </span>
                        )}
                    </form>
                </div>
            </PortalLayout>
        </>
    );
}
