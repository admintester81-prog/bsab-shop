import { PortalLayout } from '@/components/portal-layout';
import { Head } from '@inertiajs/react';
import { ArrowRightLeft, Banknote, CheckCircle2, CreditCard, Wallet } from 'lucide-react';

type SellerPaymentsProps = {
    stats?: Array<{ label: string; value: number | string; detail: string; tone: 'green' | 'mint' | 'dark' | 'light' }>;
    payouts?: Array<{ id: string; amount: number; method: string; status: string; date: string }>;
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value);

const defaultPayouts = [
    { id: 'PYO-2091', amount: '₱16,500', method: 'GCash', status: 'Completed', date: '2026-09-28' },
    { id: 'PYO-2084', amount: '₱12,200', method: 'Bank Transfer', status: 'Pending', date: '2026-09-22' },
    { id: 'PYO-2078', amount: '₱8,430', method: 'GCash', status: 'Completed', date: '2026-09-15' },
];

export default function SellerPayments({ stats = defaultStats, payouts = defaultPayouts }: SellerPaymentsProps) {
    return (
        <>
            <Head title="Seller payments" />
            <PortalLayout role="seller" title="Payments" eyebrow="Wallet & payouts">
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        {stats.map((stat) => (
                            <StatCard
                                key={stat.label}
                                icon={
                                    stat.label === 'Available Balance'
                                        ? Wallet
                                        : stat.label === 'Total Earnings'
                                          ? Banknote
                                          : stat.label === 'Pending Earnings'
                                            ? ArrowRightLeft
                                            : CreditCard
                                }
                                label={stat.label}
                                value={typeof stat.value === 'number' ? formatCurrency(stat.value) : stat.value}
                                detail={stat.detail}
                                tone={stat.tone}
                            />
                        ))}
                    </div>

                    <section className="rounded-3xl border border-[#def0e2] bg-white p-5 shadow-[0_6px_20px_rgba(22,59,36,0.04)]">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold tracking-[0.16em] text-[#2f9d5b] uppercase">Payment history</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#163b24]">Payout history</h2>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-[#edf3ee]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#f3faf4] text-[#51675d]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Transaction ID</th>
                                        <th className="px-4 py-3 font-semibold">Amount</th>
                                        <th className="px-4 py-3 font-semibold">Method</th>
                                        <th className="px-4 py-3 font-semibold">Status</th>
                                        <th className="px-4 py-3 font-semibold">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((payout) => (
                                        <tr key={payout.id} className="border-t border-[#edf3ee]">
                                            <td className="px-4 py-3 font-medium text-[#163b24]">{payout.id}</td>
                                            <td className="px-4 py-3 text-[#203a2b]">
                                                {typeof payout.amount === 'number' ? formatCurrency(payout.amount) : payout.amount}
                                            </td>
                                            <td className="px-4 py-3 text-[#203a2b]">{payout.method}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${payout.status === 'Completed' ? 'bg-[#e8f8ed] text-[#1f7a42]' : 'bg-[#fff2d8] text-[#9b6a0d]'}`}
                                                >
                                                    {payout.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[#203a2b]">{payout.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </PortalLayout>
        </>
    );
}

const defaultStats = [
    { label: 'Available Balance', value: 84500, detail: 'Ready to withdraw', tone: 'green' },
    { label: 'Total Earnings', value: 248300, detail: 'This year', tone: 'mint' },
    { label: 'Pending Earnings', value: 18600, detail: 'Awaiting settlement', tone: 'dark' },
    { label: 'Withdrawable', value: 42800, detail: '72 hours', tone: 'light' },
];

function StatCard({
    icon: Icon,
    label,
    value,
    detail,
    tone,
}: {
    icon: typeof Wallet;
    label: string;
    value: string;
    detail: string;
    tone: 'green' | 'mint' | 'dark' | 'light';
}) {
    const palette = {
        green: 'bg-[#ecf9f0] text-[#1f7a42]',
        mint: 'bg-[#eafaf3] text-[#1f7a42]',
        dark: 'bg-[#143f2d] text-white',
        light: 'bg-[#f2f8f4] text-[#203a2b]',
    };

    return (
        <div className="rounded-[22px] border border-[#def0e2] bg-white p-4 shadow-[0_6px_20px_rgba(22,59,36,0.04)]">
            <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${palette[tone]}`}>
                    <Icon size={18} />
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1f7a42]">
                    <CheckCircle2 size={11} /> {detail}
                </span>
            </div>
            <p className="mt-4 text-[10px] font-bold tracking-[0.14em] text-[#7a8c82] uppercase">{label}</p>
            <h3 className="mt-2 text-3xl font-bold text-[#163b24]">{value}</h3>
        </div>
    );
}
