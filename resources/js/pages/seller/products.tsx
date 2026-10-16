import { PortalLayout } from '@/components/portal-layout';
import { prepareSanctum } from '@/lib/api';
import { Head, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    BarChart3,
    Box,
    ChevronDown,
    CircleDollarSign,
    Download,
    Eye,
    FileText,
    ImagePlus,
    Layers3,
    LineChart,
    Package,
    Pencil,
    Plus,
    Search,
    ShoppingBag,
    Trash2,
    TrendingUp,
    TriangleAlert,
} from 'lucide-react';
import { FormEventHandler, Fragment, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart as RechartsLineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type Product = {
    id: number;
    name: string;
    sku: string;
    description: string | null;
    base_price: string;
    sale_price: string | null;
    stock_quantity: number;
    status: string;
    short_video_path?: string | null;
    category?: { id: number; name: string } | null;
    images?: { path: string; is_primary: boolean }[];
    brand?: string | null;
    model?: string | null;
    condition?: string | null;
    selling_unit?: string | null;
    barcode?: string | null;
    color?: string | null;
    size?: string | null;
    material?: string | null;
    weight?: string | null;
    volume?: string | null;
    pack_quantity?: number | string | null;
    length?: string | null;
    width?: string | null;
    height?: string | null;
    warranty?: string | null;
    country_of_origin?: string | null;
    product_options?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    slug?: string | null;
    currency?: string | null;
    is_active?: boolean | null;
    is_approved?: boolean | null;
    authenticity_status?: string | null;
    verification_status?: string | null;
    published_at?: string | null;
    variants?: {
        id: number;
        name: string;
        sku: string;
        price: string | null;
        stock_quantity: number;
        is_active: boolean;
        option_values?: {
            option_value?: {
                value: string;
                option?: { name: string } | null;
            } | null;
        }[];
    }[];
};
type Category = { id: number; name: string };
type ProductMonitoring = {
    totalProducts: number;
    published: number;
    lowStock: number;
    pendingReview: number;
    views: number;
    viewsChange: number;
    sales: number;
    salesChange: number;
    inventoryValue: number;
    conversionRate: number;
    productChange: number;
    publishedChange: number;
    lowStockChange: number;
    pendingReviewChange: number;
    dailyPerformance: { date: string; label: string; views: number; sales: number; stock: number }[];
    statusBreakdown: { name: string; value: number; color: string }[];
};
type PerformanceRange = '7 Days' | '30 Days' | '3 Months' | 'This Year';
type ProductSort = 'newest' | 'oldest' | 'price' | 'stock' | 'name';
type ProductForm = {
    _method?: 'patch';
    category_id: string;
    name: string;
    description: string;
    base_price: string;
    sale_price: string;
    stock_quantity: string;
    brand: string;
    model: string;
    condition: string;
    selling_unit: string;
    color: string;
    size: string;
    material: string;
    weight: string;
    volume: string;
    pack_quantity: string;
    length: string;
    width: string;
    height: string;
    warranty: string;
    country_of_origin: string;
    product_options: string;
    variant_stocks?: string;
    variant_prices?: string;
    image: File | null;
    images: File[];
    product_video: File | null;
    is_active: boolean;
};

type VariantValue = { id: string; value: string };
type VariantGroup = { id: string; type: string; values: VariantValue[] };
type VariantCombination = { key: string; label: string; name: string };
const variantTypeOptions = [
    'Size',
    'Weight',
    'Pack Size',
    'Volume',
    'Length',
    'Diameter',
    'Capacity',
    'Variety',
    'Grade',
    'Color',
    'Material',
    'Type',
    'Form',
    'Growth Stage',
    'Quantity',
    'Model',
];

const defaultVariantValueMap: Record<string, string[]> = {
    Size: ['Small', 'Medium', 'Large', 'XL', 'XXL'],
    Weight: ['1kg', '5kg', '10kg', '25kg'],
    'Pack Size': ['10 seeds', '50 seeds', '100 seeds'],
    Volume: ['250ml', '500ml', '1L', '5L'],
    Length: ['5m', '10m', '20m', '50m'],
    Diameter: ['16mm', '20mm', '25mm'],
    Capacity: ['5L', '10L', '20L'],
    Variety: ['Hybrid', 'Open-pollinated'],
    Grade: ['Standard', 'Premium'],
    Color: ['Green', 'Black', 'White', 'Red', 'Blue'],
    Material: ['Plastic', 'Metal', 'Stainless'],
    Type: ['Organic', 'Synthetic'],
    Form: ['Granular', 'Powder', 'Liquid'],
    'Growth Stage': ['Starter', 'Grower', 'Finisher'],
    Quantity: ['1pc', '5pcs', '10pcs'],
    Model: ['Model A', 'Model B', 'Model C'],
};

const categoryDefaultVariantMap: Record<string, string> = {
    'Rice / Grains': 'Weight',
    Seeds: 'Pack Size',
    Fertilizer: 'Weight',
    Pesticide: 'Volume',
    'Farm Tools': 'Quantity',
    Irrigation: 'Length',
    'Livestock Supplies': 'Weight',
    'Garden Supplies': 'Size',
    Clothing: 'Size',
    Footwear: 'Size',
    Electronics: 'Capacity',
    'Other Product': 'Size',
};

const createVariantGroup = (type = 'Weight', values = defaultVariantValueMap[type] ?? ['Small', 'Medium']): VariantGroup => ({
    id: `group-${Math.random().toString(36).slice(2, 10)}`,
    type,
    values: values.map((value, index) => ({
        id: `${type}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        value,
    })),
});

function buildVariantCombinations(groups: VariantGroup[]): VariantCombination[] {
    const activeGroups = groups
        .map((group) => ({ ...group, values: group.values.filter((value) => value.value.trim()) }))
        .filter((group) => group.values.length > 0);

    if (activeGroups.length === 0) {
        return [];
    }

    let combinations = [{ keys: [] as string[], labels: [] as string[] }];
    for (const group of activeGroups) {
        combinations = combinations.flatMap((combination) =>
            group.values.map((value) => ({
                keys: [...combination.keys, value.id],
                labels: [...combination.labels, `${group.type}: ${value.value.trim()}`],
            })),
        );
    }

    return combinations.map((combination) => ({
        key: combination.keys.join('|'),
        label: combination.labels.join(' / '),
        name: combination.labels.map((label) => label.slice(label.indexOf(':') + 2)).join(' / '),
    }));
}

function parseVariantGroups(raw: string): VariantGroup[] {
    const groups = raw
        .split(/\r?\n/)
        .map((line, groupIndex) => {
            const separator = line.indexOf(':');
            if (separator < 1) return null;
            const type = line.slice(0, separator).trim();
            const values = line
                .slice(separator + 1)
                .split(',')
                .map((value, valueIndex) => ({
                    id: `edit-${groupIndex}-${valueIndex}`,
                    value: value.trim(),
                }))
                .filter((value) => value.value);
            return type && values.length ? { id: `edit-group-${groupIndex}`, type, values } : null;
        })
        .filter((group): group is VariantGroup => group !== null);

    return groups;
}

const blank: ProductForm = {
    category_id: '',
    name: '',
    description: '',
    base_price: '',
    sale_price: '',
    stock_quantity: '0',
    brand: '',
    model: '',
    condition: 'new',
    selling_unit: 'piece',
    color: '',
    size: '',
    material: '',
    weight: '',
    volume: '',
    pack_quantity: '1',
    length: '',
    width: '',
    height: '',
    warranty: '',
    country_of_origin: '',
    product_options: '',
    image: null,
    images: [],
    product_video: null,
    is_active: true,
};

type CropImage = { file: File; url: string; width: number; height: number; zoom: number; x: number; y: number };

function readSourceImage(file: File): Promise<{ url: string; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            resolve({ url, width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Unable to read image.'));
        };
        image.src = url;
    });
}

function cropToSquare(crop: CropImage): Promise<File> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1000;
            canvas.height = 1000;
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Unable to prepare image.'));
                return;
            }
            const viewport = 320;
            const scale = Math.max(viewport / crop.width, viewport / crop.height) * crop.zoom;
            const renderedWidth = crop.width * scale;
            const renderedHeight = crop.height * scale;
            const left = (viewport - renderedWidth) / 2 + crop.x;
            const top = (viewport - renderedHeight) / 2 + crop.y;
            const sourceSize = viewport / scale;
            const sourceX = Math.max(0, Math.min(crop.width - sourceSize, -left / scale));
            const sourceY = Math.max(0, Math.min(crop.height - sourceSize, -top / scale));
            context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 1000, 1000);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Unable to prepare image.'));
                        return;
                    }
                    resolve(new File([blob], crop.file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
                },
                'image/jpeg',
                0.9,
            );
        };
        image.onerror = () => reject(new Error('Unable to read image.'));
        image.src = crop.url;
    });
}

function formatMoney(value?: string | number | null) {
    if (value === null || value === undefined || value === '') {
        return '₱0.00';
    }

    const amount = Number(value);
    if (Number.isNaN(amount)) {
        return '₱0.00';
    }

    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

function statusClass(status: string) {
    return status === 'published' || status === 'active' ? 'active' : 'inactive';
}

function displayStatus(status: string) {
    return status ? status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Draft';
}

function localDateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function SellerProducts({ products, categories, monitoring }: { products: Product[]; categories: Category[]; monitoring: ProductMonitoring }) {
    const [editing, setEditing] = useState<Product | null>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState<ProductSort>('newest');
    const [performanceRange, setPerformanceRange] = useState<PerformanceRange>('30 Days');
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
    const [imageProcessing, setImageProcessing] = useState(false);
    const [imageError, setImageError] = useState('');
    const [cropQueue, setCropQueue] = useState<File[]>([]);
    const [cropImage, setCropImage] = useState<CropImage | null>(null);
    const [existingImages, setExistingImages] = useState<{ path: string; is_primary: boolean }[]>([]);
    const [existingVideo, setExistingVideo] = useState('');
    const [viewProductId, setViewProductId] = useState<number | null>(null);
    const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([createVariantGroup()]);
    const [variantStocks, setVariantStocks] = useState<Record<string, string>>({});
    const [variantPrices, setVariantPrices] = useState<Record<string, string>>({});
    const [variantLocked, setVariantLocked] = useState(false);
    const form = useForm<ProductForm>(blank);
    const variantCombinations = buildVariantCombinations(variantGroups);
    const allocatedStockTotal = variantCombinations.reduce((total, combination) => {
        const stock = Number(variantStocks[combination.key]);
        return total + (Number.isInteger(stock) && stock > 0 ? stock : 0);
    }, 0);
    const matchingProducts = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const rows = products.filter((product) => {
            const matchesSearch = !needle || `${product.name} ${product.sku} ${product.brand ?? ''}`.toLowerCase().includes(needle);
            const matchesCategory = categoryFilter === 'all' || String(product.category?.id ?? '') === categoryFilter;
            const matchesStatus = statusFilter === 'all' || product.status.toLowerCase() === statusFilter;
            const matchesStock = stockFilter === 'all'
                || (stockFilter === 'low' && product.stock_quantity < 5)
                || (stockFilter === 'out' && product.stock_quantity === 0)
                || (stockFilter === 'available' && product.stock_quantity >= 5);
            return matchesSearch && matchesCategory && matchesStatus && matchesStock;
        });
        rows.sort((left, right) => {
            if (sortOrder === 'newest') return (right.created_at ?? '').localeCompare(left.created_at ?? '');
            if (sortOrder === 'oldest') return (left.created_at ?? '').localeCompare(right.created_at ?? '');
            if (sortOrder === 'price') return Number(left.sale_price || left.base_price) - Number(right.sale_price || right.base_price);
            if (sortOrder === 'stock') return left.stock_quantity - right.stock_quantity;
            return left.name.localeCompare(right.name);
        });
        return rows;
    }, [products, search, categoryFilter, statusFilter, stockFilter, sortOrder]);
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(matchingProducts.length / pageSize));
    const page = Math.min(currentPage, pageCount);
    const visibleProducts = matchingProducts.slice((page - 1) * pageSize, page * pageSize);
    const published = products.filter((product) => product.status === 'published').length;
    const lowStock = products.filter((product) => product.stock_quantity < 5).length;
    const pendingReview = products.filter((product) => product.status === 'pending').length;
    const selectedProduct = products.find((product) => product.id === viewProductId) ?? visibleProducts[0] ?? products[0] ?? null;
    const statusBreakdown = monitoring.statusBreakdown;
    const performanceData = useMemo(() => {
        const today = new Date();
        const count = performanceRange === '7 Days' ? 7 : performanceRange === '30 Days' ? 30 : performanceRange === '3 Months' ? 90 : 365;
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        if (performanceRange === 'This Year') start.setMonth(0, 1);
        else start.setDate(start.getDate() - count + 1);
        const range = monitoring.dailyPerformance.filter((point) => point.date >= localDateKey(start));
        if (performanceRange !== '3 Months' && performanceRange !== 'This Year') return range;
        const monthly = new Map<string, { date: string; label: string; views: number; sales: number; stock: number }>();
        for (const point of range) {
            const monthKey = point.date.slice(0, 7);
            const existing = monthly.get(monthKey);
            if (existing) {
                existing.views += point.views;
                existing.sales += point.sales;
                existing.stock = point.stock;
            } else {
                const date = new Date(`${monthKey}-01T00:00:00`);
                monthly.set(monthKey, {
                    date: monthKey,
                    label: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date),
                    views: point.views,
                    sales: point.sales,
                    stock: point.stock,
                });
            }
        }
        return Array.from(monthly.values());
    }, [monitoring.dailyPerformance, performanceRange]);
    const categoryPerformance = useMemo(() => categories.map((category) => ({
        name: category.name,
        products: products.filter((product) => product.category?.id === category.id).length,
        stock: products.filter((product) => product.category?.id === category.id).reduce((total, product) => total + product.stock_quantity, 0),
    })).filter((category) => category.products > 0).slice(0, 6), [categories, products]);
    const lowStockProducts = products.filter((product) => product.stock_quantity < 5).slice(0, 5);

    const openModal = (product?: Product) => {
        const isEditing = Boolean(product);

        setEditing(product ?? null);
        setOpen(true);
        setExistingImages(product?.images ?? []);
        setExistingVideo(product?.short_video_path ?? '');

        const selectedCategory = product?.category?.name ?? categories[0]?.name ?? 'Rice / Grains';
        const defaultType = categoryDefaultVariantMap[selectedCategory] ?? 'Weight';
        const initialVariants = product?.product_options ? parseVariantGroups(product.product_options) : [createVariantGroup(defaultType)];

        const productForm = product
            ? {
                  category_id: String(product.category?.id ?? ''),
                  name: product.name,
                  description: product.description ?? '',
                  base_price: String(product.base_price ?? ''),
                  sale_price: String(product.sale_price ?? ''),
                  stock_quantity: String(product.stock_quantity ?? 0),
                  brand: product.brand ?? '',
                  model: product.model ?? '',
                  condition: product.condition ?? 'new',
                  selling_unit: product.selling_unit ?? 'piece',
                  color: product.color ?? '',
                  size: product.size ?? '',
                  material: product.material ?? '',
                  weight: product.weight ?? '',
                  volume: product.volume ?? '',
                  pack_quantity: String(product.pack_quantity ?? '1'),
                  length: product.length ?? '',
                  width: product.width ?? '',
                  height: product.height ?? '',
                  warranty: product.warranty ?? '',
                  country_of_origin: product.country_of_origin ?? '',
                  product_options: product.product_options ?? '',
                  image: null,
                  images: [],
                  product_video: null,
                  is_active: isEditing ? product.status === 'published' || product.status === 'active' : true,
              }
            : { ...blank, category_id: String(categories[0]?.id ?? '') };

        form.setData(productForm);
        form.clearErrors();
        setVariantGroups(initialVariants);
        const existingByName = new Map((product?.variants ?? []).map((variant) => [variant.name, variant]));
        const initialCombinations = buildVariantCombinations(initialVariants);
        setVariantStocks(
            Object.fromEntries(
                initialCombinations.map((combination) => [
                    combination.key,
                    existingByName.has(combination.name) ? String(existingByName.get(combination.name)?.stock_quantity ?? '') : '',
                ]),
            ),
        );
        setVariantPrices(
            Object.fromEntries(initialCombinations.map((combination) => [combination.key, existingByName.get(combination.name)?.price ?? ''])),
        );
        setVariantLocked(false);
    };
    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        setImageProcessing(false);
        setImageError('');
        setExistingImages([]);
        setExistingVideo('');
        setVariantGroups([createVariantGroup()]);
        setVariantStocks({});
        setVariantPrices({});
        setVariantLocked(false);
        if (cropImage) URL.revokeObjectURL(cropImage.url);
        setCropImage(null);
        setCropQueue([]);
        form.reset();
        form.clearErrors();
    };
    const adaptProduct = (nextCategoryId: string) => {
        const categoryName = categories.find((item) => String(item.id) === nextCategoryId)?.name ?? '';
        form.setData('category_id', nextCategoryId);

        if (!variantLocked && categoryName) {
            const defaultType = categoryDefaultVariantMap[categoryName] ?? 'Size';
            setVariantGroups((current) => {
                if (!current.length) {
                    return [createVariantGroup(defaultType)];
                }

                const next = [...current];
                next[0] = {
                    ...next[0],
                    type: defaultType,
                    values: (defaultVariantValueMap[defaultType] ?? ['Small']).map((value) => ({
                        id: `${defaultType}-${Math.random().toString(36).slice(2, 8)}`,
                        value,
                    })),
                };
                return next;
            });
        }
    };
    const addVariantGroup = () => {
        setVariantLocked(true);
        setVariantGroups((current) => [...current, createVariantGroup('Size')]);
    };
    const removeVariantGroup = (id: string) => {
        setVariantGroups((current) => (current.length > 1 ? current.filter((group) => group.id !== id) : current));
    };
    const addVariantValue = (groupId: string) => {
        setVariantLocked(true);
        setVariantGroups((current) =>
            current.map((group) =>
                group.id === groupId
                    ? {
                          ...group,
                          values: [...group.values, { id: `value-${Math.random().toString(36).slice(2, 9)}`, value: '' }],
                      }
                    : group,
            ),
        );
    };
    const removeVariantValue = (groupId: string, valueId: string) => {
        setVariantGroups((current) =>
            current.map((group) => (group.id === groupId ? { ...group, values: group.values.filter((value) => value.id !== valueId) } : group)),
        );
    };
    const changeVariantType = (groupId: string, nextType: string) => {
        setVariantLocked(true);
        setVariantGroups((current) =>
            current.map((group) => {
                if (group.id !== groupId) return group;
                const preset = defaultVariantValueMap[nextType] ?? ['Custom'];
                return {
                    ...group,
                    type: nextType,
                    values: preset.map((value, index) => ({
                        id: `${nextType}-${index}-${Math.random().toString(36).slice(2, 8)}`,
                        value,
                    })),
                };
            }),
        );
    };
    const previewImages = (files: FileList | null) => {
        if (!files || !files.length) return;
        const selected = Array.from(files);
        const allowed = selected.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
        if (!allowed.length) {
            setImageError('Please choose JPG, PNG, or WebP images.');
            return;
        }
        form.setData('images', [...form.data.images, ...allowed]);
        form.setData('image', allowed[0]);
        setImageError('');
    };
    const previewVideo = (file: File | null) => {
        form.setData('product_video', file);
    };
    const buildVariantOptionSpec = (groups: VariantGroup[]) =>
        groups
            .filter((group) => group.values.some((value) => value.value.trim()))
            .map((group) => {
                const values = group.values
                    .filter((value) => value.value.trim())
                    .map((value) => value.value.trim())
                    .join(', ');

                return `${group.type}: ${values}`;
            })
            .join('\n');
    const saveProduct = async (event: React.FormEvent) => {
        event.preventDefault();
        const variantText = buildVariantOptionSpec(variantGroups);
        const stockValues = variantCombinations.map((combination) => Number(variantStocks[combination.key] || 0));
        const priceValues = variantCombinations.map((combination) => variantPrices[combination.key] ?? '');
        const totalStock = stockValues.reduce((total, stock) => total + stock, 0);
        if (priceValues.some((value) => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) {
            form.setError('variant_prices', 'Enter a valid price for every variant combination.');
            return;
        }
        form.setData('product_options', variantText);

        const options = { preserveScroll: true, forceFormData: true, onSuccess: closeModal };
        form.transform((data) => ({
            ...data,
            stock_quantity: String(totalStock),
            product_options: variantText,
            variant_stocks: JSON.stringify(stockValues),
            variant_prices: JSON.stringify(priceValues),
            ...(editing ? { _method: 'patch' } : {}),
        }));
        await prepareSanctum();
        form.post(editing ? route('seller.products.update', editing.id) : route('seller.products.store'), options);
    };

    const chooseCrop = (file: File, files: File[]) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            setImageProcessing(false);
            setCropImage({
                file,
                url,
                width: image.naturalWidth,
                height: image.naturalHeight,
                zoom: 1,
                x: 0,
                y: 0,
            });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            setImageProcessing(false);
            setImageError('This image could not be read. Please choose another file.');
        };
        image.src = url;

        form.setData('image', file);
        form.setData('images', files);
    };
    const submit: FormEventHandler = async (event) => {
        event.preventDefault();
        if (!editing && !form.data.product_options.trim()) {
            form.setError('product_options', 'Add at least one product variant option, for example: Crop: Tomato, Lettuce.');
            return;
        }

        const variantText = buildVariantOptionSpec(variantGroups);
        form.setData('product_options', variantText);

        const options = { preserveScroll: true, forceFormData: true, onSuccess: close };
        form.transform((data) => ({
            ...data,
            product_options: variantText,
            ...(editing ? { _method: 'patch' } : {}),
        }));
        await prepareSanctum();
        form.post(editing ? route('seller.products.update', editing.id) : route('seller.products.store'), options);
    };
    const applyCurrentCrop = async (auto = false) => {
        if (!cropImage) return;
        setImageProcessing(true);
        try {
            const currentFile = cropImage.file;
            const currentCrop = auto ? { ...cropImage, zoom: 1, x: 0, y: 0 } : cropImage;

            const croppedFile = await cropToSquare({
                ...currentCrop,
                file: currentFile,
            });

            const nextImages = [...form.data.images];
            const selectedIndex = nextImages.findIndex((file) => file === currentFile);
            if (selectedIndex >= 0) {
                nextImages[selectedIndex] = croppedFile;
            } else {
                nextImages.push(croppedFile);
            }

            const remaining = cropQueue.slice(1);
            form.setData('images', nextImages);
            form.setData('image', croppedFile);

            URL.revokeObjectURL(cropImage.url);
            setCropImage(null);

            if (remaining.length > 0) {
                const nextFile = remaining[0];
                setCropQueue(remaining);
                chooseCrop(nextFile, nextImages);
            } else {
                setCropQueue([]);
            }
        } catch {
            setImageError('This image could not be cropped. Please choose another file.');
        } finally {
            setImageProcessing(false);
        }
    };

    const applyCrop = async () => {
        await applyCurrentCrop(false);
    };

    const applyAutoCrop = async () => {
        await applyCurrentCrop(true);
    };

    const removeQueuedImage = (fileToRemove: File) => {
        const nextImages = form.data.images.filter((file) => file !== fileToRemove);
        const nextCropQueue = cropQueue.filter((file) => file !== fileToRemove);

        form.setData('images', nextImages);
        setCropQueue(nextCropQueue);

        if (cropImage && cropImage.file === fileToRemove) {
            URL.revokeObjectURL(cropImage.url);
            setCropImage(null);
        }

        if (form.data.image === fileToRemove) {
            form.setData('image', nextImages[0] ?? null);
        }

        if (nextCropQueue.length > 0 && (!cropImage || cropImage.file === fileToRemove)) {
            chooseCrop(nextCropQueue[0], nextImages);
        }
    };

    const exportProducts = () => {
        const rows = [
            ['Product', 'SKU', 'Brand', 'Category', 'Price', 'Stock', 'Status'],
            ...matchingProducts.map((product) => [
                product.name,
                product.sku,
                product.brand ?? '',
                product.category?.name ?? '',
                String(product.sale_price || product.base_price),
                String(product.stock_quantity),
                displayStatus(product.status),
            ]),
        ];
        const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'seller-products.csv';
        link.click();
        URL.revokeObjectURL(url);
    };
    const changeFilter = (setter: (value: string) => void, value: string) => {
        setter(value);
        setCurrentPage(1);
    };

    return (
        <>
            <Head title="Products" />
            <PortalLayout role="seller" title="Products" eyebrow="Morrow Studio">
                <div className="space-y-3.5">
                    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#27774a]"><Package size={12} /> Products</p>
                            <h1 className="mt-1 text-xl font-bold text-[#16483b] sm:text-2xl">Product Monitoring</h1>
                            <p className="mt-1 text-[10px] text-[#728078] sm:text-xs">Track and manage your product inventory, performance, and status.</p>
                        </div>
                        <button type="button" onClick={() => openModal()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#19864b] px-4 text-[11px] font-semibold text-white hover:bg-[#126d39]"><Plus size={14} /> Add product</button>
                    </header>

                    <section aria-label="Product statistics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <ProductMetric label="Total products" value={products.length} change={monitoring.productChange} icon={Package} />
                        <ProductMetric label="Published" value={published} change={monitoring.publishedChange} icon={Eye} />
                        <ProductMetric label="Low stock" value={lowStock} change={monitoring.lowStockChange} icon={TriangleAlert} warning />
                        <ProductMetric label="Pending review" value={pendingReview} change={monitoring.pendingReviewChange} icon={FileText} />
                    </section>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.95fr)]">
                        <section className="min-w-0 bg-white p-3 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div><h2 className="text-xs font-bold text-[#25372c]">Product Performance</h2><p className="mt-0.5 text-[9px] text-[#7d8b82]">Views, sales and stock over the selected period</p></div>
                                <div className="flex rounded-md bg-[#f3f8f5] p-0.5">
                                    {(['7 Days', '30 Days', '3 Months', 'This Year'] as const).map((range) => <button key={range} type="button" onClick={() => setPerformanceRange(range)} className={`rounded px-2 py-1 text-[8px] font-semibold ${performanceRange === range ? 'bg-[#19864b] text-white' : 'text-[#66766c] hover:text-[#1d7243]'}`}>{range}</button>)}
                                </div>
                            </div>
                            <div className="mt-2 h-40 w-full sm:h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={performanceData} margin={{ top: 6, right: 4, bottom: 0, left: -23 }}>
                                        <defs>
                                            <linearGradient id="productViewsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2ca667" stopOpacity={0.18} /><stop offset="100%" stopColor="#2ca667" stopOpacity={0.01} /></linearGradient>
                                            <linearGradient id="productSalesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7ccda4" stopOpacity={0.24} /><stop offset="100%" stopColor="#7ccda4" stopOpacity={0.01} /></linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="#edf1ee" strokeDasharray="3 4" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#dfe7e1' }} minTickGap={18} />
                                        <YAxis allowDecimals={false} width={27} tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ borderColor: '#dce7df', borderRadius: 7, fontSize: 10 }} />
                                        <Area type="monotone" dataKey="views" name="Views" stroke="#28a263" fill="url(#productViewsFill)" strokeWidth={1.6} />
                                        <Area type="monotone" dataKey="sales" name="Sales" stroke="#7bc9a0" fill="url(#productSalesFill)" strokeWidth={1.4} />
                                        <Line type="monotone" dataKey="stock" name="Stock" stroke="#bdded0" strokeWidth={1.5} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <ProductLegend items={[['Views', '#28a263'], ['Sales', '#7bc9a0'], ['Stock', '#bdded0']]} />
                        </section>
                        <section className="min-w-0 bg-white p-3 sm:p-4">
                            <div><h2 className="text-xs font-bold text-[#25372c]">Product Status</h2><p className="mt-0.5 text-[9px] text-[#7d8b82]">Distribution of product status</p></div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="relative h-36 w-36 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart><Pie data={statusBreakdown.filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius={42} outerRadius={61} paddingAngle={2} stroke="white" strokeWidth={2}>{statusBreakdown.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value) => [value, 'Products']} contentStyle={{ borderColor: '#dce7df', borderRadius: 7, fontSize: 10 }} /></PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg font-bold text-[#1d3426]">{products.length}</strong><span className="text-[8px] text-[#819087]">Total products</span></div>
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                    {statusBreakdown.map((item) => <div key={item.name} className="flex items-center justify-between gap-1 text-[9px] text-[#65746b]"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></span><strong className="shrink-0">{item.value} ({products.length ? ((item.value / products.length) * 100).toFixed(1) : '0.0'}%)</strong></div>)}
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="min-w-0 bg-white p-3 sm:p-4">
                        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex h-8 w-full items-center gap-1.5 rounded-md border border-[#e0e8e2] px-2 sm:w-44">
                                    <Search size={12} className="shrink-0 text-[#748279]" />
                                    <input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search products..." className="min-w-0 flex-1 bg-transparent text-[9px] outline-none placeholder:text-[#929d96]" />
                                </label>
                                <select value={categoryFilter} onChange={(event) => changeFilter(setCategoryFilter, event.target.value)} className="h-8 max-w-36 rounded-md border border-[#e0e8e2] bg-white px-2 text-[9px] text-[#59695e] outline-none"><option value="all">All Categories</option>{categories.map((category) => <option key={category.id} value={String(category.id)}>{category.name}</option>)}</select>
                                <select value={statusFilter} onChange={(event) => changeFilter(setStatusFilter, event.target.value)} className="h-8 rounded-md border border-[#e0e8e2] bg-white px-2 text-[9px] text-[#59695e] outline-none"><option value="all">All Status</option><option value="published">Published</option><option value="pending">Pending review</option><option value="draft">Draft</option><option value="rejected">Rejected</option></select>
                                <select value={stockFilter} onChange={(event) => changeFilter(setStockFilter, event.target.value)} className="h-8 rounded-md border border-[#e0e8e2] bg-white px-2 text-[9px] text-[#59695e] outline-none"><option value="all">All Stock</option><option value="low">Low stock (&lt;5)</option><option value="out">Out of stock</option><option value="available">In stock</option></select>
                            </div>
                            <label className="flex h-8 items-center gap-1.5 self-start rounded-md border border-[#e0e8e2] px-2 text-[9px] text-[#59695e] xl:self-auto">Sort by:
                                <select value={sortOrder} onChange={(event) => changeFilter(setSortOrder, event.target.value as ProductSort)} className="bg-transparent font-semibold outline-none"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price">Price</option><option value="stock">Stock</option><option value="name">Product name</option></select><ChevronDown size={11} />
                            </label>
                        </div>
                        <div className="mt-2 overflow-x-auto rounded-md border border-[#edf1ee]">
                            <table className="w-full min-w-240 border-collapse text-[9px]">
                                <thead className="bg-[#f7faf8] text-[#63746a]"><tr>
                                    <th className="px-2 py-2 text-left font-semibold">Image</th><th className="px-2 py-2 text-left font-semibold">Product Name</th><th className="px-2 py-2 text-left font-semibold">SKU</th><th className="px-2 py-2 text-left font-semibold">Brand</th><th className="px-2 py-2 text-left font-semibold">Category</th><th className="px-2 py-2 text-left font-semibold">Variant</th><th className="px-2 py-2 text-left font-semibold">Price</th><th className="px-2 py-2 text-center font-semibold">Stock</th><th className="px-2 py-2 text-center font-semibold">Status</th><th className="px-2 py-2 text-right font-semibold">Actions</th>
                                </tr></thead>
                                <tbody>
                                    {visibleProducts.map((product) => {
                                        const image = product.images?.find((item) => item.is_primary) ?? product.images?.[0];
                                        const active = product.id === selectedProduct?.id;
                                        const variants = product.variants ?? [];
                                        const variantNames = variants.length ? variants.map((variant) => variant.name) : (product.product_options ?? '').split(/\n|;/).flatMap((group) => group.slice(group.indexOf(':') + 1).split(',')).map((name) => name.trim()).filter(Boolean);
                                        return <tr key={product.id} className={`border-t border-[#edf1ee] hover:bg-[#f9fcfa] ${active ? 'bg-[#f8fcf9]' : ''}`}>
                                            <td className="px-2 py-2">{image ? <img src={`/storage/${image.path}`} alt={product.name} className="h-10 w-10 rounded-md border border-[#e4ebe6] object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f4f8f5] text-[#789080]"><ImagePlus size={15} /></span>}</td>
                                            <td className="max-w-32 px-2 py-2"><span className="block truncate font-semibold text-[#263c30]">{product.name}</span><span className="mt-0.5 block text-[8px] text-[#89948d]">{product.model ?? ''}</span></td>
                                            <td className="max-w-32 px-2 py-2 text-[#748178]"><span className="block truncate">{product.sku}</span></td>
                                            <td className="px-2 py-2 text-[#65746b]">{product.brand || '—'}</td>
                                            <td className="px-2 py-2 text-[#65746b]">{product.category?.name ?? '—'}</td>
                                            <td className="max-w-28 px-2 py-2 text-[#65746b]"><span className="line-clamp-2">{variantNames.slice(0, 3).join(', ') || '—'}</span><span className="text-[8px] text-[#278653]">+{Math.max(variantNames.length - 3, 0)} more</span></td>
                                            <td className="whitespace-nowrap px-2 py-2 font-medium text-[#34473b]">{formatMoney(product.sale_price || product.base_price)}{product.sale_price && <span className="block text-[8px] text-[#89948d] line-through">{formatMoney(product.base_price)}</span>}</td>
                                            <td className={`px-2 py-2 text-center font-medium ${product.stock_quantity < 5 ? 'text-[#ad751b]' : 'text-[#526157]'}`}>{product.stock_quantity}</td>
                                            <td className="px-2 py-2 text-center"><ProductStatusBadge status={product.status} /></td>
                                            <td className="px-2 py-2"><div className="flex justify-end gap-1">
                                                <button type="button" title="View product" aria-label={`View ${product.name}`} onClick={() => { setViewProductId(product.id); document.getElementById('product-details')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dfe7e1] text-[#40805a] hover:bg-[#f2f8f4]"><Eye size={12} /></button>
                                                <button type="button" title="Edit product" aria-label={`Edit ${product.name}`} onClick={() => openModal(product)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#dfe7e1] text-[#40805a] hover:bg-[#f2f8f4]"><Pencil size={12} /></button>
                                                <button type="button" title="Delete product" aria-label={`Delete ${product.name}`} onClick={() => setPendingDelete(product)} className="flex h-7 w-7 items-center justify-center rounded-md border border-[#f0dddd] text-[#bf4b4b] hover:bg-[#fff5f5]"><Trash2 size={12} /></button>
                                            </div></td>
                                        </tr>;
                                    })}
                                    {visibleProducts.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-[10px] text-[#748178]">{products.length ? 'No products match these filters.' : 'No products yet. Add your first product to get started.'}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-2 flex flex-col gap-2 text-[8px] text-[#748178] sm:flex-row sm:items-center sm:justify-between">
                            <span>Showing {matchingProducts.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, matchingProducts.length)} of {matchingProducts.length} products</span>
                            <div className="flex items-center gap-1.5 self-end sm:self-auto"><button type="button" disabled={page <= 1} onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} className="rounded border border-[#dfe7e1] px-2 py-1 disabled:opacity-40">Previous</button><span className="rounded bg-[#19864b] px-2 py-1 font-semibold text-white">{page}</span><button type="button" disabled={page >= pageCount} onClick={() => setCurrentPage((value) => Math.min(pageCount, value + 1))} className="rounded border border-[#dfe7e1] px-2 py-1 disabled:opacity-40">Next</button></div>
                        </div>
                    </section>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(190px,0.7fr)]">
                        <section id="product-details" className="min-w-0 scroll-mt-20 bg-white p-3">
                            <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f5ec] text-[#28784a]"><Package size={13} /></span><div><h2 className="text-[10px] font-bold text-[#25372c]">Product Details</h2><p className="text-[8px] text-[#7d8b82]">Selected product</p></div></div>
                            {selectedProduct ? <div className="flex gap-3">
                                {(() => { const image = selectedProduct.images?.find((entry) => entry.is_primary) ?? selectedProduct.images?.[0]; return image ? <img src={`/storage/${image.path}`} alt={selectedProduct.name} className="h-16 w-16 shrink-0 rounded-md bg-[#f4f8f5] object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[#f4f8f5] text-[#789080]"><ImagePlus size={18} /></span>; })()}
                                <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[8px]"><dt className="text-[#89948d]">Product</dt><dd className="truncate font-semibold text-[#34473b]">{selectedProduct.name}</dd><dt className="text-[#89948d]">Product ID</dt><dd className="truncate text-[#526157]">{selectedProduct.id}</dd><dt className="text-[#89948d]">Slug</dt><dd className="truncate text-[#526157]">{selectedProduct.slug ?? '—'}</dd><dt className="text-[#89948d]">SKU</dt><dd className="truncate text-[#526157]">{selectedProduct.sku}</dd><dt className="text-[#89948d]">Category</dt><dd className="truncate text-[#526157]">{selectedProduct.category?.name ?? '—'}</dd><dt className="text-[#89948d]">Status</dt><dd><ProductStatusBadge status={selectedProduct.status} /></dd></dl>
                            </div> : <p className="py-6 text-center text-[9px] text-[#748178]">Select a product to see details.</p>}
                        </section>
                        <section className="min-w-0 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">Stock Overview</h2><p className="text-[8px] text-[#7d8b82]">{selectedProduct?.name ?? 'Product variants'}</p></div><Layers3 size={14} className="text-[#40805a]" /></div>
                            {selectedProduct?.variants?.length ? <div className="overflow-x-auto"><table className="w-full min-w-64 text-left text-[8px]"><thead className="text-[#849188]"><tr><th className="py-1.5 font-medium">Variant</th><th className="py-1.5 font-medium">SKU</th><th className="py-1.5 text-right font-medium">Price</th><th className="py-1.5 text-right font-medium">Stock</th><th className="py-1.5 text-right font-medium">Status</th></tr></thead><tbody>{selectedProduct.variants.slice(0, 5).map((variant) => <tr key={variant.id} className="border-t border-[#edf1ee]"><td className="py-1.5 text-[#526157]">{variant.name}</td><td className="py-1.5 text-[#89948d]">{variant.sku}</td><td className="py-1.5 text-right">{formatMoney(variant.price)}</td><td className="py-1.5 text-right">{variant.stock_quantity}</td><td className="py-1.5 text-right text-[#278653]">{variant.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div> : <p className="py-4 text-center text-[9px] text-[#748178]">No variant stock information.</p>}
                        </section>
                        <section className="bg-white p-3">
                            <div className="mb-2 flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">Quick Actions</h2><p className="text-[8px] text-[#7d8b82]">Common product tasks</p></div><Package size={14} className="text-[#40805a]" /></div>
                            <div className="grid gap-1.5"><button type="button" onClick={() => openModal()} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#19864b] text-[9px] font-semibold text-white hover:bg-[#126d39]"><Plus size={11} /> Add product</button><button type="button" onClick={exportProducts} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#d5e3d9] text-[9px] font-semibold text-[#346848] hover:bg-[#f5faf6]"><Download size={11} /> Export product list</button></div>
                        </section>
                    </div>

                    <section>
                        <div className="mb-2"><h2 className="text-xs font-bold text-[#25372c]">Product Insights</h2><p className="mt-0.5 text-[9px] text-[#7d8b82]">Inventory and product performance indicators</p></div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                            <ProductInsight label="Product Views" value={monitoring.views.toLocaleString()} detail="All-time detail page views" change={monitoring.viewsChange} icon={Eye} points={[2, 4, 3, 7, 5, 8, 11]} />
                            <ProductInsight label="Product Sales" value={monitoring.sales.toLocaleString()} detail="Units sold" change={monitoring.salesChange} icon={ShoppingBag} points={[3, 5, 4, 7, 6, 10, 12]} />
                            <ProductInsight label="Inventory Value" value={formatMoney(monitoring.inventoryValue)} detail="Current stock at listed price" change={0} icon={CircleDollarSign} points={[5, 5, 6, 6, 6, 7, 7]} />
                            <ProductInsight label="Low Stock Alerts" value={String(monitoring.lowStock)} detail="Products below 5 units" change={0} icon={AlertTriangle} points={[8, 7, 7, 6, 5, 5, 4]} />
                            <ProductInsight label="Conversion Rate" value={`${monitoring.conversionRate}%`} detail="Units sold per product view" change={0} icon={TrendingUp} points={[3, 4, 4, 5, 6, 6, 7]} />
                            <ProductInsight label="Pending Reviews" value={String(monitoring.pendingReview)} detail="Awaiting admin review" change={0} icon={FileText} points={[2, 2, 3, 3, 4, 3, 3]} />
                        </div>
                    </section>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <ProductTrendCard title="Product Sales Trend" subtitle="Units sold over time" data={performanceData} dataKey="sales" color="#2a9a5c" icon={ShoppingBag} />
                        <ProductTrendCard title="Product Views Trend" subtitle="Recorded product views" data={performanceData} dataKey="views" color="#56b67d" icon={Eye} />
                        <section className="min-w-0 bg-white p-3 sm:p-4">
                            <div className="flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">Inventory Movement</h2><p className="mt-0.5 text-[8px] text-[#7d8b82]">Units sold and stock remaining</p></div><BarChart3 size={14} className="text-[#40805a]" /></div>
                            <div className="mt-2 h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={performanceData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="#edf1ee" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#dfe7e1' }} minTickGap={20} /><YAxis allowDecimals={false} width={28} tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderColor: '#dce7df', borderRadius: 7, fontSize: 10 }} /><Bar dataKey="sales" name="Stock sold" fill="#7bc9a0" radius={[3, 3, 0, 0]} /><Bar dataKey="stock" name="Stock remaining" fill="#278653" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
                        </section>
                        <section className="min-w-0 bg-white p-3 sm:p-4">
                            <div className="flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">Category Performance</h2><p className="mt-0.5 text-[8px] text-[#7d8b82]">Products and available stock by category</p></div><LineChart size={14} className="text-[#40805a]" /></div>
                            <div className="mt-2 h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryPerformance} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="#edf1ee" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#dfe7e1' }} /><YAxis allowDecimals={false} width={28} tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderColor: '#dce7df', borderRadius: 7, fontSize: 10 }} /><Bar dataKey="products" name="Products" fill="#36a568" radius={[3, 3, 0, 0]} /><Bar dataKey="stock" name="Available stock" fill="#add9bd" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
                        </section>
                        <section className="bg-white p-3 sm:p-4 lg:col-span-2">
                            <div className="flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">Low Stock Monitoring</h2><p className="mt-0.5 text-[8px] text-[#7d8b82]">Products approaching or below the 5-unit stock threshold</p></div><TriangleAlert size={14} className="text-[#c58b2b]" /></div>
                            {lowStockProducts.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{lowStockProducts.map((product) => <div key={product.id} className="flex min-w-0 items-center gap-2 rounded-md border border-[#edf1ee] p-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#fff5e4] text-[#ad751b]"><Box size={14} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-[#34473b]">{product.name}</strong><span className="text-[8px] text-[#89948d]">{product.stock_quantity} in stock</span></span><button type="button" onClick={() => openModal(product)} className="text-[8px] font-semibold text-[#278653]">Edit</button></div>)}</div> : <p className="mt-3 text-[9px] text-[#748178]">No low-stock products right now.</p>}
                        </section>
                    </div>
                </div>
                {false && <>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 border border-[#dfe3dc] bg-white px-4 py-3 sm:w-80">
                        <Search size={17} className="text-[#657066]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search products"
                            className="w-full bg-transparent text-sm outline-none"
                        />
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-[#1e2420] px-4 py-3 text-sm font-semibold text-white"
                    >
                        <Plus size={17} /> Add product
                    </button>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <StatCard label="Total products" value={String(products.length)} detail="In your catalog" />
                    <StatCard label="Published" value={String(published)} detail="Visible in storefront" tone="green" />
                    <StatCard label="Low stock" value={String(lowStock)} detail="Fewer than 5 units" tone="warm" />
                </div>
                <section className="mt-6 overflow-x-auto border border-[#dfe3dc] bg-white">
                    <div className="table-wrapper">
                        <table className="w-full min-w-225 border-collapse text-[13px]">
                            <thead className="bg-[#f7f7f7]">
                                <tr>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Image</th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">
                                        Product Name
                                    </th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">SKU</th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Brand</th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Category</th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Variant</th>
                                    <th className="border-r border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Price</th>
                                    <th className="border-b border-[#ddd] px-3 py-3 text-left font-semibold whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#edf0eb]">
                                {visibleProducts.map((product) => {
                                    const image = product.images?.find((item) => item.is_primary) ?? product.images?.[0];
                                    const status = displayStatus(product.status);
                                    const price = product.sale_price || product.base_price;
                                    const isExpanded = viewProductId === product.id;
                                    const variantSummary = (product.product_options || '')
                                        .split(/\n|;/)
                                        .map((entry) => entry.trim())
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .join(' • ');
                                    const variantPrices = product.variants ?? [];
                                    const details: [string, string][] = [
                                        ['Product ID', String(product.id)],
                                        ['Slug', product.slug ?? '—'],
                                        ['SKU', product.sku],
                                        ['Barcode', product.barcode ?? '—'],
                                        ['Brand', product.brand ?? '—'],
                                        ['Model', product.model ?? '—'],
                                        ['Category', product.category?.name ?? 'Uncategorized'],
                                        ['Condition', product.condition ?? '—'],
                                        ['Base price', formatMoney(product.base_price)],
                                        ['Sale price', product.sale_price ? formatMoney(product.sale_price) : '—'],
                                        ['Total stock', String(product.stock_quantity)],
                                        ['Selling unit', product.selling_unit ?? '—'],
                                        ['Color', product.color ?? '—'],
                                        ['Size', product.size ?? '—'],
                                        ['Material', product.material ?? '—'],
                                        ['Weight', product.weight ?? '—'],
                                        ['Volume', product.volume ?? '—'],
                                        ['Pack quantity', product.pack_quantity == null ? '—' : String(product.pack_quantity)],
                                        ['Length', product.length ?? '—'],
                                        ['Width', product.width ?? '—'],
                                        ['Height', product.height ?? '—'],
                                        ['Warranty', product.warranty ?? '—'],
                                        ['Country of origin', product.country_of_origin ?? '—'],
                                        ['Currency', product.currency ?? 'PHP'],
                                        ['Status', status],
                                        ['Approved', product.is_approved == null ? '—' : product.is_approved ? 'Yes' : 'No'],
                                        ['Active', product.is_active == null ? '—' : product.is_active ? 'Yes' : 'No'],
                                        ['Authenticity', product.authenticity_status ?? '—'],
                                        ['Verification', product.verification_status ?? '—'],
                                        ['Published at', product.published_at ?? '—'],
                                        ['Created at', product.created_at ?? '—'],
                                        ['Updated at', product.updated_at ?? '—'],
                                        ['Description', product.description ?? '—'],
                                        ['Variant options', product.product_options || 'None'],
                                    ];

                                    return (
                                        <Fragment key={product.id}>
                                            <tr className="align-middle hover:bg-[#fafcfb]">
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        {image ? (
                                                            <img
                                                                src={`/storage/${image.path}`}
                                                                alt={product.name}
                                                                className="h-14 w-14 rounded-[10px] border border-[#dfe5df] object-cover"
                                                            />
                                                        ) : (
                                                            <span className="flex h-14 w-14 items-center justify-center rounded-[10px] border border-[#dfe5df] bg-[#f5f7f5] text-[#8e9b96]">
                                                                <ImagePlus size={18} />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-normal">
                                                    <div className="font-semibold text-[#17352b]">{product.name}</div>
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap text-[#4b5852]">
                                                    {product.sku || '—'}
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap text-[#4b5852]">
                                                    {product.brand ?? '—'}
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap text-[#4b5852]">
                                                    {product.category?.name ?? 'Uncategorized'}
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-normal text-[#4b5852]">
                                                    {variantSummary || 'No variants'}
                                                </td>
                                                <td className="border-r border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap text-[#17352b]">
                                                    <div className="font-semibold">{formatMoney(price)}</div>
                                                    <div className="mt-1 text-[11px] text-[#6b796f]">
                                                        {product.sale_price ? `Was ${formatMoney(product.base_price)}` : 'Regular price'}
                                                    </div>
                                                    {variantPrices.length > 0 && (
                                                        <div className="mt-2 space-y-0.5 text-[10px] text-[#52665a]">
                                                            {variantPrices.slice(0, 3).map((variant) => (
                                                                <div key={variant.id} className="max-w-40 truncate">
                                                                    {variant.name}:{' '}
                                                                    <span className="font-semibold text-[#176b3c]">{formatMoney(variant.price)}</span>
                                                                </div>
                                                            ))}
                                                            {variantPrices.length > 3 && (
                                                                <div className="font-semibold text-[#176b3c]">
                                                                    +{variantPrices.length - 3} more prices
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border-b border-[#eee] px-3 py-3 align-middle whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewProductId(isExpanded ? null : product.id)}
                                                            className="rounded-[7px] border border-[#dfe4e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1d2d26] hover:bg-[#f3f6f4]"
                                                        >
                                                            <Eye size={12} className="mr-1 inline" /> {isExpanded ? 'Hide' : 'View'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openModal(product)}
                                                            className="rounded-[7px] border border-[#dfe4e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1d2d26] hover:bg-[#f3f6f4]"
                                                        >
                                                            <Pencil size={12} className="mr-1 inline" /> Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                window.confirm(`Delete ${product.name}?`) &&
                                                                form.delete(route('seller.products.destroy', product.id), { preserveScroll: true })
                                                            }
                                                            className="rounded-[7px] border border-[#dfe4e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#b00020] hover:bg-[#fff2f4]"
                                                        >
                                                            <Trash2 size={12} className="mr-1 inline" /> Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${product.id}-details`} className="bg-[#fafcfb]">
                                                    <td colSpan={8} className="border-b border-[#eee] px-3 py-4">
                                                        <h3 className="mb-3 text-sm font-semibold text-[#17352b]">Full product details</h3>
                                                        <div className="overflow-x-auto border border-[#e3e8e4] bg-white">
                                                            <table className="w-full min-w-170 border-collapse text-left text-xs">
                                                                <tbody>
                                                                    {Array.from({ length: Math.ceil(details.length / 2) }, (_, rowIndex) => {
                                                                        const first = details[rowIndex * 2];
                                                                        const second = details[rowIndex * 2 + 1];

                                                                        return (
                                                                            <tr
                                                                                key={`${product.id}-detail-${rowIndex}`}
                                                                                className="border-b border-[#edf0ee] last:border-b-0"
                                                                            >
                                                                                <th className="w-[16%] bg-[#f7f9f7] px-3 py-2 text-left font-semibold text-[#657066]">
                                                                                    {first[0]}
                                                                                </th>
                                                                                <td className="w-[34%] px-3 py-2 wrap-break-word text-[#27352e]">
                                                                                    {first[1]}
                                                                                </td>
                                                                                {second ? (
                                                                                    <>
                                                                                        <th className="w-[16%] bg-[#f7f9f7] px-3 py-2 text-left font-semibold text-[#657066]">
                                                                                            {second[0]}
                                                                                        </th>
                                                                                        <td className="w-[34%] px-3 py-2 wrap-break-word text-[#27352e]">
                                                                                            {second[1]}
                                                                                        </td>
                                                                                    </>
                                                                                ) : (
                                                                                    <td colSpan={2} />
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        {product.images?.length ? (
                                                            <div className="mt-4">
                                                                <h4 className="mb-2 text-xs font-semibold text-[#17352b]">Product images</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {product.images.map((item) => (
                                                                        <img
                                                                            key={item.path}
                                                                            src={`/storage/${item.path}`}
                                                                            alt={product.name}
                                                                            className="h-16 w-16 rounded border border-[#dfe5df] object-cover"
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                        {product.short_video_path && (
                                                            <div className="mt-3 text-xs text-[#4b5852]">
                                                                Product video:{' '}
                                                                <a
                                                                    className="underline"
                                                                    href={`/storage/${product.short_video_path}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    Open video
                                                                </a>
                                                            </div>
                                                        )}
                                                        {product.variants?.length ? (
                                                            <div className="mt-4">
                                                                <h4 className="mb-2 text-xs font-semibold text-[#17352b]">Variant inventory</h4>
                                                                <div className="overflow-x-auto border border-[#e3e8e4] bg-white">
                                                                    <table className="w-full min-w-155 border-collapse text-left text-xs">
                                                                        <thead className="bg-[#f7f9f7] text-[#657066]">
                                                                            <tr>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">Variant</th>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">SKU</th>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">Options</th>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">Price</th>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">Stock</th>
                                                                                <th className="border-b border-[#e3e8e4] px-3 py-2">Status</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {product.variants.map((variant) => (
                                                                                <tr
                                                                                    key={variant.id}
                                                                                    className="border-b border-[#edf0ee] last:border-b-0"
                                                                                >
                                                                                    <td className="px-3 py-2 text-[#27352e]">{variant.name}</td>
                                                                                    <td className="px-3 py-2 text-[#4b5852]">{variant.sku}</td>
                                                                                    <td className="px-3 py-2 text-[#4b5852]">
                                                                                        {variant.option_values
                                                                                            ?.map((assignment) => {
                                                                                                const optionValue = assignment.option_value;
                                                                                                return optionValue
                                                                                                    ? `${optionValue.option?.name ?? 'Option'}: ${optionValue.value}`
                                                                                                    : null;
                                                                                            })
                                                                                            .filter(Boolean)
                                                                                            .join(' • ') || '—'}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-[#27352e]">
                                                                                        {formatMoney(variant.price)}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-[#27352e]">
                                                                                        {variant.stock_quantity}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-[#4b5852]">
                                                                                        {variant.is_active ? 'Active' : 'Inactive'}
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                {visibleProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-12 text-center text-sm text-[#657066]">
                                            {search ? 'No products match your search.' : 'No products yet. Add your first product to get started.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
                </>}
                {open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122219]/40 p-3 sm:p-6">
                        <div className="relative w-full max-w-230 overflow-hidden rounded-[18px] border border-[#d8ddd8] bg-white shadow-[0_30px_80px_rgba(17,35,26,0.14)]">
                            <div className="flex items-center justify-between border-b border-[#edf0ee] px-5 py-4 sm:px-6">
                                <h2 className="font-serif text-[28px] font-semibold tracking-[-0.03em] text-[#18362d]">New product</h2>
                                <button type="button" onClick={closeModal} className="text-3xl leading-none text-[#3d4b46]">
                                    ×
                                </button>
                            </div>

                            <div className="max-h-[82vh] overflow-y-auto bg-[#f8faf8] p-5 sm:p-6">
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 sm:p-5">
                                        <label className="block text-sm font-semibold text-[#17352b]">
                                            Product Images <span className="text-[#d9485f]">*</span>
                                        </label>
                                        <label className="mt-3 flex min-h-42.5 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfd8d3] bg-[#fbfcfb] px-6 py-5 text-center transition hover:border-[#168c4d] hover:bg-[#f4fbf6]">
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                multiple
                                                onChange={(event) => previewImages(event.target.files)}
                                                className="hidden"
                                            />
                                            <div className="mb-2 rounded-full bg-[#edf7f0] p-3 text-[#168c4d]">
                                                <ImagePlus size={18} />
                                            </div>
                                            <div className="text-lg font-semibold text-[#17352b]">Upload Product Images</div>
                                            <div className="mt-1 text-sm text-[#66756f]">
                                                Select multiple images. The first image will be the primary image.
                                            </div>
                                        </label>
                                        {imageError && <div className="mt-3 text-xs text-[#a13b32]">{imageError}</div>}
                                        {editing && existingImages.length > 0 && (
                                            <div className="mt-4">
                                                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                                                    <span className="text-xs font-semibold text-[#17352b]">Current images</span>
                                                    <span className="text-[11px] text-[#66756f]">Uploading new images replaces these.</span>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {existingImages.map((image) => (
                                                        <div key={image.path} className="relative">
                                                            <img
                                                                src={`/storage/${image.path}`}
                                                                alt={`${editing.name} current image`}
                                                                className="h-20 w-20 rounded-[10px] border border-[#dfe3dc] object-cover"
                                                            />
                                                            {image.is_primary && (
                                                                <span className="absolute top-1 left-1 rounded-full bg-[#168c4d] px-2 py-0.5 text-[9px] font-semibold text-white">
                                                                    Primary
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {form.data.images.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                {form.data.images.map((file, index) => (
                                                    <div key={`${file.name}-${index}`} className="relative">
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            alt={file.name}
                                                            className="h-20 w-20 rounded-[10px] border border-[#dfe3dc] object-cover"
                                                        />
                                                        <span
                                                            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-semibold ${index === 0 ? 'bg-[#168c4d] text-white' : 'bg-[#edf8f1] text-[#0d6f3c]'}`}
                                                        >
                                                            {index === 0 ? 'Primary' : 'Image'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const next = form.data.images.filter((_, itemIndex) => itemIndex !== index);
                                                                form.setData('images', next);
                                                                form.setData('image', next[0] ?? null);
                                                            }}
                                                            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#171717] text-[10px] text-white"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 sm:p-5">
                                        <label className="block text-sm font-semibold text-[#17352b]">
                                            Product Video <span className="text-[#6d7a73]">Optional</span>
                                        </label>
                                        <label className="mt-3 flex min-h-32.5 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cfd8d3] bg-[#fbfcfb] px-6 py-5 text-center transition hover:border-[#168c4d] hover:bg-[#f4fbf6]">
                                            <input
                                                type="file"
                                                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/3gpp,video/m4v"
                                                onChange={(event) => previewVideo(event.target.files?.[0] ?? null)}
                                                className="hidden"
                                            />
                                            <div className="mb-2 rounded-full bg-[#edf7f0] p-3 text-[#168c4d]">
                                                <Plus size={18} />
                                            </div>
                                            <div className="text-lg font-semibold text-[#17352b]">Upload Short Product Video</div>
                                            <div className="mt-1 text-sm text-[#66756f]">Maximum 60 seconds and 50 MB.</div>
                                        </label>
                                        {form.data.product_video && (
                                            <div className="mt-4">
                                                <video
                                                    src={URL.createObjectURL(form.data.product_video)}
                                                    controls
                                                    className="h-28 w-full rounded-[10px] border object-cover"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 sm:p-5">
                                        <div className="mb-4 text-sm font-semibold tracking-[0.08em] text-[#5c6b62] uppercase">
                                            Product Information
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                <span className="flex items-center gap-2">
                                                    Product name <span className="text-[#d9485f]">*</span>
                                                </span>
                                                <input
                                                    value={form.data.name}
                                                    onChange={(event) => form.setData('name', event.target.value)}
                                                    placeholder="Premium Rice (Local)"
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                />
                                            </label>
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                <span className="flex items-center gap-2">
                                                    Brand
                                                </span>
                                                <input
                                                    value={form.data.brand}
                                                    onChange={(event) => form.setData('brand', event.target.value)}
                                                    placeholder="e.g. Northline"
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                />
                                            </label>
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                <span className="flex items-center gap-2">
                                                    Product category <span className="text-[#d9485f]">*</span>
                                                </span>
                                                <select
                                                    value={form.data.category_id}
                                                    onChange={(event) => adaptProduct(event.target.value)}
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                >
                                                    <option value="">Select category</option>
                                                    {categories.map((category) => (
                                                        <option key={category.id} value={category.id}>
                                                            {category.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>

                                        <label className="mt-4 block text-sm font-semibold text-[#17352b]">
                                            <span className="flex items-center gap-2">
                                                Description
                                            </span>
                                            <textarea
                                                value={form.data.description}
                                                onChange={(event) => form.setData('description', event.target.value)}
                                                placeholder="Describe your product in detail"
                                                className="mt-2 min-h-27.5 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                            />
                                        </label>
                                    </div>

                                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 sm:p-5">
                                        <div className="mb-4 text-sm font-semibold tracking-[0.08em] text-[#5c6b62] uppercase">
                                            Pricing & Inventory
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                Selling price (₱) <span className="text-[#d9485f]">*</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={form.data.base_price}
                                                    onChange={(event) => form.setData('base_price', event.target.value)}
                                                    placeholder="0.00"
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                />
                                            </label>
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                Regular price (₱)
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={form.data.sale_price}
                                                    onChange={(event) => form.setData('sale_price', event.target.value)}
                                                    placeholder="0.00"
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                />
                                            </label>
                                            <label className="block text-sm font-semibold text-[#17352b]">
                                                Total stock <span className="text-[#d9485f]">*</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={String(allocatedStockTotal)}
                                                    readOnly
                                                    placeholder="0"
                                                    className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none read-only:bg-[#f4f6f4] focus:border-[#168c4d]"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-[#dfe6e2] bg-white p-4 sm:p-5">
                                        <div className="mb-4 text-sm font-semibold tracking-[0.08em] text-[#5c6b62] uppercase">Product Variants</div>
                                        {variantGroups.map((group, groupIndex) => (
                                            <div key={group.id} className="mb-5 rounded-xl border border-[#e4e8e5] bg-[#fafcfb] p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-semibold tracking-[0.08em] text-[#5c6b62] uppercase">
                                                            Variant Type
                                                        </label>
                                                        <select
                                                            value={group.type}
                                                            onChange={(event) => changeVariantType(group.id, event.target.value)}
                                                            className="mt-2 w-full rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                        >
                                                            {[...new Set([...variantTypeOptions, group.type])].map((option) => (
                                                                <option key={option} value={option}>
                                                                    {option}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeVariantGroup(group.id)}
                                                        className="mt-7 inline-flex items-center justify-center rounded-[8px] border border-[#dfe4e1] bg-white p-2 text-[#3d4b46]"
                                                        aria-label="Delete variant type"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>

                                                <div className="mt-4">
                                                    <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-[#5c6b62] uppercase">
                                                        Variant Values
                                                    </div>
                                                    <div className="space-y-2">
                                                        {group.values.map((value) => (
                                                            <div key={value.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                                                <input
                                                                    value={value.value}
                                                                    onChange={(event) => {
                                                                        setVariantLocked(true);
                                                                        setVariantGroups((current) =>
                                                                            current.map((item) =>
                                                                                item.id === group.id
                                                                                    ? {
                                                                                          ...item,
                                                                                          values: item.values.map((entry) =>
                                                                                              entry.id === value.id
                                                                                                  ? { ...entry, value: event.target.value }
                                                                                                  : entry,
                                                                                          ),
                                                                                      }
                                                                                    : item,
                                                                            ),
                                                                        );
                                                                    }}
                                                                    placeholder={group.type}
                                                                    className="rounded-[10px] border border-[#d7ddd9] bg-white px-3 py-2.5 text-sm text-[#17352b] transition outline-none focus:border-[#168c4d]"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeVariantValue(group.id, value.id)}
                                                                    className="flex h-10.5 w-10.5 items-center justify-center rounded-[10px] border border-[#dfe4e1] bg-white text-[#3d4b46]"
                                                                    aria-label="Delete value"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => addVariantValue(group.id)}
                                                        className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-[#dfe4e1] bg-white px-3 py-2 text-sm font-semibold text-[#17352b]"
                                                    >
                                                        <Plus size={14} /> Add value
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={addVariantGroup}
                                            className="mt-2 inline-flex items-center gap-2 rounded-[8px] border border-[#dfe4e1] bg-white px-3 py-2 text-sm font-semibold text-[#17352b]"
                                        >
                                            <Plus size={14} /> Add variant type
                                        </button>
                                        {variantCombinations.length > 0 && (
                                            <div className="mt-5 border-t border-[#e7ebe8] pt-4">
                                                <div className="mb-3">
                                                    <div className="text-sm font-semibold text-[#17352b]">Variant price & inventory</div>
                                                    <p className="mt-1 text-xs text-[#66756f]">
                                                        Set a price and stock for every variant. Product total stock is calculated from these
                                                        quantities.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    {variantCombinations.map((combination) => (
                                                        <div
                                                            key={combination.key}
                                                            className="grid gap-2 rounded-[8px] border border-[#e4e8e5] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_130px_110px] sm:items-center"
                                                        >
                                                            <span className="min-w-0 text-sm font-medium text-[#3d4b46]">{combination.label}</span>
                                                            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#65766a]">
                                                                <span>Price ₱</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={variantPrices[combination.key] ?? ''}
                                                                    onChange={(event) =>
                                                                        setVariantPrices((current) => ({
                                                                            ...current,
                                                                            [combination.key]: event.target.value,
                                                                        }))
                                                                    }
                                                                    aria-label={`Price for ${combination.label}`}
                                                                    placeholder={form.data.sale_price || form.data.base_price || '0.00'}
                                                                    className="w-full min-w-0 rounded-[8px] border border-[#d7ddd9] bg-white px-2.5 py-2 text-sm text-[#17352b] outline-none focus:border-[#168c4d]"
                                                                />
                                                            </label>
                                                            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#65766a]">
                                                                <span>Stock</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="1"
                                                                    value={variantStocks[combination.key] ?? ''}
                                                                    onChange={(event) =>
                                                                        setVariantStocks((current) => ({
                                                                            ...current,
                                                                            [combination.key]: event.target.value,
                                                                        }))
                                                                    }
                                                                    aria-label={`Stock for ${combination.label}`}
                                                                    placeholder="0"
                                                                    className="w-full min-w-0 rounded-[8px] border border-[#d7ddd9] bg-white px-2.5 py-2 text-sm text-[#17352b] outline-none focus:border-[#168c4d]"
                                                                />
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                                {form.errors.variant_prices && (
                                                    <p className="mt-2 text-xs font-medium text-[#a13b32]">{form.errors.variant_prices}</p>
                                                )}
                                                {form.errors.variant_stocks && (
                                                    <p className="mt-2 text-xs font-medium text-[#a13b32]">{form.errors.variant_stocks}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-[#edf0ee] bg-white px-5 py-4 sm:px-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-[10px] border border-[#d7ddd9] bg-white px-4 py-2.5 text-sm font-semibold text-[#17352b]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={saveProduct}
                                    className="rounded-[10px] bg-[#0d6f3c] px-4 py-2.5 text-sm font-semibold text-white"
                                >
                                    Save product
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </PortalLayout>
            {pendingDelete && (
                <div className="fixed inset-0 z-70 flex items-center justify-center bg-[#122219]/35 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
                    <div className="w-full max-w-sm rounded-xl border border-[#e3e9e5] bg-white p-5 shadow-xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1d7] text-[#a56a12]"><AlertTriangle size={18} /></span>
                        <h2 id="delete-product-title" className="mt-3 text-base font-bold text-[#26382d]">Delete product?</h2>
                        <p className="mt-1 text-xs leading-5 text-[#758179]">Are you sure you want to delete {pendingDelete.name}?</p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border border-[#dce5df] px-3 py-2 text-xs font-semibold text-[#526157]">Cancel</button>
                            <button type="button" disabled={form.processing} onClick={() => form.delete(route('seller.products.destroy', pendingDelete.id), { preserveScroll: true, onSuccess: () => setPendingDelete(null) })} className="rounded-lg bg-[#a64848] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Delete product</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function ProductMetric({ label, value, change, icon: Icon, warning = false }: { label: string; value: number; change: number; icon: typeof Package; warning?: boolean }) {
    const changeTone = warning ? 'text-[#d6584f]' : change < 0 ? 'text-[#d6584f]' : 'text-[#21834b]';
    const points = warning ? '0,19 10,18 19,15 29,16 39,10 49,12 60,7 72,3' : '0,21 10,18 20,19 30,12 40,14 50,8 60,10 72,2';
    return (
        <div className="relative overflow-hidden bg-white p-3 sm:p-3.5">
            <div className="flex items-start gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${warning ? 'bg-[#fff5e4] text-[#b27b23]' : 'bg-[#e8f5ec] text-[#28784a]'}`}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-medium text-[#748178]">{label}</p>
                    <p className="mt-0.5 text-xl font-bold leading-6 text-[#1d3426]">{value.toLocaleString()}</p>
                    <p className={`mt-1 text-[8px] font-medium ${changeTone}`}>{change < 0 ? '↓' : '↑'} {Math.abs(change).toFixed(1)}% <span className="font-normal text-[#829087]">this month</span></p>
                </div>
                <svg viewBox="0 0 72 24" className="mt-auto h-7 w-16 shrink-0 self-end" aria-label={`${label} trend`}><polyline points={points} fill="none" stroke={warning ? '#dca944' : '#38a567'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
        </div>
    );
}

function ProductLegend({ items }: { items: Array<[string, string]> }) {
    return <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">{items.map(([label, color]) => <span key={label} className="inline-flex items-center gap-1 text-[8px] text-[#748178]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>;
}

function ProductStatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();
    const style = normalized === 'published' || normalized === 'active'
        ? 'bg-[#def3e5] text-[#267748]'
        : normalized === 'pending'
            ? 'bg-[#fff1d7] text-[#a56a12]'
            : normalized === 'rejected'
                ? 'bg-[#fae7e6] text-[#a64848]'
                : 'bg-[#edf2ef] text-[#64736a]';
    return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-semibold ${style}`}>{displayStatus(normalized)}</span>;
}

function ProductInsight({ label, value, detail, change, icon: Icon, points }: { label: string; value: string; detail: string; change: number; icon: typeof Package; points: number[] }) {
    const polyline = points.map((point, index) => `${(index / (points.length - 1)) * 62},${20 - point}`).join(' ');
    return (
        <div className="min-w-0 bg-white p-2.5">
            <div className="flex items-center justify-between gap-1"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f5ec] text-[#28784a]"><Icon size={13} /></span><span className={`text-[8px] font-semibold ${change < 0 ? 'text-[#c74c48]' : 'text-[#278653]'}`}>{change > 0 ? '↑' : change < 0 ? '↓' : '—'} {Math.abs(change).toFixed(1)}%</span></div>
            <p className="mt-2 truncate text-[8px] text-[#748178]">{label}</p>
            <div className="mt-0.5 flex items-end justify-between gap-1"><strong className="truncate text-sm font-bold text-[#1d3426]">{value}</strong><svg viewBox="0 0 64 22" className="h-5 w-14 shrink-0" aria-label={`${label} trend`}><polyline points={polyline} fill="none" stroke="#38a567" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <p className="mt-1 truncate text-[7px] text-[#89948d]">{detail}</p>
        </div>
    );
}

function ProductTrendCard({ title, subtitle, data, dataKey, color, icon: Icon }: { title: string; subtitle: string; data: ProductMonitoring['dailyPerformance']; dataKey: 'views' | 'sales'; color: string; icon: typeof Package }) {
    return (
        <section className="min-w-0 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between"><div><h2 className="text-[10px] font-bold text-[#25372c]">{title}</h2><p className="mt-0.5 text-[8px] text-[#7d8b82]">{subtitle}</p></div><Icon size={14} className="text-[#40805a]" /></div>
            <div className="mt-2 h-36"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}><CartesianGrid stroke="#edf1ee" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#dfe7e1' }} minTickGap={20} /><YAxis allowDecimals={false} width={28} tick={{ fill: '#819087', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ borderColor: '#dce7df', borderRadius: 7, fontSize: 10 }} /><Line type="monotone" dataKey={dataKey} name={title.replace(' Trend', '')} stroke={color} strokeWidth={1.8} dot={false} /></RechartsLineChart></ResponsiveContainer></div>
        </section>
    );
}

function Field({
    label,
    type = 'text',
    value,
    error,
    onChange,
}: {
    label: string;
    type?: string;
    value: string;
    error?: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="grid gap-2 text-sm font-semibold">
            <span>{label}</span>
            <input
                required={label !== 'Sale price'}
                type={type}
                min={type === 'number' ? '0' : undefined}
                step={label === 'Stock quantity' ? '1' : type === 'number' ? '0.01' : undefined}
                value={value}
                placeholder={fieldPlaceholder(label)}
                onChange={(event) => onChange(event.target.value)}
                className="border px-3 py-2.5 font-normal"
            />
            {error && <span className="text-xs text-[#a23b2d]">{error}</span>}
        </label>
    );
}

function fieldPlaceholder(label: string): string {
    const placeholders: Record<string, string> = {
        Name: 'e.g. Classic Cotton T-Shirt',
        Brand: 'e.g. Northline',
        Model: 'e.g. Classic 2026',
        'Base price': 'e.g. 499.00',
        'Sale price': 'e.g. 399.00 (optional)',
        'Stock quantity': 'e.g. 100',
        Color: 'e.g. Navy blue (optional)',
        Size: 'e.g. Medium (optional)',
        Material: 'e.g. 100% cotton (optional)',
        Weight: 'e.g. 250 g (optional)',
        Volume: 'e.g. 500 ml (optional)',
        'Pack quantity': 'e.g. 1',
        Length: 'e.g. 30 cm (optional)',
        Width: 'e.g. 25 cm (optional)',
        Height: 'e.g. 5 cm (optional)',
        Warranty: 'e.g. 6 months (optional)',
        'Country of origin': 'e.g. Philippines (optional)',
    };

    return placeholders[label] ?? `Enter ${label.toLowerCase()}`;
}
