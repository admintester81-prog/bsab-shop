import { Heart, Star } from 'lucide-react';
import type { CSSProperties } from 'react';

interface Product {
    id: number;
    name: string;
    description?: string | null;
    base_price: string;
    sale_price?: string | null;
    stock_quantity: number;
    available_stock?: number;
    is_out_of_stock?: boolean;
    average_rating?: number;
    review_count?: number;
    selling_unit?: string | null;
    category?: { name: string; slug: string } | null;
    shop?: { name: string } | null;
    images?: { path: string }[];
}

interface ProductCardProps {
    product: Product;
    liked: boolean;
    onToggleFavorite: () => void;
    onOpenProduct: () => void;
    style?: CSSProperties;
}

const imageUrl = (path?: string | null) => (path ? (path.startsWith('http') || path.startsWith('/') ? path : `/storage/${path}`) : null);

const money = (value: string | number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));

export default function ProductCard({ product, liked, onToggleFavorite, onOpenProduct, style }: ProductCardProps) {
    const image = imageUrl(product.images?.[0]?.path);
    const price = product.sale_price ?? product.base_price;
    const isSale = !!product.sale_price && Number(product.sale_price) < Number(product.base_price);
    const isSold = (product.is_out_of_stock ?? product.stock_quantity < 1) || false;
    const availableStock = product.available_stock ?? product.stock_quantity;
    const averageRating = Number(product.average_rating ?? 0);
    const reviewCount = Number(product.review_count ?? 0);

    const initials = product.shop?.name
        ? product.shop.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
        : product.name
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

    return (
        <article
            className={`card${isSold ? 'sold' : ''}`}
            onClick={onOpenProduct}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenProduct();
                }
            }}
            role="link"
            tabIndex={0}
            style={style}
        >
            <div className="card-media">
                {image ? (
                    <img src={image} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                    <div className="ph">{initials}</div>
                )}

                <button
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite();
                    }}
                    aria-label={liked ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                    className={`fav-chip${liked ? ' active' : ''}`}
                    aria-pressed={liked}
                >
                    <Heart size={15} fill={liked ? '#2c9350' : 'none'} />
                </button>

                {isSale && <span className="discount-tag">Sale</span>}
            </div>

            <div className="card-body">
                <span className="card-shop">{product.category?.name ?? 'Marketplace'}</span>
                <h3 className="card-name">{product.name}</h3>

                <div className="rating-row" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
                    <span className="rating-stars">
                        {Array.from({ length: 5 }, (_, index) => (
                            <Star key={index} size={11} fill={averageRating >= index + 1 ? 'currentColor' : 'none'} strokeWidth={1.8} />
                        ))}
                    </span>
                    <span className="rating-score">{averageRating.toFixed(1)}</span>
                    <span className="rating-count">({reviewCount})</span>
                </div>

                <div className="price-row">
                    <div className="price-group">
                        <span className="price">{money(price)}</span>
                        {product.selling_unit && <span className="unit">/{product.selling_unit}</span>}
                    </div>
                </div>

                <p className={`stock-note ${isSold ? 'out' : ''}`}>{isSold ? 'Out of stock' : `${availableStock} available`}</p>
            </div>
        </article>
    );
}
