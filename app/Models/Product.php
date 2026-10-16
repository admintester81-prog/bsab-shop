<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use SoftDeletes;

    public function scopePublished($query)
    {
        return $query->where('status', 'published')
            ->where('is_approved', true);
    }

    protected $fillable = [
        'shop_id',
        'seller_id',
        'category_id',
        'name',
        'slug',
        'description',
        'short_video_path',
        'condition',
        'authenticity_status',
        'verification_status',
        'base_price',
        'currency',
        'sale_price',
        'sku',
        'brand',
        'model',
        'selling_unit',
        'barcode',
        'color',
        'size',
        'material',
        'weight',
        'volume',
        'pack_quantity',
        'length',
        'width',
        'height',
        'warranty',
        'country_of_origin',
        'stock_quantity',
        'published_at',
        'status',
        'is_approved',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'is_approved' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function sellerProfile()
    {
        return $this->belongsTo(Shop::class, 'seller_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function vouchers()
    {
        return $this->belongsToMany(Voucher::class, 'voucher_products')->withTimestamps();
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function wishlists()
    {
        return $this->hasMany(Wishlist::class);
    }

    public function options()
    {
        return $this->hasMany(ProductOption::class);
    }

    public function optionValues()
    {
        return $this->hasManyThrough(ProductOptionValue::class, ProductOption::class);
    }

    public function views()
    {
        return $this->hasMany(ProductView::class);
    }

    public function metrics()
    {
        return $this->hasOne(ProductMetric::class);
    }

    public function getProductOptionsAttribute(): string
    {
        $options = $this->relationLoaded('options') ? $this->options : $this->options()->with('values')->get();

        if ($options->isEmpty()) {
            return '';
        }

        return $options
            ->sortBy('sort_order')
            ->map(function (ProductOption $option) {
                $values = $option->relationLoaded('values') ? $option->values : $option->values()->orderBy('sort_order')->get();

                return $option->name.': '.($values->sortBy('sort_order')->pluck('value')->all() ? implode(', ', $values->sortBy('sort_order')->pluck('value')->all()) : '');
            })
            ->implode("\n");
    }
}
