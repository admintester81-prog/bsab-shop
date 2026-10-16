import { PortalLayout } from '@/components/portal-layout';
import { api, checkoutCart, currentUser, getApiErrorMessage, prepareSanctum, removeCartItem, updateCartItem } from '@/lib/api';
import { optimizeImage } from '@/lib/image-upload';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, CreditCard, MapPin, Minus, PackageCheck, Phone, Plus, ShieldCheck, ShoppingBag, Trash2, Truck, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type CheckoutStep = 'cart' | 'shipping' | 'payment' | 'review' | 'success';
type AddressForm = {
    full_name: string;
    phone: string;
    barangay: string;
    line1: string;
    house_number: string;
    delivery_instructions: string;
    city: string;
    province: string;
    postal_code: string;
};
type SavedAddress = AddressForm & { id?: number; is_default?: boolean };
type CartItem = {
    id: number;
    quantity: number;
    price_snapshot: string;
    variant?: { name: string } | null;
    product?: {
        name: string;
        shop?: {
            id: number;
            name: string;
            gcash_enabled: boolean;
            gcash_account_name?: string | null;
            gcash_mobile_number?: string | null;
            gcash_qr_code_url?: string | null;
        };
        images?: { path: string; is_primary: boolean }[];
    };
};
type CartShop = NonNullable<NonNullable<CartItem['product']>['shop']>;
type CartData = {
    items: CartItem[];
    voucher?: { id: number; code: string; name: string } | null;
    voucher_quote?: { code: string; discount: number; eligible_subtotal: number; free_shipping: boolean } | null;
};
type DeliveryZone = {
    id: number;
    name: string;
    barangay: string | null;
    delivery_fee: string;
    is_free_delivery: boolean;
    free_delivery_minimum: string | null;
    estimated_delivery_text: string;
};
type DeliveryOption = 'local_delivery' | 'seller_delivery' | 'pickup';
type CheckoutProps = {
    selectedItemIds?: number[];
    deliveryZones: DeliveryZone[];
    deliveryOptions: Record<DeliveryOption, boolean>;
};
type CheckoutOrder = { id: number; order_number: string };

const emptyAddress: AddressForm = {
    full_name: '',
    phone: '',
    barangay: '',
    line1: '',
    house_number: '',
    delivery_instructions: '',
    city: 'Hinoba-an',
    province: 'Negros Occidental',
    postal_code: '',
};
const stepLabels = ['Cart', 'Shipping', 'Payment', 'Review'];

function normalizeBarangay(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? '';
}

