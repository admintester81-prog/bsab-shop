import { api, getApiErrorMessage, prepareSanctum } from '@/lib/api';
import type { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BadgeHelp,
    Check,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    CreditCard,
    Headphones,
    Leaf,
    Mail,
    MessageCircle,
    Package,
    Phone,
    RotateCcw,
    Search,
    Send,
    TicketPercent,
    Truck,
    UserRound,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type ContactDetails = {
    email: string | null;
    phone: string | null;
    supportHours: string | null;
};

type HelpCategory = {
    title: string;
    description: string;
    icon: LucideIcon;
    color: string;
};

type HelpArticle = {
    question: string;
    category: string;
    answer: string;
};

type SupportMessage = {
    id: number | string;
    sender_type: 'customer' | 'support';
    body: string;
    delivery_status?: string;
    created_at: string;
    sendingState?: 'sending' | 'saved' | 'followup' | 'failed';
};

type ConversationResponse = {
    conversation: { id: number; status: string } | null;
    messages: SupportMessage[];
};

const categories: HelpCategory[] = [
    {
        title: 'Orders & Shipping',
        description: 'Track orders, delivery information, and shipping details.',
        icon: Truck,
        color: 'bg-[#e5f5eb] text-[#23824b]',
    },
    {
        title: 'Payments & Refunds',
        description: 'Payment methods, failed payments, refunds, and transactions.',
        icon: CreditCard,
        color: 'bg-[#e8f4ec] text-[#23764a]',
    },
    {
        title: 'Products & Variants',
        description: 'Product details, colors, sizes, variants, and stock.',
        icon: Package,
        color: 'bg-[#e6f3ed] text-[#176c45]',
    },
    {
        title: 'Returns & Exchanges',
        description: 'Return policies, refund eligibility, and exchanges.',
        icon: RotateCcw,
        color: 'bg-[#e9f5e9] text-[#36844b]',
    },
    {
        title: 'Account & Profile',
        description: 'Login, profile details, addresses, and account settings.',
        icon: UserRound,
        color: 'bg-[#e2f4ea] text-[#208252]',
    },
    {
        title: 'Vouchers & Promotions',
        description: 'Voucher codes, claiming, eligibility, and discounts.',
        icon: TicketPercent,
        color: 'bg-[#e5f5ed] text-[#20805a]',
    },
];

const articles: HelpArticle[] = [
    {
        question: 'How to track your order',
        category: 'Orders & Shipping',
        answer: 'Sign in to your BSAB-SHOP account, open Orders, and select an order to see its latest status and delivery details. If the status has not changed or you need help, contact support with your order number.',
    },
    {
        question: 'How to cancel an order',
        category: 'Orders & Shipping',
        answer: 'Open Orders, choose the order, and check whether cancellation is available for its current status. Orders already being prepared or delivered may no longer be cancellable; contact support promptly if you need assistance.',
    },
    {
        question: 'Return and refund policy',
        category: 'Returns & Exchanges',
        answer: 'Return eligibility depends on the item and its condition. Review the Return Policy page and contact support with your order number and a description of the issue so the team can advise you on next steps.',
    },
    {
        question: 'How to use a voucher code',
        category: 'Vouchers & Promotions',
        answer: 'Claim eligible vouchers from the Vouchers section of your account. At checkout, choose an available voucher before placing your order. The discount and eligibility requirements are shown with the voucher.',
    },
    {
        question: 'Available payment methods',
        category: 'Payments & Refunds',
        answer: 'Payment options are shown during checkout and can vary based on the seller and order. Select one of the methods displayed at checkout; if a payment fails, check its status before trying again.',
    },
    {
        question: 'How to update your delivery address',
        category: 'Account & Profile',
        answer: 'Open your account’s address settings to add or update a saved address. Before placing an order, confirm the selected address and delivery details on the checkout page.',
    },
    {
        question: 'How to reset your password',
        category: 'Account & Profile',
        answer: 'Choose “Forgot password?” on the sign-in page and follow the instructions sent to your account email. If you do not receive the email, check your spam folder and confirm you entered the correct address.',
    },
    {
        question: 'How to report a product issue',
        category: 'Products & Variants',
        answer: 'Contact support with the product name, seller, and a clear description of the issue. For an issue with an order you have already received, include the order number and any relevant details.',
    },
];

function formatTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function BotanicalAccent() {
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-[54%] opacity-80"
            viewBox="0 0 520 280"
            fill="none"
        >
            <circle cx="380" cy="132" r="135" fill="#fff" fillOpacity=".28" />
            <circle cx="468" cy="49" r="9" fill="#9ad4aa" fillOpacity=".7" />
            <path
                d="M363 271c-15-49-5-95 30-138m-20 101c-37-20-59-49-66-87m77 45c31-34 45-68 43-105m-27 120c41-14 69-37 86-69"
                stroke="#71b986"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <path
                d="M390 166c-25 2-40-8-47-28 26-2 41 7 47 28Zm19-26c-1-27 10-42 32-48 1 27-10 43-32 48Zm-37 65c-27 0-43-11-49-34 28 0 44 11 49 34Zm73 3c3-25 16-39 40-42-3 26-16 40-40 42Z"
                fill="#80c492"
                fillOpacity=".62"
            />
            <path
                d="M302 263c-25-36-32-72-20-109m6 79c-29-5-49-20-61-44m72 16c19-24 27-50 22-76"
                stroke="#96c99c"
                strokeWidth="3"
                strokeLinecap="round"
            />
            <path d="M288 212c-20-7-30-21-29-41 21 6 31 19 29 41Zm11-28c9-21 23-30 44-27-10 21-24 30-44 27Z" fill="#acd8ab" />
        </svg>
    );
}

