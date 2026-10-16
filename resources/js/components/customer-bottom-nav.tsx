import { Link, usePage } from '@inertiajs/react';
import { Grid2X2, Heart, Home, ShoppingCart, UserRound } from 'lucide-react';

const items = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Products', href: '/customer/products', icon: Grid2X2 },
    { label: 'Favorites', href: '/customer/favorites', icon: Heart },
    { label: 'Cart', href: '/customer/cart', icon: ShoppingCart },
    { label: 'Profile', href: '/customer/profile', icon: UserRound },
];

export default function CustomerBottomNav() {
    const page = usePage<{
        auth?: { user?: unknown } | null;
        cartCount?: number;
    }>();
    const { auth, cartCount = 0 } = page.props;
    const url = page.url.split('?')[0];
    const isAuthenticated = Boolean(auth?.user);

    function isActive(href: string) {
        if (href === '/') return url === '/';
        if (href === '/customer/profile') return url.startsWith('/customer/profile') || url.startsWith('/customer/settings');
        return url === href || url.startsWith(`${href}/`);
    }

    return (
        <nav
            aria-label="Mobile navigation"
            className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-around border-t border-[#dce8de] bg-[#fbfaf6] px-2 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] md:hidden"
        >
            {items.map(({ label, href, icon: Icon }) => {
                const active = isActive(href);
                const destination = href !== '/' && !isAuthenticated ? '/login' : href;

                return (
                    <Link
                        key={href}
                        href={destination}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex flex-col items-center gap-1 text-[10px] transition ${
                            active ? 'font-bold text-[#1f7a42]' : 'font-semibold text-[#9a9aa5] hover:text-[#1f7a42]'
                        }`}
                    >
                        <Icon size={19} />
                        <span>{label}</span>
                        {href === '/customer/cart' && isAuthenticated && cartCount > 0 && (
                            <span className="absolute -top-1 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#2a9b59] px-1 text-[8px] font-bold text-white">
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                        {active && <span className="h-0.5 w-5 rounded-full bg-[#1f7a42]" />}
                    </Link>
                );
            })}
        </nav>
    );
}