function formatPrice(value: number) {
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function ProgressStepper({ step }: { step: CheckoutStep }) {
    const activeIndex = step === 'cart' ? 0 : step === 'shipping' ? 1 : step === 'payment' ? 2 : 3;

    return (
        <div className="mx-auto mt-4 flex w-full max-w-180 items-center justify-between gap-2 overflow-hidden rounded-full border border-[#dfeee5] bg-white/80 px-3 py-2 shadow-[0_8px_30px_rgba(22,59,36,0.04)] sm:px-4">
            {stepLabels.map((label, index) => {
                const isComplete = index < activeIndex;
                const isActive = index === activeIndex;
                const circleClass = isComplete
                    ? 'bg-[#1f7a42] text-white'
                    : isActive
                      ? 'border-[#1f7a42] bg-[#eaf8ee] text-[#1f7a42]'
                      : 'border-[#dfeee5] bg-[#f7faf7] text-[#7e8d87]';
                return (
                    <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${circleClass}`}>
                            {isComplete ? <Check size={14} /> : index + 1}
                        </div>
                        <span
                            className={`hidden truncate text-[10px] font-semibold sm:inline ${isActive ? 'text-[#163b24]' : isComplete ? 'text-[#2c7a3b]' : 'text-[#7e8d87]'}`}
                        >
                            {label}
                        </span>
                        {index < stepLabels.length - 1 && <div className="hidden h-px flex-1 bg-[#dfeee5] sm:block" />}
                    </div>
                );
            })}
        </div>
    );
}

function OrderSummary({
    items,
    subtotal,
    shippingLabel,
    discount,
    total,
    step,
    onPlaceOrder,
    disabled,
    isSubmitting,
    voucher,
    voucherCode,
    voucherBusy,
    onVoucherCodeChange,
    onApplyVoucher,
    onRemoveVoucher,
}: {
    items: CartItem[];
    subtotal: number;
    shippingLabel: string;
    discount: number;
    total: number;
    step: CheckoutStep;
    onPlaceOrder: () => void;
    disabled: boolean;
    isSubmitting: boolean;
    voucher: CartData['voucher_quote'];
    voucherCode: string;
    voucherBusy: boolean;
    onVoucherCodeChange: (value: string) => void;
    onApplyVoucher: () => void;
    onRemoveVoucher: () => void;
}) {
    return (
        <aside className="rounded-[26px] border border-[#dfeee5] bg-[#ebf9ee] p-4 shadow-[0_12px_35px_rgba(22,59,36,0.06)] sm:p-5 lg:sticky lg:top-5">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-[#163b24]">Order summary</h3>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold tracking-[0.16em] text-[#2c7a3b] uppercase">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="mt-5 space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-2.5">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#e9f6ea]">
                            {item.product?.images?.[0]?.path ? (
                                <img
                                    src={
                                        item.product.images[0].path.startsWith('/')
                                            ? item.product.images[0].path
                                            : `/storage/${item.product.images[0].path}`
                                    }
                                    alt={item.product?.name || 'Product'}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <ShoppingBag size={22} className="text-[#2c9350]" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#163b24]">{item.product?.name || 'Product'}</p>
                            <p className="mt-0.5 text-xs text-[#647568]">Qty {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-[#163b24]">{formatPrice(Number(item.price_snapshot) * item.quantity)}</p>
                    </div>
                ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-[#647568]">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Local delivery fee</span>
                    <span>{shippingLabel}</span>
                </div>
                <div className="rounded-xl border border-[#dfeee5] bg-white p-3">
                    <p className="mb-2 text-xs font-bold text-[#163b24]">Voucher</p>
                    {voucher ? (
                        <div className="flex items-center justify-between gap-2 text-xs text-[#1f7a42]">
                            <span className="truncate">
                                <b>{voucher.code}</b> applied
                            </span>
                            <button type="button" disabled={voucherBusy} onClick={onRemoveVoucher} className="font-bold underline">
                                Remove
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                value={voucherCode}
                                onChange={(event) => onVoucherCodeChange(event.target.value.toUpperCase())}
                                placeholder="Enter code"
                                className="min-w-0 flex-1 rounded-lg border border-[#dfeee5] px-2.5 py-2 text-xs uppercase"
                            />
                            <button
                                type="button"
                                disabled={voucherBusy || !voucherCode.trim()}
                                onClick={onApplyVoucher}
                                className="rounded-lg bg-[#1f7a42] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
                {discount > 0 && (
                    <div className="flex justify-between text-[#2c7a3b]">
                        <span>Discount</span>
                        <span>-{formatPrice(discount)}</span>
                    </div>
                )}
                <div className="border-t border-[#dfeee5] pt-3">
                    <div className="flex justify-between text-base font-bold text-[#163b24]">
                        <span>Total</span>
                        <span>{formatPrice(total)}</span>
                    </div>
                </div>
            </div>

            {(step === 'cart' || step === 'shipping' || step === 'payment' || step === 'review') && (
                <button
                    type="button"
                    disabled={disabled || isSubmitting}
                    onClick={onPlaceOrder}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f7a42] px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(31,122,66,0.25)] transition hover:bg-[#163b24] disabled:opacity-50"
                >
                    {step === 'cart' ? 'Proceed to Shipping' : step === 'shipping' ? 'Continue' : step === 'payment' ? 'Continue' : 'Place Order'}
                    <ArrowRight size={16} />
                </button>
            )}
        </aside>
    );
}

export default function CustomerCheckout() {
    const { selectedItemIds: initialSelectedItemIds = [], deliveryZones, deliveryOptions } = usePage<CheckoutProps>().props;
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery<CartData>({
        queryKey: ['cart'],
        queryFn: async () => (await api.get('/customer/cart')).data,
    });
    const items = useMemo(() => data?.items ?? [], [data?.items]);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>(initialSelectedItemIds);
    const [selectionInitialized, setSelectionInitialized] = useState(false);
    const [step, setStep] = useState<CheckoutStep>('cart');
    const [desktopStep, setDesktopStep] = useState<'cart' | 'shipping' | 'payment' | 'gcash' | 'cod' | 'review'>('cart');
    const [address, setAddress] = useState<AddressForm>(emptyAddress);
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [editingNewAddress, setEditingNewAddress] = useState(false);
    const [cartItemBusy, setCartItemBusy] = useState<number | null>(null);
    const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>(() => {
        return (['local_delivery', 'seller_delivery', 'pickup'] as const).find((option) => deliveryOptions[option]) ?? 'local_delivery';
    });
    const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cod'>('gcash');
    const [voucherQuote, setVoucherQuote] = useState<CartData['voucher_quote']>(null);
    const [voucherCode, setVoucherCode] = useState('');
    const [voucherBusy, setVoucherBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [gcashNumber, setGcashNumber] = useState('');
    const [gcashName, setGcashName] = useState('');
    const [gcashReceipt, setGcashReceipt] = useState<File | null>(null);
    const [qrPreview, setQrPreview] = useState<{ shopName: string; url: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [addressReady, setAddressReady] = useState(false);
    const [placedOrder, setPlacedOrder] = useState<CheckoutOrder | null>(null);

    const selectedItems = useMemo(() => items.filter((item) => selectedItemIds.includes(item.id)), [items, selectedItemIds]);
    const gcashShops = useMemo(
        () =>
            Array.from(
                new Map(
                    selectedItems
                        .map((item) => item.product?.shop)
                        .filter((shop): shop is CartShop => Boolean(shop))
                        .map((shop) => [shop.id, shop]),
                ).values(),
            ),
        [selectedItems],
    );
    const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.price_snapshot) * item.quantity, 0);
    const addressBarangay = normalizeBarangay(address.barangay);
    const selectedZone = addressBarangay
        ? deliveryZones.find((zone) => normalizeBarangay(zone.barangay) === addressBarangay)
        : undefined;
    const qualifiesForFreeDelivery = Boolean(
        selectedZone?.is_free_delivery && (selectedZone.free_delivery_minimum === null || subtotal >= Number(selectedZone.free_delivery_minimum)),
    );
    const configuredDeliveryFee = deliveryOption === 'pickup' || qualifiesForFreeDelivery ? 0 : Number(selectedZone?.delivery_fee ?? 0);
    const shippingCost = voucherQuote?.free_shipping ? 0 : configuredDeliveryFee;
    const discount = Number(voucherQuote?.discount ?? 0);
    const total = Math.max(0, subtotal + shippingCost - discount);

    useEffect(() => {
        if (!data?.voucher?.id) {
            setVoucherQuote(null);
            return;
        }

        api.post('/customer/cart/voucher/quote', { selected_item_ids: selectedItemIds })
            .then((response) => setVoucherQuote(response.data.voucher))
            .catch((error) => {
                setVoucherQuote(null);
                setNotice(error?.response?.data?.message || 'The applied voucher is no longer valid for these items.');
            });
    }, [data?.voucher, selectedItemIds]);

    useEffect(() => {
        if (!data) return;

        setSelectedItemIds((current) =>
            selectionInitialized
                ? current.filter((id) => data.items.some((item) => item.id === id))
                : initialSelectedItemIds.length
                  ? initialSelectedItemIds.filter((id) => data.items.some((item) => item.id === id))
                  : data.items.map((item) => item.id),
        );
        if (!selectionInitialized) setSelectionInitialized(true);
    }, [data, initialSelectedItemIds, selectionInitialized]);

    useEffect(() => {
        if (addressReady || isLoading) return;

        currentUser()
            .then((user) => {
                const addresses = (user.addresses || []) as SavedAddress[];
                setSavedAddresses(addresses);
                const saved = addresses.find((item) => item.is_default) || addresses[0];
                setAddress({
                    ...emptyAddress,
                    ...saved,
                    barangay: saved?.barangay || '',
                    full_name: saved?.full_name || user.name || '',
                    phone: saved?.phone || user.phone || '',
                    city: 'Hinoba-an',
                    province: 'Negros Occidental',
                });
                setAddressReady(true);
            })
            .catch(() => setAddressReady(true));
    }, [addressReady, isLoading]);

    useEffect(() => {
        const shop = selectedItems.find((item) => item.product?.shop)?.product?.shop;
        setGcashNumber(shop?.gcash_mobile_number || '');
        setGcashName(shop?.gcash_account_name || '');
    }, [selectedItems]);

    async function submitOrder() {
        setBusy(true);
        setNotice('');

        try {
            const order = await checkoutCart({
                shipping_address: {
                    ...address,
                    line1: [address.house_number, address.line1].filter(Boolean).join(', '),
                    city: 'Hinoba-an',
                    province: 'Negros Occidental',
                },
                payment_method: paymentMethod === 'gcash' ? 'gcash' : 'cash_on_delivery',
                delivery_option: deliveryOption,
                selected_item_ids: selectedItemIds,
                gcash_receipt: paymentMethod === 'gcash' ? gcashReceipt : null,
            });
            setPlacedOrder(order);
            setStep('success');
        } catch (error: unknown) {
            setNotice(getApiErrorMessage(error, 'Checkout could not be completed.'));
            setBusy(false);
        }
    }

    async function submitDesktopOrder() {
        if (busy) return;
        setBusy(true);
        setNotice('');

        try {
            await checkoutCart({
                shipping_address: {
                    ...address,
                    line1: [address.house_number, address.line1].filter(Boolean).join(', '),
                    city: 'Hinoba-an',
                    province: 'Negros Occidental',
                },
                payment_method: paymentMethod === 'gcash' ? 'gcash' : 'cash_on_delivery',
                delivery_option: deliveryOption,
                selected_item_ids: selectedItemIds,
                gcash_receipt: paymentMethod === 'gcash' ? gcashReceipt : null,
            });
            router.visit('/customer/orders');
        } catch (error: unknown) {
            setNotice(getApiErrorMessage(error, 'Checkout could not be completed.'));
            setBusy(false);
        }
    }

    async function changeCheckoutQuantity(item: CartItem, quantity: number) {
        if (cartItemBusy || quantity < 1) return;
        setCartItemBusy(item.id);
        setNotice('');
        try {
            await updateCartItem(item.id, quantity);
            await queryClient.invalidateQueries({ queryKey: ['cart'] });
        } catch (error: unknown) {
            setNotice(getApiErrorMessage(error, 'Unable to update this cart item.'));
        } finally {
            setCartItemBusy(null);
        }
    }

    async function removeCheckoutItem(item: CartItem) {
        if (cartItemBusy) return;
        setCartItemBusy(item.id);
        setNotice('');
        try {
            await removeCartItem(item.id);
            setSelectedItemIds((current) => current.filter((id) => id !== item.id));
            await queryClient.invalidateQueries({ queryKey: ['cart'] });
        } catch (error: unknown) {
            setNotice(getApiErrorMessage(error, 'Unable to remove this cart item.'));
        } finally {
            setCartItemBusy(null);
        }
    }

    function continueDesktopFlow() {
        setNotice('');

        if (desktopStep === 'cart') {
            if (!selectedItems.length) {
                setNotice('Select at least one product to continue.');
                return;
            }
            setDesktopStep('shipping');
            return;
        }

        if (desktopStep === 'shipping') {
            if ([address.full_name, address.phone, address.line1].some((value) => !value.trim())) {
                setNotice('Enter your name, active mobile number, and street or sitio to continue.');
                return;
            }
            if (!deliveryOptions[deliveryOption]) {
                setNotice('Please choose an available delivery option.');
                return;
            }
            if (deliveryOption !== 'pickup' && !selectedZone) {
                setNotice(
                    deliveryZones.length === 0
                        ? 'Delivery is unavailable until an active delivery zone and delivery fee are configured. Choose pickup or contact support.'
                        : 'Select a valid barangay delivery zone for delivery, or choose pickup.',
                );
                return;
            }
            setDesktopStep('payment');
            return;
        }

        if (desktopStep === 'payment') {
            setDesktopStep(paymentMethod === 'gcash' ? 'gcash' : 'cod');
            return;
        }

        if (desktopStep === 'gcash') {
            if (
                !gcashShops.length ||
                gcashShops.some((shop) => !shop.gcash_enabled || !shop.gcash_account_name || !shop.gcash_mobile_number || !shop.gcash_qr_code_url) ||
                !gcashReceipt
            ) {
                setNotice('Complete payment using each seller’s configured GCash details and upload the payment receipt to continue.');
                return;
            }
            setDesktopStep('review');
            return;
        }

        if (desktopStep === 'cod') {
            setDesktopStep('review');
            return;
        }

        void submitDesktopOrder();
    }

    async function applyVoucher() {
        setVoucherBusy(true);
        setNotice('');
        try {
            await prepareSanctum();
            await api.post('/customer/cart/voucher', { code: voucherCode });
            setVoucherCode('');
            const response = await api.post('/customer/cart/voucher/quote', { selected_item_ids: selectedItemIds });
            setVoucherQuote(response.data.voucher);
        } catch (error: unknown) {
            setNotice(getApiErrorMessage(error, 'Unable to apply that voucher.'));
        } finally {
            setVoucherBusy(false);
        }
    }

    async function removeVoucher() {
        setVoucherBusy(true);
        try {
            await prepareSanctum();
            await api.delete('/customer/cart/voucher');
            setVoucherQuote(null);
        } catch {
            setNotice('Unable to remove the voucher.');
        } finally {
            setVoucherBusy(false);
        }
    }

    function goNext() {
        if (step === 'cart') {
            if (!selectedItems.length) {
                setNotice('Select at least one product to continue.');
                return;
            }
            setStep('shipping');
            return;
        }

        if (step === 'shipping') {
            const requiredAddressFields = [address.full_name, address.phone, address.line1];
            if (requiredAddressFields.some((value) => !value.trim())) {
                setNotice('Enter your name, active mobile number, and street or sitio to continue.');
                return;
            }
            if (!deliveryOptions[deliveryOption]) {
                setNotice('Please choose an available delivery option.');
                return;
            }
            if (deliveryOption !== 'pickup' && !selectedZone) {
                setNotice(
                    deliveryZones.length === 0
                        ? 'Delivery is unavailable until an active delivery zone and delivery fee are configured. Choose pickup or contact support.'
                        : 'Select a valid barangay delivery zone for delivery, or choose pickup.',
                );
                return;
            }
            setStep('payment');
            return;
        }

        if (step === 'payment') {
            if (paymentMethod === 'gcash' && (!gcashNumber.trim() || !gcashName.trim() || !gcashReceipt)) {
                setNotice('Enter your GCash details and upload your payment proof before continuing.');
                return;
            }
            setStep('review');
            return;
        }

        if (step === 'review') {
            void submitOrder();
        }
    }

    const desktopActiveIndex = desktopStep === 'cart' ? 0 : desktopStep === 'shipping' ? 1 : desktopStep === 'payment' || desktopStep === 'gcash' || desktopStep === 'cod' ? 2 : 3;
    const desktopStepTitle =
        desktopStep === 'cart'
            ? 'Your Cart'
            : desktopStep === 'shipping'
              ? 'Shipping Address'
              : desktopStep === 'payment'
                ? 'Payment Method'
                : desktopStep === 'gcash'
                  ? 'GCash Payment'
                  : desktopStep === 'cod'
                    ? 'Cash on Delivery'
                    : 'Review Order';

    const renderDesktopStep = () => {
        const cardClass = 'rounded-3xl border border-[#dcefe4] bg-white p-6 shadow-[0_10px_30px_rgba(22,59,36,0.05)]';
        const headingClass = 'text-lg font-bold text-[#163b24]';
        const labelClass = 'block text-sm font-semibold text-[#315843]';
        const inputClass = 'mt-1.5 w-full rounded-xl border border-[#dcefe4] bg-white px-3.5 py-3 text-sm text-[#163b24] outline-none transition focus:border-[#27874a] focus:ring-2 focus:ring-[#27874a]/15';

        if (desktopStep === 'cart') {
            return (
                <section className={cardClass}>
                    <div className="flex items-center justify-between gap-3 border-b border-[#e8f2eb] pb-4">
                        <div>
                            <h2 className={headingClass}>Your Items</h2>
                            <p className="mt-1 text-sm text-[#718377]">{selectedItems.length} selected item{selectedItems.length === 1 ? '' : 's'}</p>
                        </div>
                        <ShoppingBag size={22} className="text-[#25864a]" aria-hidden="true" />
                    </div>
                    <div className="mt-4 space-y-3">
                        {selectedItems.map((item) => {
                            const image = item.product?.images?.find((entry) => entry.is_primary) || item.product?.images?.[0];
                            const imageUrl = image
                                ? image.path.startsWith('http') || image.path.startsWith('/')
                                    ? image.path
                                    : `/storage/${image.path}`
                                : null;

                            return (
                                <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-[#e4f1e8] bg-[#fbfefc] p-4">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eaf7ee]">
                                        {imageUrl ? <img src={imageUrl} alt={item.product?.name || 'Product'} className="h-full w-full object-cover" /> : <ShoppingBag size={26} className="text-[#27874a]" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate font-bold text-[#183f2a]">{item.product?.name || 'Product'}</h3>
                                        <p className="mt-1 text-sm text-[#718377]">{item.product?.shop?.name || 'Marketplace item'}</p>
                                        {item.variant?.name && <p className="mt-1 text-xs text-[#718377]">Variant: {item.variant.name}</p>}
                                        <p className="mt-2 font-bold text-[#1f7a42]">{formatPrice(Number(item.price_snapshot))} <span className="font-normal text-[#718377]">each</span></p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <div className="flex items-center rounded-full border border-[#dcefe4] bg-white p-1">
                                            <button type="button" disabled={cartItemBusy === item.id || item.quantity <= 1} onClick={() => void changeCheckoutQuantity(item, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#1f7a42] hover:bg-[#edf8f0] disabled:opacity-40" aria-label={`Decrease ${item.product?.name || 'product'} quantity`}>
                                                <Minus size={14} />
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold text-[#163b24]">{item.quantity}</span>
                                            <button type="button" disabled={cartItemBusy === item.id} onClick={() => void changeCheckoutQuantity(item, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#1f7a42] hover:bg-[#edf8f0] disabled:opacity-40" aria-label={`Increase ${item.product?.name || 'product'} quantity`}>
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <button type="button" disabled={cartItemBusy === item.id} onClick={() => void removeCheckoutItem(item)} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#b44e46] transition hover:bg-[#fff0ed] disabled:opacity-40" aria-label={`Remove ${item.product?.name || 'product'} from cart`}>
                                            <Trash2 size={17} />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            );
        }

        if (desktopStep === 'shipping') {
            const addressFields: { key: keyof AddressForm; label: string; optional?: boolean }[] = [
                { key: 'full_name', label: 'Recipient name' },
                { key: 'phone', label: 'Phone number' },
                { key: 'house_number', label: 'House / building number', optional: true },
                { key: 'line1', label: 'Street / sitio' },
                { key: 'postal_code', label: 'Postal code', optional: true },
                { key: 'delivery_instructions', label: 'Delivery instructions', optional: true },
            ];

            return (
                <div className="space-y-5">
                    <section className={cardClass}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className={headingClass}>Delivery Address</h2>
                                <p className="mt-1 text-sm text-[#718377]">Select a saved address or enter a different address for this order.</p>
                            </div>
                            <MapPin size={22} className="text-[#25864a]" aria-hidden="true" />
                        </div>
                        {savedAddresses.length > 0 && (
                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                {savedAddresses.map((saved, index) => {
                                    const isSelected = !editingNewAddress && saved.full_name === address.full_name && saved.line1 === address.line1 && saved.phone === address.phone;
                                    return (
                                        <button
                                            key={saved.id ?? `${saved.full_name}-${index}`}
                                            type="button"
                                            onClick={() => {
                                                setAddress({ ...emptyAddress, ...saved, city: 'Hinoba-an', province: 'Negros Occidental' });
                                                setEditingNewAddress(false);
                                            }}
                                            className={`rounded-2xl border p-4 text-left transition ${isSelected ? 'border-[#27874a] bg-[#f0faf3] ring-2 ring-[#27874a]/10' : 'border-[#e0eee5] bg-white hover:border-[#9dceb0]'}`}
                                        >
                                            <span className="flex items-center justify-between gap-3">
                                                <span className="font-bold text-[#183f2a]">{saved.full_name || 'Saved address'}{saved.is_default && <span className="ml-2 rounded-full bg-[#e0f3e6] px-2 py-1 text-[10px] font-bold text-[#237943]">DEFAULT</span>}</span>
                                                {isSelected && <CheckCircle2 size={18} className="text-[#27874a]" aria-label="Selected address" />}
                                            </span>
                                            <span className="mt-2 block text-sm text-[#718377]">{saved.phone}</span>
                                            <span className="mt-1 block text-sm text-[#52675a]">{[saved.house_number, saved.line1, saved.barangay, 'Hinoba-an', 'Negros Occidental', saved.postal_code].filter(Boolean).join(', ')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setAddress({ ...emptyAddress, full_name: address.full_name, phone: address.phone });
                                setEditingNewAddress(true);
                            }}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-[#66ad7d] px-4 py-2.5 text-sm font-bold text-[#237943] transition hover:bg-[#f0faf3]"
                        >
                            <Plus size={16} /> Add New Address
                        </button>
                        {editingNewAddress && (
                            <div className="mt-4 rounded-2xl border border-[#e2efe6] bg-[#f8fcf9] p-4">
                                <p className="mb-3 text-sm font-semibold text-[#315843]">This address will be used for this order. Manage saved addresses from your profile.</p>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {addressFields.map(({ key, label, optional }) => (
                                        <label key={key} className={labelClass}>
                                            {label}{optional ? ' (optional)' : ''}
                                            <input
                                                value={address[key]}
                                                onChange={(event) => setAddress((current) => ({ ...current, [key]: event.target.value }))}
                                                className={inputClass}
                                                required={!optional}
                                                autoComplete={key === 'full_name' ? 'name' : key === 'phone' ? 'tel' : key === 'line1' ? 'address-line1' : 'off'}
                                            />
                                        </label>
                                    ))}
                                    <label className={`${labelClass} md:col-span-2`}>
                                        Barangay / neighborhood {deliveryOption === 'pickup' ? '(optional for pickup)' : ''}
                                        <input
                                            list="checkout-delivery-zones"
                                            value={address.barangay}
                                            onChange={(event) => setAddress((current) => ({ ...current, barangay: event.target.value }))}
                                            className={inputClass}
                                            placeholder="Enter your barangay or neighborhood"
                                            autoComplete="address-level3"
                                        />
                                        <datalist id="checkout-delivery-zones">
                                            {deliveryZones.map((zone) => <option key={zone.id} value={zone.barangay || zone.name} />)}
                                        </datalist>
                                        <span className="mt-1 block text-xs font-normal text-[#718377]">
                                            You can enter a location in Hinoba-an. Choose Pickup if it is not in a configured delivery zone.
                                        </span>
                                    </label>
                                    <p className="text-sm text-[#718377] md:col-span-2">Hinoba-an, Negros Occidental</p>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className={cardClass}>
                        <h2 className={headingClass}>Shipping Method</h2>
                        <p className="mt-1 text-sm text-[#718377]">Available methods and fees are based on your delivery area.</p>
                        <div className="mt-4 grid gap-3">
                            {([
                                ['local_delivery', 'Local Delivery', selectedZone?.estimated_delivery_text || 'Delivery timing depends on your selected zone.', selectedZone ? (shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)) : 'Zone required', Truck],
                                ['seller_delivery', 'Seller Delivery', selectedZone?.estimated_delivery_text || 'The seller coordinates delivery for your area.', selectedZone ? (shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)) : 'Zone required', PackageCheck],
                                ['pickup', 'Pickup', 'Collect your order from the seller when it is ready.', 'No delivery fee', ShoppingBag],
                            ] as const).filter(([key]) => deliveryOptions[key]).map(([key, title, description, fee, Icon]) => (
                                <button key={key} type="button" onClick={() => setDeliveryOption(key)} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${deliveryOption === key ? 'border-[#27874a] bg-[#f0faf3] ring-2 ring-[#27874a]/10' : 'border-[#e0eee5] bg-white hover:border-[#a6d0b4]'}`}>
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${deliveryOption === key ? 'bg-[#dff3e5] text-[#21824a]' : 'bg-[#f1f7f3] text-[#718377]'}`}><Icon size={19} /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-bold text-[#183f2a]">{title}</span>
                                        <span className="mt-1 block text-sm text-[#718377]">{description}</span>
                                    </span>
                                    <span className="text-right">
                                        <span className="block text-sm font-bold text-[#237943]">{key === 'pickup' ? fee : deliveryOption === key ? fee : selectedZone ? (qualifiesForFreeDelivery ? 'FREE' : formatPrice(Number(selectedZone.delivery_fee))) : fee}</span>
                                        {deliveryOption === key && <CheckCircle2 size={17} className="ml-auto mt-1 text-[#27874a]" />}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            );
        }

        if (desktopStep === 'payment') {
            return (
                <section className={cardClass}>
                    <h2 className={headingClass}>Choose Payment Method</h2>
                    <p className="mt-1 text-sm text-[#718377]">Select how you would like to pay for this order.</p>
                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                        {([
                            ['gcash', 'GCash', 'Pay securely through the seller’s configured GCash account.', WalletCards],
                            ['cod', 'Cash on Delivery', 'Pay in cash when your order is delivered.', PackageCheck],
                        ] as const).map(([method, title, description, Icon]) => (
                            <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`flex min-h-32 items-center gap-4 rounded-2xl border p-5 text-left transition ${paymentMethod === method ? 'border-[#27874a] bg-[#f0faf3] ring-2 ring-[#27874a]/10' : 'border-[#e0eee5] bg-white hover:border-[#a6d0b4]'}`}>
                                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${paymentMethod === method ? 'bg-[#dff3e5] text-[#21824a]' : 'bg-[#f1f7f3] text-[#718377]'}`}><Icon size={22} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-bold text-[#183f2a]">{title}</span>
                                    <span className="mt-1 block text-sm text-[#718377]">{description}</span>
                                </span>
                                {paymentMethod === method && <CheckCircle2 size={20} className="shrink-0 text-[#27874a]" aria-label="Selected payment method" />}
                            </button>
                        ))}
                    </div>
                    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dcefe4] bg-[#f4fbf6] p-4">
                        <ShieldCheck size={21} className="mt-0.5 shrink-0 text-[#21824a]" />
                        <div>
                            <p className="font-bold text-[#183f2a]">Your payment is secure</p>
                            <p className="mt-1 text-sm text-[#718377]">Payment details are handled through the selected seller’s configured payment method. Never share your PIN or one-time password.</p>
                        </div>
                    </div>
                </section>
            );
        }

        if (desktopStep === 'gcash') {
            return (
                <section className={cardClass}>
                    <div className="flex items-center gap-3 rounded-2xl border border-[#dcefe4] bg-[#f1faf4] p-4">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1875d1]"><CreditCard size={25} /></span>
                        <div>
                            <h2 className={headingClass}>Pay with GCash</h2>
                            <p className="mt-1 text-sm text-[#718377]">Send payment to the seller account below, then upload your receipt.</p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-3">
                        {gcashShops.map((shop) => (
                            <article key={shop.id} className="grid gap-4 rounded-2xl border border-[#e0eee5] bg-[#fbfefc] p-4 md:grid-cols-[1fr_auto] md:items-center">
                                <div>
                                    <p className="font-bold text-[#183f2a]">{shop.name}</p>
                                    {shop.gcash_enabled && shop.gcash_mobile_number && shop.gcash_account_name ? (
                                        <>
                                            <p className="mt-2 flex items-center gap-2 text-sm text-[#51695a]"><Phone size={15} className="text-[#27874a]" /> {shop.gcash_mobile_number}</p>
                                            <p className="mt-1 text-sm text-[#51695a]">Account name: <strong>{shop.gcash_account_name}</strong></p>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-sm font-semibold text-[#b3413a]">This seller has not completed GCash setup. Choose Cash on Delivery or contact the seller.</p>
                                    )}
                                </div>
                                {shop.gcash_enabled && shop.gcash_qr_code_url && (
                                    <button type="button" onClick={() => setQrPreview({ shopName: shop.name, url: shop.gcash_qr_code_url || '' })} className="flex items-center gap-3 rounded-xl border border-[#dcefe4] bg-white p-2 text-left hover:border-[#27874a]">
                                        <img src={shop.gcash_qr_code_url} alt={`Configured GCash QR code for ${shop.name}`} className="h-20 w-20 rounded-lg object-contain" />
                                        <span className="max-w-28 text-xs font-bold text-[#237943]">Scan seller QR code</span>
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                    <div className="mt-4 rounded-2xl bg-[#f2faf5] p-4">
                        <p className="font-bold text-[#183f2a]">Payment instructions</p>
                        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[#718377]">
                                <li>Pay the order amount of <strong className="text-[#183f2a]">{formatPrice(total)}</strong> to the seller account shown above.</li>
                            <li>Upload a clear receipt after completing the transfer.</li>
                            <li>Review your order and place it to submit the payment proof.</li>
                        </ol>
                    </div>
                    <label className={`${labelClass} mt-4`}>
                        Upload GCash payment receipt
                        <input type="file" accept="image/*" onChange={async (event) => {
                            const file = event.target.files?.[0];
                            setGcashReceipt(file ? await optimizeImage(file, { maxWidth: 1600, maxHeight: 1600 }) : null);
                        }} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1f7a42] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white`} />
                        <span className="mt-1 block text-xs font-normal text-[#718377]">A receipt is required before the order can be submitted.</span>
                    </label>
                </section>
            );
        }

        if (desktopStep === 'cod') {
            return (
                <section className={`${cardClass} overflow-hidden`}>
                    <div className="flex items-center gap-4 rounded-2xl bg-[#f0faf3] p-5">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#27874a]"><PackageCheck size={28} /></span>
                        <div>
                            <h2 className={headingClass}>Cash on Delivery</h2>
                            <p className="mt-1 text-sm text-[#718377]">Pay in cash when you receive your order.</p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {[
                            { Icon: WalletCards, title: 'No online payment', body: 'No payment is collected online during checkout.' },
                            { Icon: ShieldCheck, title: 'Safe and secure', body: 'Pay the delivery partner when your order arrives.' },
                            { Icon: MapPin, title: 'Supported delivery areas', body: deliveryOption === 'pickup' ? 'Pickup is selected for this order.' : 'Service is limited to active delivery zones.' },
                        ].map(({ Icon, title, body }) => <div key={title} className="rounded-2xl border border-[#e0eee5] bg-white p-4"><Icon size={20} className="text-[#27874a]" /><p className="mt-3 font-bold text-[#183f2a]">{title}</p><p className="mt-1 text-sm text-[#718377]">{body}</p></div>)}
                    </div>
                </section>
            );
        }

        return (
            <div className="space-y-4">
                <section className={cardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div><h2 className={headingClass}>Shipping Address</h2><p className="mt-1 text-sm text-[#718377]">The destination for this order.</p></div>
                        <button type="button" onClick={() => setDesktopStep('shipping')} className="rounded-lg px-3 py-2 text-sm font-bold text-[#237943] hover:bg-[#f0faf3]">Edit</button>
                    </div>
                    <div className="mt-3 rounded-2xl bg-[#f7fbf8] p-4 text-sm text-[#586d60]">
                        <p className="font-bold text-[#183f2a]">{address.full_name}</p>
                        <p className="mt-1">{address.phone}</p>
                        <p className="mt-2">{[address.house_number, address.line1, address.barangay, 'Hinoba-an', 'Negros Occidental', address.postal_code].filter(Boolean).join(', ')}</p>
                        {address.delivery_instructions && <p className="mt-1">Instructions: {address.delivery_instructions}</p>}
                    </div>
                </section>
                <section className={cardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div><h2 className={headingClass}>Shipping Method</h2><p className="mt-1 text-sm text-[#718377]">Delivery availability and fee for your area.</p></div>
                        <button type="button" onClick={() => setDesktopStep('shipping')} className="rounded-lg px-3 py-2 text-sm font-bold text-[#237943] hover:bg-[#f0faf3]">Edit</button>
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f7fbf8] p-4">
                        <Truck size={21} className="shrink-0 text-[#27874a]" />
                        <div className="min-w-0 flex-1"><p className="font-bold capitalize text-[#183f2a]">{deliveryOption.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-[#718377]">{selectedZone?.estimated_delivery_text || (deliveryOption === 'pickup' ? 'Collect from the seller.' : 'Delivery estimate to be confirmed.')}</p></div>
                        <p className="font-bold text-[#237943]">{shippingCost === 0 ? (deliveryOption === 'pickup' ? 'No fee' : 'FREE') : formatPrice(shippingCost)}</p>
                    </div>
                </section>
                <section className={cardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div><h2 className={headingClass}>Payment Method</h2><p className="mt-1 text-sm text-[#718377]">Selected payment for this order.</p></div>
                        <button type="button" onClick={() => setDesktopStep('payment')} className="rounded-lg px-3 py-2 text-sm font-bold text-[#237943] hover:bg-[#f0faf3]">Edit</button>
                    </div>
                    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f7fbf8] p-4">
                        {paymentMethod === 'gcash' ? <WalletCards size={21} className="text-[#27874a]" /> : <PackageCheck size={21} className="text-[#27874a]" />}
                        <div><p className="font-bold text-[#183f2a]">{paymentMethod === 'gcash' ? 'GCash' : 'Cash on Delivery'}</p><p className="mt-1 text-sm text-[#718377]">{paymentMethod === 'gcash' ? 'Seller payment receipt will be submitted with the order.' : 'Pay when you receive your order.'}</p></div>
                    </div>
                </section>
                <section className={cardClass}>
                    <h2 className={headingClass}>Items in this order</h2>
                    <div className="mt-3 divide-y divide-[#e8f2eb]">
                        {selectedItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="min-w-0 truncate text-[#52675a]">{item.product?.name || 'Product'} × {item.quantity}</span><span className="shrink-0 font-bold text-[#183f2a]">{formatPrice(Number(item.price_snapshot) * item.quantity)}</span></div>)}
                    </div>
                </section>
            </div>
        );
    };

    const renderCurrentStep = () => {
        if (step === 'success') {
            return (
                <div className="flex min-h-105 items-center justify-center">
                    <div className="w-full max-w-162.5 rounded-3xl border border-[#dfeee5] bg-white p-6 text-center shadow-[0_16px_42px_rgba(22,59,36,0.06)] sm:p-8">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#eaf8ee] text-[#1f7a42] shadow-inner shadow-[#1f7a42]/15">
                            <Check size={42} strokeWidth={3} />
                        </div>
                        <h2 className="font-display mt-6 text-3xl font-bold text-[#163b24]">Order Placed!</h2>
                        <p className="mt-2 text-sm text-[#647568]">Thank you for your purchase.</p>
                        <p className="mt-4 text-sm text-[#647568]">
                            Your order #{placedOrder?.order_number} has been received and is being processed.
                        </p>
                        <div className="mt-6 rounded-2xl border border-[#dfeee5] bg-[#f7faf7] p-4 text-left">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-[#163b24]">Delivery Method</span>
                                <span className="text-[#2c7a3b]">{paymentMethod === 'gcash' ? 'GCash' : 'Cash on Delivery'}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="font-semibold text-[#163b24]">Estimated Delivery</span>
                                <span className="text-[#647568]">{selectedZone?.estimated_delivery_text || 'To be confirmed'}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm">
                                <span className="font-semibold text-[#163b24]">Delivery option</span>
                                <span className="text-[#647568]">{deliveryOption.replaceAll('_', ' ')}</span>
                            </div>
                        </div>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href={placedOrder ? `/customer/order-tracking?order_id=${encodeURIComponent(placedOrder.id)}` : '/customer/orders'}
                                className="flex-1 rounded-2xl bg-[#1f7a42] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(31,122,66,0.18)] hover:bg-[#163b24]"
                            >
                                Track Order
                            </Link>
                            <Link
                                href="/customer/products"
                                className="flex-1 rounded-2xl border border-[#dfeee5] bg-white px-5 py-3 text-sm font-bold text-[#163b24] hover:bg-[#f7faf7]"
                            >
                                Continue Shopping
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        if (step === 'cart') {
            return (
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-2xl font-bold text-[#163b24]">
                            Your Items <span className="text-[#647568]">({selectedItems.length})</span>
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {selectedItems.map((item) => {
                            const image = item.product?.images?.find((img) => img.is_primary) || item.product?.images?.[0];
                            const imgSrc = image
                                ? image.path.startsWith('http') || image.path.startsWith('/')
                                    ? image.path
                                    : `/storage/${image.path}`
                                : null;

                            return (
                                <div
                                    key={item.id}
                                    className="flex flex-wrap items-center gap-3 rounded-3xl border border-[#dfeee5] bg-white p-3 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:flex-nowrap sm:p-4"
                                >
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eefaf1] sm:h-28 sm:w-28">
                                        {imgSrc ? (
                                            <img src={imgSrc} alt={item.product?.name || 'Product'} className="h-full w-full object-cover" />
                                        ) : (
                                            <ShoppingBag className="text-[#2c9350]" size={30} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-base font-bold text-[#163b24]">{item.product?.name || 'Product'}</p>
                                        <p className="mt-1 text-sm text-[#647568]">White / 9 (US)</p>
                                        <p className="mt-2 text-base font-bold text-[#163b24]">{formatPrice(Number(item.price_snapshot))}</p>
                                    </div>
                                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
                                        <div className="flex items-center gap-2 rounded-full border border-[#dfeee5] bg-[#f5fcf7] px-2 py-1.5">
                                            <button
                                                type="button"
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-[#1f7a42] hover:bg-white"
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus size={13} />
                                            </button>
                                            <span className="w-4 text-center text-sm font-bold text-[#163b24]">{item.quantity}</span>
                                            <button
                                                type="button"
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-[#1f7a42] hover:bg-white"
                                                aria-label="Increase quantity"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label="Remove item"
                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4faf5] text-[#163b24] hover:bg-[#eaf8ee]"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (step === 'shipping') {
            const inputClass =
                'mt-1 w-full rounded-xl border border-[#dfeee5] bg-white px-3 py-2.5 text-sm text-[#163b24] outline-none focus:border-[#2c9350]';
            return (
                <div className="space-y-5">
                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <h3 className="font-display text-xl font-bold text-[#163b24]">Local delivery address</h3>
                        <p className="mt-1 text-sm text-[#647568]">Deliveries are currently available only in Hinoba-an, Negros Occidental.</p>
                        <p className="mt-2 rounded-xl bg-[#f7faf7] px-3 py-2 text-xs text-[#647568]">
                            Your saved address is read-only during checkout. Update delivery details in your profile before placing an order.
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="text-sm font-semibold text-[#163b24]">
                                Full name
                                <input
                                    autoComplete="name"
                                    value={address.full_name}
                                    readOnly
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                    required
                                />
                            </label>
                            <label className="text-sm font-semibold text-[#163b24]">
                                Active mobile number
                                <input
                                    autoComplete="tel"
                                    type="tel"
                                    value={address.phone}
                                    readOnly
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                    required
                                />
                            </label>
                            <label className="text-sm font-semibold text-[#163b24]">
                                Barangay / delivery zone (optional for pickup)
                                <select
                                    value={address.barangay}
                                    disabled
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                >
                                    <option value="">{address.barangay || 'No saved delivery zone'}</option>
                                    {deliveryZones.map((zone) => (
                                        <option key={zone.id} value={zone.barangay}>
                                            {zone.barangay} — {zone.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm font-semibold text-[#163b24]">
                                Street / Sitio
                                <input
                                    autoComplete="address-line1"
                                    value={address.line1}
                                    readOnly
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                    required
                                />
                            </label>
                            <label className="text-sm font-semibold text-[#163b24]">
                                Postal code (optional)
                                <input
                                    autoComplete="postal-code"
                                    value={address.postal_code}
                                    readOnly
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                />
                            </label>
                            <label className="text-sm font-semibold text-[#163b24] sm:col-span-2">
                                Additional delivery instructions (optional)
                                <textarea
                                    rows={2}
                                    value={address.delivery_instructions}
                                    readOnly
                                    className={`${inputClass} cursor-not-allowed bg-[#f8fcf8]`}
                                />
                            </label>
                            <div className="rounded-xl bg-[#f7faf7] px-3 py-2 text-sm text-[#526157] sm:col-span-2">Hinoba-an, Negros Occidental</div>
                        </div>
                        {!selectedZone && deliveryOption !== 'pickup' && (
                            <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                                {deliveryZones.length === 0
                                    ? 'Delivery requires a configured active zone. You can choose pickup without a barangay.'
                                    : 'A valid barangay delivery zone is needed for delivery. You can choose pickup without a barangay.'}
                            </p>
                        )}
                        {deliveryOption === 'pickup' && !address.barangay && (
                            <p className="mt-3 rounded-lg bg-[#f0faf3] p-3 text-sm text-[#39734d]">
                                Barangay is optional for pickup. No delivery fee will be charged.
                            </p>
                        )}
                        {selectedZone && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dcebe0] bg-[#f7fbf7] p-3 text-sm">
                                <span className="font-semibold text-[#173b27]">
                                    {selectedZone.name} · {selectedZone.estimated_delivery_text}
                                </span>
                                <span className="font-bold text-[#1f7a42]">
                                    {deliveryOption === 'pickup' ? 'PICKUP · NO DELIVERY FEE' : shippingCost === 0 ? 'FREE DELIVERY' : formatPrice(shippingCost)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <h3 className="font-display text-xl font-bold text-[#163b24]">Delivery option</h3>
                        <div className="mt-4 grid gap-3">
                            {(
                                [
                                    ['local_delivery', 'Local Delivery', 'Seller or BSAB-Shop delivery personnel brings your order.'],
                                    ['seller_delivery', 'Seller Delivery', 'The seller personally handles delivery.'],
                                    ['pickup', 'Pickup', 'Collect from the seller when pickup is available.'],
                                ] as [DeliveryOption, string, string][]
                            )
                                .filter(([key]) => deliveryOptions[key])
                                .map(([key, title, description]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setDeliveryOption(key)}
                                        className={`rounded-xl border p-4 text-left ${deliveryOption === key ? 'border-[#1f7a42] bg-[#ebf9ee]' : 'border-[#dfeee5] bg-[#f7faf7]'}`}
                                    >
                                        <span className="block font-bold text-[#163b24]">{title}</span>
                                        <span className="mt-1 block text-sm text-[#647568]">{description}</span>
                                    </button>
                                ))}
                            {Object.values(deliveryOptions).every((enabled) => !enabled) && (
                                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                                    Delivery options are temporarily unavailable. Please contact support.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (step === 'payment') {
            return (
                <div className="space-y-5">
                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <h3 className="font-display text-xl font-bold text-[#163b24]">Choose Payment Method</h3>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('gcash')}
                                className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${paymentMethod === 'gcash' ? 'border-[#1f7a42] bg-[#ebf9ee]' : 'border-[#dfeee5] bg-[#f7faf7]'}`}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dff4e7] text-[#1f7a42]">
                                    <WalletCards size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-[#163b24]">GCash</p>
                                    <p className="text-sm text-[#647568]">Pay securely via GCash</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setPaymentMethod('cod')}
                                className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${paymentMethod === 'cod' ? 'border-[#1f7a42] bg-[#ebf9ee]' : 'border-[#dfeee5] bg-[#f7faf7]'}`}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dff4e7] text-[#1f7a42]">
                                    <PackageCheck size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-[#163b24]">Cash on Delivery</p>
                                    <p className="text-sm text-[#647568]">Pay when you receive your order</p>
                                </div>
                            </button>
                        </div>

                        {paymentMethod === 'gcash' ? (
                            <div className="mt-5 rounded-3xl border border-[#dfeee5] bg-[#f7faf7] p-4">
                                <div className="mb-4 flex items-center gap-2 text-[#1f7a42]">
                                    <WalletCards size={18} />
                                    <div>
                                        <p className="font-bold text-[#163b24]">Pay with GCash</p>
                                        <p className="text-xs font-normal text-[#647568]">
                                            Scan the seller QR code, send the exact total, then upload your proof.
                                        </p>
                                    </div>
                                </div>
                                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                    {Array.from(
                                        new Map(
                                            selectedItems
                                                .map((item) => item.product?.shop)
                                                .filter((shop) => shop?.gcash_qr_code_url)
                                                .map((shop) => [shop?.id, shop]),
                                        ).values(),
                                    ).map(
                                        (shop) =>
                                            shop?.gcash_qr_code_url && (
                                                <button
                                                    type="button"
                                                    key={shop.id}
                                                    onClick={() => setQrPreview({ shopName: shop.name, url: shop.gcash_qr_code_url || '' })}
                                                    className="flex items-center gap-3 rounded-2xl border border-[#cde8d2] bg-white p-3 text-left hover:border-[#1f7a42]"
                                                >
                                                    <img
                                                        src={shop.gcash_qr_code_url}
                                                        alt={`GCash QR code for ${shop.name}`}
                                                        className="h-24 w-24 rounded-xl object-contain"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-xs font-bold tracking-wide text-[#2c7a3b] uppercase">
                                                            Scan to pay
                                                        </span>
                                                        <span className="mt-1 block truncate text-sm font-bold text-[#163b24]">{shop.name}</span>
                                                        <span className="mt-1 block text-xs text-[#647568]">Tap to enlarge QR</span>
                                                    </span>
                                                </button>
                                            ),
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-[#163b24]">
                                        GCash Number
                                        <input
                                            value={gcashNumber}
                                            readOnly
                                            className="mt-1 w-full rounded-xl border border-[#dfeee5] bg-[#f5faf6] px-3 py-2.5 text-sm text-[#163b24] outline-none"
                                        />
                                    </label>
                                    <label className="block text-sm font-semibold text-[#163b24]">
                                        Name on GCash Account
                                        <input
                                            value={gcashName}
                                            readOnly
                                            className="mt-1 w-full rounded-xl border border-[#dfeee5] bg-[#f5faf6] px-3 py-2.5 text-sm text-[#163b24] outline-none"
                                        />
                                    </label>
                                    <label className="block text-sm font-semibold text-[#163b24]">
                                        Payment proof
                                        <input
                                            type="file"
                                            accept="image/*"
                                            required
                                            onChange={async (event) => {
                                                const file = event.target.files?.[0];
                                                setGcashReceipt(file ? await optimizeImage(file, { maxWidth: 1600, maxHeight: 1600 }) : null);
                                            }}
                                            className="mt-1 block w-full rounded-xl border border-dashed border-[#b8d9c0] bg-white px-3 py-2.5 text-sm text-[#647568] file:mr-3 file:rounded-lg file:border-0 file:bg-[#1f7a42] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                                        />
                                        <span className="mt-1 block text-xs font-normal text-[#647568]">
                                            Upload a clear screenshot or photo of your completed GCash transfer.
                                        </span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-3xl border border-[#dfeee5] bg-[#f7faf7] p-4">
                                <div className="flex items-center gap-3 text-[#163b24]">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dff4e7] text-[#1f7a42]">
                                        <PackageCheck size={22} />
                                    </div>
                                    <div>
                                        <p className="font-display text-xl font-bold">Cash on Delivery</p>
                                        <p className="text-sm text-[#647568]">Pay in cash when your order arrives at your doorstep.</p>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-3 text-sm text-[#647568]">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-[#2c7a3b]" /> No online payment needed
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-[#2c7a3b]" /> Safe & secure
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={16} className="text-[#2c7a3b]" /> Local delivery within Hinoba-an
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (step === 'review') {
            return (
                <div className="space-y-5">
                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="font-display text-xl font-bold text-[#163b24]">Shipping Address</h3>
                            <button type="button" onClick={() => setStep('shipping')} className="text-sm font-semibold text-[#1f7a42]">
                                Edit
                            </button>
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#dfeee5] bg-[#f7faf7] p-4 text-sm text-[#647568]">
                            <p className="font-bold text-[#163b24]">{address.full_name || 'Juan Dela Cruz'}</p>
                            <p className="mt-1">{address.phone}</p>
                            <p className="mt-2">
                                {address.house_number} {address.line1}, {address.barangay}
                            </p>
                            <p>Hinoba-an, Negros Occidental {address.postal_code}</p>
                            {address.delivery_instructions && <p className="mt-2">Instructions: {address.delivery_instructions}</p>}
                        </div>
                    </div>

                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="font-display text-xl font-bold text-[#163b24]">Delivery details</h3>
                            <button type="button" onClick={() => setStep('shipping')} className="text-sm font-semibold text-[#1f7a42]">
                                Edit
                            </button>
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#dfeee5] bg-[#f7faf7] p-4 text-sm text-[#647568]">
                            <p className="font-bold text-[#163b24]">{selectedZone?.name ?? 'Select a delivery zone'}</p>
                            <p className="mt-1">{selectedZone?.estimated_delivery_text}</p>
                            <p className="mt-1 capitalize">{deliveryOption.replaceAll('_', ' ')}</p>
                            <p className="mt-1 font-semibold text-[#2c7a3b]">{shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}</p>
                        </div>
                    </div>

                    <div className="rounded-[26px] border border-[#dfeee5] bg-white p-4 shadow-[0_10px_30px_rgba(22,59,36,0.04)] sm:p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="font-display text-xl font-bold text-[#163b24]">Payment Method</h3>
                            <button type="button" onClick={() => setStep('payment')} className="text-sm font-semibold text-[#1f7a42]">
                                Edit
                            </button>
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#dfeee5] bg-[#f7faf7] p-4 text-sm text-[#647568]">
                            <p className="font-bold text-[#163b24]">{paymentMethod === 'gcash' ? 'GCash' : 'Cash on Delivery'}</p>
                            <p className="mt-1">{paymentMethod === 'gcash' ? 'Pay via GCash' : 'Pay when you receive your order'}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    if (isLoading) {
        return (
            <>
                <Head title="Checkout" />
                <PortalLayout role="customer" title="Checkout" eyebrow="Loading order..." hideHeader>
                    <div className="rounded-3xl border border-[#def0e2] bg-white p-8 text-center text-[#647568]">Loading checkout...</div>
                </PortalLayout>
            </>
        );
    }

    if (!items.length) {
        return (
            <>
                <Head title="Checkout" />
                <PortalLayout role="customer" title="Checkout" eyebrow="Your cart" hideHeader>
                    <div className="rounded-[30px] border border-[#dfeee5] bg-white p-10 text-center shadow-[0_16px_42px_rgba(22,59,36,0.06)]">
                        <ShoppingBag className="mx-auto text-[#2c9350]" size={42} />
                        <h2 className="font-display mt-4 text-2xl font-bold text-[#163b24]">Your cart is empty</h2>
                        <Link
                            href={route('marketplace')}
                            className="mt-5 inline-flex rounded-full bg-[#1f7a42] px-5 py-3 text-sm font-bold text-white"
                        >
                            Continue shopping
                        </Link>
                    </div>
                </PortalLayout>
            </>
        );
    }

    if (!selectedItems.length) {
        return (
            <>
                <Head title="Checkout" />
                <PortalLayout role="customer" title="Checkout" eyebrow="Select items" hideHeader>
                    <div className="rounded-[30px] border border-[#dfeee5] bg-white p-10 text-center shadow-[0_16px_42px_rgba(22,59,36,0.06)]">
                        <ShoppingBag className="mx-auto text-[#2c9350]" size={42} />
                        <h2 className="font-display mt-4 text-2xl font-bold text-[#163b24]">Select products from your cart</h2>
                        <Link
                            href={route('customer.cart')}
                            className="mt-5 inline-flex rounded-full bg-[#1f7a42] px-5 py-3 text-sm font-bold text-white"
                        >
                            Back to cart
                        </Link>
                    </div>
                </PortalLayout>
            </>
        );
    }

    return (
        <>
            <Head title="Checkout" />
            <PortalLayout role="customer" title="Checkout" eyebrow="Complete your order" hideHeader>
                <style>{`
                    .checkout-desktop-flow{display:none}
                    @media (min-width:768px){
                        .checkout-mobile-flow{display:none!important}
                        .checkout-desktop-flow{display:block;width:min(100%,1380px);margin:0 auto;padding:14px 20px 40px;color:#163b24}
                        .checkout-desktop-head{display:flex;align-items:center;gap:16px;padding:0 0 18px}
                        .checkout-desktop-back{display:flex;width:44px;height:44px;align-items:center;justify-content:center;border:1px solid #dcefe4;border-radius:14px;background:#fff;color:#207843;box-shadow:0 5px 16px #173f350b}
                        .checkout-desktop-eyebrow{margin:0;color:#25864a;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
                        .checkout-desktop-title{margin:3px 0 0;color:#163b24;font-size:28px;line-height:1.2;font-weight:850}
                        .checkout-desktop-progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin:0 0 20px;padding:17px 22px;border:1px solid #deeee4;border-radius:20px;background:#fff;box-shadow:0 8px 24px #173f3508}
                        .checkout-desktop-progress-step{display:flex;align-items:center;gap:10px;min-width:0;color:#7d8e82;font-size:13px;font-weight:700}
                        .checkout-desktop-progress-step:not(:last-child):after{height:1px;flex:1;margin:0 14px;background:#dcefe4;content:""}
                        .checkout-desktop-progress-step.is-complete{color:#21804a}
                        .checkout-desktop-progress-step.is-active{color:#163b24}
                        .checkout-desktop-progress-dot{display:flex;width:29px;height:29px;flex:none;align-items:center;justify-content:center;border:1px solid #dcefe4;border-radius:50%;background:#f5faf6;color:#708278;font-size:12px}
                        .checkout-desktop-progress-step.is-complete .checkout-desktop-progress-dot{border-color:#21804a;background:#21804a;color:white}
                        .checkout-desktop-progress-step.is-active .checkout-desktop-progress-dot{border-color:#21804a;background:#e8f7ed;color:#21804a}
                        .checkout-desktop-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;align-items:start}
                        .checkout-desktop-main{min-width:0}
                        .checkout-desktop-actions{display:flex;justify-content:space-between;gap:12px;margin-top:18px}
                        .checkout-desktop-action{display:inline-flex;min-height:48px;align-items:center;justify-content:center;gap:9px;border:1px solid #27874a;border-radius:14px;background:white;padding:0 22px;color:#237943;font-size:14px;font-weight:800;transition:background .15s,color .15s,opacity .15s}
                        .checkout-desktop-action:hover{background:#f0faf3}
                        .checkout-desktop-action-primary{margin-left:auto;background:#168348;color:#fff;box-shadow:0 8px 18px #16834826}
                        .checkout-desktop-action-primary:hover{background:#126f3d;color:#fff}
                        .checkout-desktop-action:disabled{cursor:not-allowed;opacity:.55}
                        .checkout-desktop-summary{position:sticky;top:20px;border:1px solid #dcefe4;border-radius:24px;background:#f0faf3;padding:20px;box-shadow:0 10px 28px #173f350b}
                        .checkout-desktop-summary-row{display:flex;justify-content:space-between;gap:12px;color:#63776a;font-size:14px}
                        .checkout-desktop-summary-total{border-top:1px solid #d8eade;padding-top:13px;color:#163b24;font-size:16px;font-weight:850}
                        .checkout-desktop-summary-voucher{margin-top:18px;border:1px solid #dcefe4;border-radius:14px;background:#fff;padding:13px}
                    }
                    @media (min-width:768px) and (max-width:1099px){
                        .checkout-desktop-flow{padding-right:12px;padding-left:12px}
                        .checkout-desktop-progress{padding-right:15px;padding-left:15px}
                        .checkout-desktop-progress-step:not(:last-child):after{margin:0 8px}
                    }
                    @media (min-width:1100px){
                        .checkout-desktop-grid{grid-template-columns:minmax(0,1.6fr) minmax(300px,.72fr);gap:24px}
                    }
                `}</style>
                <div className="checkout-mobile-flow">
                <div className="mx-auto w-full min-w-0 max-w-300 px-3 pt-1 pb-6 sm:px-5 lg:px-6 lg:pb-10">
                    <div className="min-w-0 rounded-[30px] border border-[#dfeee5] bg-[#f3faf5] p-3 shadow-[0_15px_42px_rgba(22,59,36,0.04)] sm:p-4 lg:p-5">
                        <div className="flex items-center gap-3 px-1 pb-2">
                            <Link
                                href={route('customer.cart')}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfeee5] bg-white text-[#163b24]"
                            >
                                <ArrowLeft size={18} />
                            </Link>
                            <div>
                                <p className="text-[10px] font-bold tracking-[0.18em] text-[#2c7a3b] uppercase">Checkout</p>
                                <h1 className="font-display text-2xl font-bold text-[#163b24]">Checkout</h1>
                            </div>
                        </div>

                        <ProgressStepper step={step} />

                        {notice && <div className="mt-4 rounded-2xl bg-[#fbeaea] px-4 py-3 text-sm font-semibold text-[#b3413a]">{notice}</div>}

                        <div className="mt-5 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)]">
                            <div className="min-w-0 rounded-[28px] border border-[#dfeee5] bg-[#f9fefb] p-3 sm:p-4 lg:p-5">{renderCurrentStep()}</div>

                            <div className="block min-w-0">
                                <OrderSummary
                                    items={selectedItems}
                                    subtotal={subtotal}
                                    shippingLabel={!selectedZone ? 'Select delivery area' : shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                                    discount={discount}
                                    total={total}
                                    step={step}
                                    onPlaceOrder={goNext}
                                    disabled={busy || !selectedItems.length}
                                    isSubmitting={busy}
                                    voucher={voucherQuote}
                                    voucherCode={voucherCode}
                                    voucherBusy={voucherBusy}
                                    onVoucherCodeChange={setVoucherCode}
                                    onApplyVoucher={applyVoucher}
                                    onRemoveVoucher={removeVoucher}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                </div>
                <section className="checkout-desktop-flow" aria-label="Desktop checkout">
                    <header className="checkout-desktop-head">
                        <button
                            type="button"
                            onClick={() => desktopStep === 'cart' ? router.visit(route('customer.cart')) : setDesktopStep(desktopStep === 'gcash' || desktopStep === 'cod' ? 'payment' : desktopStep === 'review' ? (paymentMethod === 'gcash' ? 'gcash' : 'cod') : desktopStep === 'payment' ? 'shipping' : 'cart')}
                            aria-label={desktopStep === 'cart' ? 'Back to cart' : 'Go to previous checkout step'}
                            className="checkout-desktop-back"
                        >
                            <ArrowLeft size={19} />
                        </button>
                        <div>
                            <p className="checkout-desktop-eyebrow">Secure Checkout</p>
                            <h1 className="checkout-desktop-title">{desktopStepTitle}</h1>
                        </div>
                    </header>
                    <nav className="checkout-desktop-progress" aria-label="Checkout progress">
                        {['Cart', 'Shipping', 'Payment', 'Review'].map((label, index) => {
                            const done = index < desktopActiveIndex;
                            const active = index === desktopActiveIndex;
                            const target = (['cart', 'shipping', 'payment', 'review'] as const)[index];
                            return (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                        if (done) {
                                            setNotice('');
                                            setDesktopStep(target);
                                        }
                                    }}
                                    disabled={!done}
                                    aria-current={active ? 'step' : undefined}
                                    className={`checkout-desktop-progress-step${done ? ' is-complete' : ''}${active ? ' is-active' : ''}`}
                                >
                                    <span className="checkout-desktop-progress-dot">{done ? <Check size={15} /> : index + 1}</span>
                                    {label}
                                </button>
                            );
                        })}
                    </nav>
                    {notice && <div role="alert" className="mb-4 rounded-xl border border-[#f0c9c5] bg-[#fff3f1] px-4 py-3 text-sm font-semibold text-[#a63d36]">{notice}</div>}
                    <div className="checkout-desktop-grid">
                        <div className="checkout-desktop-main">
                            {renderDesktopStep()}
                            <div className="checkout-desktop-actions">
                                {desktopStep !== 'cart' && (
                                    <button type="button" onClick={() => setDesktopStep(desktopStep === 'gcash' || desktopStep === 'cod' ? 'payment' : desktopStep === 'review' ? (paymentMethod === 'gcash' ? 'gcash' : 'cod') : desktopStep === 'payment' ? 'shipping' : 'cart')} className="checkout-desktop-action">
                                        <ArrowLeft size={16} /> Back
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={busy || (desktopStep === 'cart' && !selectedItems.length)}
                                    onClick={continueDesktopFlow}
                                    className="checkout-desktop-action checkout-desktop-action-primary"
                                >
                                    {busy ? 'Submitting order…' : desktopStep === 'cart' ? 'Proceed to Shipping' : desktopStep === 'shipping' ? 'Continue to Payment' : desktopStep === 'payment' ? 'Continue' : desktopStep === 'review' ? 'Place Order' : 'Continue to Review'}
                                    {!busy && (desktopStep === 'review' ? <BadgeCheck size={17} /> : <ArrowRight size={17} />)}
                                </button>
                            </div>
                        </div>
                        <aside className="checkout-desktop-summary" aria-label="Order summary">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-extrabold text-[#163b24]">Order Summary</h2>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#237943]">{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="mt-4 max-h-60 space-y-3 overflow-y-auto">
                                {selectedItems.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[#27874a]">
                                            {item.product?.images?.[0]?.path ? <img src={item.product.images[0].path.startsWith('/') || item.product.images[0].path.startsWith('http') ? item.product.images[0].path : `/storage/${item.product.images[0].path}`} alt={item.product?.name || 'Product'} className="h-full w-full object-cover" /> : <ShoppingBag size={19} />}
                                        </span>
                                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#183f2a]">{item.product?.name || 'Product'}</span><span className="mt-0.5 block text-xs text-[#718377]">Qty {item.quantity}</span></span>
                                        <span className="text-sm font-bold text-[#183f2a]">{formatPrice(Number(item.price_snapshot) * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 space-y-3 border-t border-[#dcefe4] pt-4">
                                <div className="checkout-desktop-summary-row"><span>Subtotal</span><strong className="text-[#183f2a]">{formatPrice(subtotal)}</strong></div>
                                <div className="checkout-desktop-summary-row"><span>Shipping</span><strong className="text-[#183f2a]">{deliveryOption === 'pickup' ? 'No fee' : !selectedZone ? 'Calculated after address' : shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}</strong></div>
                                {discount > 0 && <div className="checkout-desktop-summary-row text-[#237943]"><span>Voucher discount</span><strong>-{formatPrice(discount)}</strong></div>}
                                <div className="checkout-desktop-summary-row checkout-desktop-summary-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
                            </div>
                            <div className="checkout-desktop-summary-voucher">
                                <p className="mb-2 text-xs font-bold text-[#315843]">Voucher</p>
                                {voucherQuote ? (
                                    <div className="flex items-center justify-between gap-2 text-xs text-[#237943]">
                                        <span className="truncate"><strong>{voucherQuote.code}</strong> applied</span>
                                        <button type="button" disabled={voucherBusy} onClick={() => void removeVoucher()} className="font-bold underline disabled:opacity-50">Remove</button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input aria-label="Voucher code" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase())} placeholder="Enter code" className="min-w-0 flex-1 rounded-lg border border-[#dcefe4] px-2.5 py-2 text-xs uppercase outline-none focus:border-[#27874a]" />
                                        <button type="button" disabled={voucherBusy || !voucherCode.trim()} onClick={() => void applyVoucher()} className="rounded-lg bg-[#168348] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{voucherBusy ? '…' : 'Apply'}</button>
                                    </div>
                                )}
                            </div>
                            <p className="mt-4 flex items-center gap-2 text-xs text-[#718377]"><ShieldCheck size={15} className="text-[#27874a]" /> Your order details are protected.</p>
                        </aside>
                    </div>
                </section>
                {qrPreview && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-[#163b24]/70 p-5"
                        role="dialog"
                        aria-modal="true"
                        aria-label="GCash QR code"
                    >
                        <div className="relative w-full max-w-sm rounded-[28px] bg-white p-5 text-center shadow-2xl">
                            <button
                                type="button"
                                onClick={() => setQrPreview(null)}
                                aria-label="Close QR code"
                                className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2fbf4] text-[#163b24]"
                            >
                                <X size={17} />
                            </button>
                            <p className="text-xs font-bold tracking-[0.16em] text-[#2c7a3b] uppercase">Scan to pay via GCash</p>
                            <h3 className="font-display mt-1 text-xl font-bold text-[#163b24]">{qrPreview.shopName}</h3>
                            <img
                                src={qrPreview.url}
                                alt={`Large GCash QR code for ${qrPreview.shopName}`}
                                className="mx-auto mt-5 aspect-square w-full max-w-72.5 rounded-2xl border border-[#dfeee5] object-contain p-3"
                            />
                            <button
                                type="button"
                                onClick={() => setQrPreview(null)}
                                className="mt-5 w-full rounded-2xl bg-[#1f7a42] py-3 text-sm font-bold text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </PortalLayout>
        </>
    );
}