function ChatPanel({ email, onClose, initialQuestion = '' }: { email: string | null; onClose: () => void; initialQuestion?: string }) {
    const page = usePage<SharedData>();
    const authenticated = Boolean(page.props.auth?.user?.id);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [draft, setDraft] = useState(initialQuestion);
    const [loading, setLoading] = useState(authenticated);
    const [sending, setSending] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false);
    const [assistantOnline, setAssistantOnline] = useState<boolean | null>(null);
    const [error, setError] = useState('');
    const messageListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!authenticated) return;

        let active = true;
        setLoading(true);
        api.get<ConversationResponse>('/support/conversation')
            .then(({ data }) => {
                if (active) setMessages(data.messages);
            })
            .catch((requestError: unknown) => {
                if (active) setError(getApiErrorMessage(requestError, 'Your previous messages could not be loaded. Please try again.'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [authenticated]);

    useEffect(() => {
        messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    useEffect(() => {
        let active = true;

        api.get<{ available: boolean }>('/support/assistant/status')
            .then(({ data }) => {
                if (active) setAssistantOnline(data.available);
            })
            .catch(() => {
                if (active) setAssistantOnline(false);
            });

        return () => {
            active = false;
        };
    }, []);

    async function saveMessage(body: string, temporaryId = `local-${Date.now()}`) {
        if (sending || !body.trim()) return;

        setError('');
        setSending(true);
        setIsPreparing(true);
        setMessages((current) => {
            const optimistic: SupportMessage = {
                id: temporaryId,
                sender_type: 'customer',
                body,
                created_at: new Date().toISOString(),
                sendingState: 'sending',
            };
            const existingIndex = current.findIndex((message) => message.id === temporaryId);
            if (existingIndex < 0) return [...current, optimistic];
            return current.map((message) => (message.id === temporaryId ? optimistic : message));
        });

        try {
            if (authenticated) {
                await prepareSanctum();
                const { data } = await api.post<{
                    message: SupportMessage;
                    assistant_message: SupportMessage | null;
                    assistant_available: boolean;
                    notice: string | null;
                }>('/support/conversation/messages', { body });
                setMessages((current) => [
                    ...current.map((message) =>
                        message.id === temporaryId
                            ? { ...data.message, sendingState: data.assistant_available ? ('saved' as const) : ('followup' as const) }
                            : message,
                    ),
                    ...(data.assistant_message ? [data.assistant_message] : []),
                ]);
                setAssistantOnline(data.assistant_available);
                if (data.notice) setError(data.notice);
            } else {
                const history = messages
                    .filter((message) => !message.sendingState || message.sendingState === 'saved')
                    .slice(-6)
                    .map((message) => ({
                        role: message.sender_type === 'customer' ? ('user' as const) : ('assistant' as const),
                        content: message.body,
                    }));
                const { data } = await api.post<{ reply: string; assistant_available: boolean }>('/support/assistant', { body, history });
                setMessages((current) => [
                    ...current.map((message) => (message.id === temporaryId ? { ...message, sendingState: 'saved' as const } : message)),
                    {
                        id: `assistant-${Date.now()}`,
                        sender_type: 'support',
                        body: data.reply,
                        created_at: new Date().toISOString(),
                    },
                ]);
                setAssistantOnline(data.assistant_available);
            }
        } catch (requestError: unknown) {
            setMessages((current) => current.map((message) => (message.id === temporaryId ? { ...message, sendingState: 'failed' } : message)));
            const status = (requestError as { response?: { status?: number } })?.response?.status;
            if (status === 503) setAssistantOnline(false);
            setError(
                getApiErrorMessage(
                    requestError,
                    authenticated ? 'Your message could not be saved. Please try again.' : 'The AI assistant could not answer. Please try again.',
                ),
            );
        } finally {
            setSending(false);
            setIsPreparing(false);
        }
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const body = draft.trim();
        if (!body) return;
        setDraft('');
        void saveMessage(body);
    }

    return (
        <section
            aria-label="BSAB-SHOP Support chat"
            className="fixed right-0 bottom-0 z-50 flex h-[min(78dvh,680px)] max-h-[calc(100dvh-env(safe-area-inset-top))] w-full flex-col overflow-hidden rounded-t-[26px] border border-[#dcebe1] bg-white shadow-[0_18px_70px_rgba(18,75,44,.22)] sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-97.5 sm:rounded-[26px]"
        >
            <div className="flex shrink-0 items-center gap-3 bg-[#f2faf5] px-4 py-3.5">
                <span className="flex size-11 items-center justify-center rounded-full bg-[#d9f0e1] text-[#176c40]">
                    <Headphones size={21} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-[#173b29]">BSAB-SHOP Support</h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#73877b]">
                        <span className={`size-1.5 rounded-full ${assistantOnline ? 'bg-[#36a567]' : 'bg-[#9baba0]'}`} />
                        {assistantOnline === null
                            ? 'Checking AI assistant…'
                            : assistantOnline
                              ? 'AI assistant online · no live agents'
                              : 'AI assistant offline · no live agents'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close support chat"
                    className="flex size-10 items-center justify-center rounded-full text-[#536b5d] hover:bg-white"
                >
                    <X size={19} />
                </button>
            </div>

            <div ref={messageListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfefc] px-4 py-4">
                <div className="rounded-2xl border border-[#e6efe9] bg-white px-3.5 py-3 text-xs leading-5 text-[#597064]">
                    <p className="font-semibold text-[#315c43]">BSAB-SHOP AI assistant</p>
                    <p className="mt-1">
                        {assistantOnline
                            ? 'Ask a question and the AI assistant will do its best to help. It is not a human agent and cannot access your order or account.'
                            : 'The AI assistant is unavailable right now, and no live agent is available.'}
                        {email && (
                            <>
                                {' '}
                                For direct support, email{' '}
                                <a className="font-semibold text-[#17804b] underline underline-offset-2" href={`mailto:${email}`}>
                                    {email}
                                </a>
                                .
                            </>
                        )}
                    </p>
                </div>

                {loading && <p className="py-2 text-center text-xs text-[#789184]">Loading your previous messages…</p>}
                {messages.map((message) => {
                    const isCustomer = message.sender_type === 'customer';
                    return (
                        <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 ${isCustomer ? 'rounded-br-md bg-[#128149] text-white' : 'rounded-bl-md bg-[#edf5ef] text-[#345b42]'}`}
                            >
                                {!isCustomer && <p className="mb-1 text-[10px] font-bold text-[#23804a]">BSAB-SHOP AI</p>}
                                <p className="text-xs leading-5 wrap-break-word whitespace-pre-wrap">{message.body}</p>
                                <div
                                    className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${isCustomer ? 'text-white/75' : 'text-[#829488]'}`}
                                >
                                    <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                                    {message.sendingState === 'sending' && <span>{authenticated ? 'Waiting for answer…' : 'Thinking…'}</span>}
                                    {message.sendingState === 'saved' && authenticated && (
                                        <>
                                            <span>Answered</span>
                                            <Check size={11} />
                                        </>
                                    )}
                                    {message.sendingState === 'followup' && <span>Saved for follow-up</span>}
                                    {message.sendingState === 'failed' && (
                                        <span className="text-[#a94141]">{authenticated ? 'Not saved' : 'Not answered'}</span>
                                    )}
                                </div>
                                {message.sendingState === 'failed' && (
                                    <button
                                        type="button"
                                        onClick={() => void saveMessage(message.body, String(message.id))}
                                        disabled={sending}
                                        className="mt-1 text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50"
                                    >
                                        Try again
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {isPreparing && <p className="px-2 text-xs text-[#789184]">BSAB-SHOP AI is preparing an answer…</p>}
            </div>

            {error && (
                <p role="alert" className="shrink-0 border-t border-[#f2dada] bg-[#fff8f8] px-4 py-2 text-xs text-[#a33d3d]">
                    {error}
                </p>
            )}

            <form
                onSubmit={submit}
                className="flex shrink-0 items-end gap-2 border-t border-[#edf2ee] bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
                <label className="sr-only" htmlFor="support-chat-message">
                    Write a message
                </label>
                <textarea
                    id="support-chat-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={2000}
                    rows={1}
                    placeholder={assistantOnline ? 'Ask the AI assistant…' : 'Ask a question…'}
                    className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-[#e2ece5] bg-[#fbfefc] px-4 py-3 text-sm text-[#244632] outline-none placeholder:text-[#9aaca0] focus:border-[#75b78d] focus:ring-2 focus:ring-[#d7efdf]"
                />
                <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    aria-label="Send message"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#128149] text-white shadow-sm transition hover:bg-[#0f6d3e] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <Send size={17} />
                </button>
            </form>
        </section>
    );
}

function ArticleRow({ article, expanded, onClick }: { article: HelpArticle; expanded: boolean; onClick: () => void }) {
    return (
        <div className="border-b border-[#edf2ee] last:border-b-0">
            <button type="button" aria-expanded={expanded} onClick={onClick} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf7f0] text-[#27844d]">
                    <CircleHelp size={16} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#234531]">{article.question}</span>
                    <span className="mt-1 block text-xs text-[#7b9082]">{article.category}</span>
                </span>
                {expanded ? (
                    <ChevronDown className="shrink-0 text-[#42845a]" size={17} />
                ) : (
                    <ChevronRight className="shrink-0 text-[#7d9a85]" size={17} />
                )}
            </button>
            {expanded && <p className="pr-2 pb-4 pl-11 text-sm leading-6 text-[#5c7263]">{article.answer}</p>}
        </div>
    );
}

export default function HelpCenter({ contactDetails }: { contactDetails: ContactDetails }) {
    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
    const [showAllArticles, setShowAllArticles] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInitialQuestion, setChatInitialQuestion] = useState('');
    const filteredArticles = articles.filter((article) => {
        const matchesQuery =
            !submittedQuery || `${article.question} ${article.category} ${article.answer}`.toLowerCase().includes(submittedQuery.toLowerCase());
        const matchesCategory = !selectedCategory || article.category === selectedCategory;
        return matchesQuery && matchesCategory;
    });
    const visibleArticles = showAllArticles || submittedQuery || selectedCategory ? filteredArticles : filteredArticles.slice(0, 5);

    function search(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmittedQuery(query.trim());
        setShowAllArticles(true);
        setExpandedArticle(null);
    }

    function chooseCategory(category: string) {
        setSelectedCategory((current) => (current === category ? null : category));
        setShowAllArticles(true);
        setExpandedArticle(null);
    }

    function askAssistant(question: string) {
        setChatInitialQuestion(question);
        setChatOpen(true);
    }

    return (
        <>
            <Head title="Help Center" />
            <main className="min-h-screen bg-[#f7fbf8] px-4 pb-12 text-[#1b3e2a] sm:px-6">
                <div className="mx-auto max-w-295">
                    <div className="py-4 sm:py-5">
                        <button
                            type="button"
                            onClick={() => {
                                if (window.history.length > 1) window.history.back();
                                else window.location.assign('/');
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-semibold text-[#236843] transition hover:bg-[#eaf5ed]"
                        >
                            <ArrowLeft size={18} strokeWidth={2.2} />
                            Back
                        </button>
                    </div>

                    <section className="relative isolate grid gap-7 overflow-hidden rounded-[28px] border border-[#dceee2] bg-linear-to-br from-[#f2fbf5] via-[#ecf8ef] to-[#dcefe1] px-5 py-6 shadow-[0_14px_40px_rgba(45,104,65,.08)] sm:gap-8 sm:px-8 sm:py-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:py-10">
                        <BotanicalAccent />
                        <div className="relative z-10">
                            <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold tracking-[.2em] text-[#388252] uppercase">
                                <Leaf size={14} /> Help Center
                            </p>
                            <h1 className="font-display text-3xl leading-tight font-bold tracking-[-.035em] text-[#17482e] sm:text-[42px]">
                                How can we help you?
                            </h1>
                            <p className="mt-3 max-w-137.5 text-sm leading-6 text-[#577462] sm:text-base sm:leading-7">
                                Find answers to your questions, get support, and make the most of your BSAB-SHOP experience.
                            </p>
                            <form
                                onSubmit={search}
                                className="mt-6 flex max-w-150 flex-col gap-2 rounded-2xl border border-[#e1eee5] bg-white p-2 shadow-[0_7px_20px_rgba(36,90,54,.08)] sm:flex-row sm:items-center sm:rounded-full sm:pl-4"
                            >
                                <Search className="ml-2 hidden shrink-0 text-[#378054] sm:block" size={19} />
                                <label htmlFor="help-search" className="sr-only">
                                    Search help articles
                                </label>
                                <input
                                    id="help-search"
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder='Search help articles, e.g. "track order" or "payment"'
                                    className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-sm text-[#244632] outline-none placeholder:text-[#8fa397] focus:ring-0 sm:px-1"
                                />
                                <button
                                    type="submit"
                                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#13834a] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#106d3d] sm:rounded-full"
                                >
                                    <Search size={16} className="sm:hidden" /> Search
                                </button>
                            </form>
                            <p className="mt-2 max-w-150 px-2 text-xs text-[#718578]">
                                Search FAQ articles here. To ask the AI assistant a question, use the “Chat with us” button.
                            </p>
                        </div>
                        <section
                            aria-labelledby="articles-heading"
                            className="relative z-10 rounded-3xl border border-white/90 bg-white/85 p-4 shadow-[0_8px_28px_rgba(40,91,55,.07)] backdrop-blur-sm sm:p-5"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold tracking-[.17em] text-[#47845c] uppercase">Quick answers</p>
                                    <h2 id="articles-heading" className="font-display mt-1 text-xl font-bold text-[#1c482f]">
                                        Popular articles
                                    </h2>
                                </div>
                                {selectedCategory && (
                                    <span className="rounded-full bg-[#edf7f0] px-3 py-1.5 text-[10px] font-semibold text-[#438158]">
                                        {selectedCategory}
                                    </span>
                                )}
                            </div>
                            {submittedQuery && (
                                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-[#f2f8f3] px-3 py-2 text-xs text-[#617969]">
                                    <span className="min-w-0 truncate">
                                        Results for <strong className="text-[#28573a]">“{submittedQuery}”</strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSubmittedQuery('');
                                            setQuery('');
                                        }}
                                        className="shrink-0 font-semibold text-[#21804c]"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                            <div className="max-h-72 overflow-y-auto pr-1">
                                {visibleArticles.length ? (
                                    visibleArticles.map((article) => (
                                        <ArticleRow
                                            key={article.question}
                                            article={article}
                                            expanded={expandedArticle === article.question}
                                            onClick={() => setExpandedArticle((current) => (current === article.question ? null : article.question))}
                                        />
                                    ))
                                ) : (
                                    <div className="py-7 text-center">
                                        <CircleHelp className="mx-auto text-[#8bb899]" size={28} />
                                        <p className="mt-3 text-sm font-semibold text-[#385a43]">No matching articles found</p>
                                        <p className="mt-1 text-xs text-[#7b9082]">Try another search, or ask the AI assistant instead.</p>
                                        {submittedQuery && (
                                            <button
                                                type="button"
                                                onClick={() => askAssistant(submittedQuery)}
                                                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-[#13834a] px-4 text-xs font-bold text-white transition hover:bg-[#106d3d]"
                                            >
                                                Ask the AI assistant about “{submittedQuery}”
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!submittedQuery && !selectedCategory && filteredArticles.length > 5 && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllArticles((value) => !value)}
                                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-bold text-[#16804b] hover:bg-[#eff8f1]"
                                >
                                    {showAllArticles ? 'Show popular articles' : 'View All Articles'}
                                    <ArrowRight size={16} />
                                </button>
                            )}
                            {(submittedQuery || selectedCategory) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSubmittedQuery('');
                                        setQuery('');
                                        setSelectedCategory(null);
                                        setShowAllArticles(false);
                                    }}
                                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm font-bold text-[#16804b] hover:bg-[#eff8f1]"
                                >
                                    View All Articles <ArrowRight size={16} />
                                </button>
                            )}
                        </section>
                        <div className="pointer-events-none absolute right-[8%] bottom-7 hidden size-28 items-center justify-center rounded-full border border-white/80 bg-white/50 text-[#6eae7f] shadow-[0_10px_25px_rgba(49,117,68,.08)] lg:flex">
                            <MessageCircle size={54} strokeWidth={1.3} />
                            <Leaf className="absolute -top-3 -right-2.25 size-9 rotate-12 text-[#71ad77]" />
                        </div>
                    </section>

                    <section aria-labelledby="categories-heading" className="mt-9 sm:mt-11">
                        <div className="mb-4 flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-bold tracking-[.18em] text-[#47845c] uppercase">Browse by topic</p>
                                <h2 id="categories-heading" className="font-display mt-1 text-xl font-bold text-[#1c482f] sm:text-2xl">
                                    Support categories
                                </h2>
                            </div>
                            {selectedCategory && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory(null)}
                                    className="text-xs font-semibold text-[#21804c] underline underline-offset-4"
                                >
                                    Clear filter
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
                            {categories.map(({ title, description, icon: Icon, color }) => {
                                const active = selectedCategory === title;
                                return (
                                    <button
                                        key={title}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => chooseCategory(title)}
                                        className={`group flex min-h-37.5 flex-col items-start rounded-2xl border bg-white p-3.5 text-left shadow-[0_4px_16px_rgba(45,104,65,.035)] transition hover:-translate-y-0.5 hover:border-[#b9dec4] hover:shadow-[0_8px_24px_rgba(45,104,65,.09)] sm:min-h-44.25 sm:p-4 ${active ? 'border-[#64ad7a] ring-2 ring-[#d9efdf]' : 'border-[#e4eee7]'}`}
                                    >
                                        <span className={`mb-3 flex size-10 items-center justify-center rounded-xl ${color}`}>
                                            <Icon size={20} strokeWidth={2.1} />
                                        </span>
                                        <span className="text-xs leading-5 font-bold text-[#214a32] sm:text-sm">{title}</span>
                                        <span className="mt-1.5 line-clamp-2 text-[11px] leading-[1.45] text-[#788d7e] sm:text-xs">
                                            {description}
                                        </span>
                                        <ChevronRight size={15} className="mt-auto hidden self-end text-[#479563] sm:block" />
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        aria-labelledby="contact-heading"
                        className="mt-9 rounded-3xl border border-[#e2eee5] bg-white p-4 shadow-[0_8px_28px_rgba(40,91,55,.045)] sm:mt-11 sm:p-6"
                    >
                        <p className="text-[11px] font-bold tracking-[.17em] text-[#47845c] uppercase">We’re here for you</p>
                        <h2 id="contact-heading" className="font-display mt-1 text-xl font-bold text-[#1c482f]">
                            Need More Help?
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[#718578]">Choose the best way to get in touch with our support team.</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <button
                                type="button"
                                onClick={() => setChatOpen(true)}
                                className="group flex min-h-19 w-full items-center gap-3 rounded-2xl border border-[#e5efe8] bg-[#f7fbf8] p-3.5 text-left transition hover:border-[#c2dfca] hover:bg-[#f0f8f2]"
                            >
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e3f3e8] text-[#21804c]">
                                    <MessageCircle size={20} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-[#28573a]">Live Chat</span>
                                    <span className="mt-1 block text-xs leading-5 text-[#7b9082]">Open chat to leave a message for follow-up.</span>
                                </span>
                                <ChevronRight size={17} className="shrink-0 text-[#7c9d84] group-hover:text-[#27834b]" />
                            </button>
                            <a
                                href={contactDetails.email ? `mailto:${contactDetails.email}` : '/pages/contact-us'}
                                className="group flex min-h-19 items-center gap-3 rounded-2xl border border-[#e5efe8] bg-[#f7fbf8] p-3.5 transition hover:border-[#c2dfca] hover:bg-[#f0f8f2]"
                            >
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e3f3e8] text-[#21804c]">
                                    <Mail size={20} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-[#28573a]">Email Support</span>
                                    <span className="mt-1 block text-xs leading-5 break-all text-[#7b9082]">
                                        {contactDetails.email || 'Send us a message using the contact form.'}
                                    </span>
                                </span>
                                <ChevronRight size={17} className="shrink-0 text-[#7c9d84] group-hover:text-[#27834b]" />
                            </a>
                            {contactDetails.phone && (
                                <a
                                    href={`tel:${contactDetails.phone.replace(/[^\d+]/g, '')}`}
                                    className="group flex min-h-19 items-center gap-3 rounded-2xl border border-[#e5efe8] bg-[#f7fbf8] p-3.5 transition hover:border-[#c2dfca] hover:bg-[#f0f8f2]"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e3f3e8] text-[#21804c]">
                                        <Phone size={20} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold text-[#28573a]">Call Support</span>
                                        <span className="mt-1 block text-xs leading-5 text-[#7b9082]">
                                            {contactDetails.phone}
                                            {contactDetails.supportHours ? ` · ${contactDetails.supportHours}` : ''}
                                        </span>
                                    </span>
                                    <ChevronRight size={17} className="shrink-0 text-[#7c9d84] group-hover:text-[#27834b]" />
                                </a>
                            )}
                        </div>
                        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#edf7ef] px-4 py-3.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#39824f]">
                                <BadgeHelp size={19} />
                            </span>
                            <p className="text-xs leading-5 text-[#607968]">
                                For order questions, include your order number so we can help you faster.
                            </p>
                        </div>
                    </section>

                    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#e5efe8] bg-white px-5 py-4 text-center sm:flex-row sm:text-left">
                        <p className="text-sm text-[#708578]">Still have a question? We’re happy to point you in the right direction.</p>
                        <Link
                            href="/pages/contact-us"
                            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#edf7f0] px-4 text-sm font-bold text-[#1d7543] transition hover:bg-[#e0f1e5]"
                        >
                            Contact Us <ArrowRight size={15} />
                        </Link>
                    </div>
                </div>
            </main>

            {!chatOpen && (
                <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    aria-label="Open BSAB-SHOP support chat"
                    className="fixed right-4 bottom-4 z-40 inline-flex min-h-14 items-center gap-2.5 rounded-full bg-[#13834a] px-4 text-white shadow-[0_8px_24px_rgba(16,112,60,.3)] transition hover:-translate-y-0.5 hover:bg-[#106d3d] sm:right-7 sm:bottom-7 sm:px-5"
                >
                    <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                        <MessageCircle size={19} />
                    </span>
                    <span className="pr-1 text-sm font-bold">Chat with us</span>
                </button>
            )}
            {chatOpen && <ChatPanel email={contactDetails.email} initialQuestion={chatInitialQuestion} onClose={() => setChatOpen(false)} />}
        </>
    );
}
