<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

class SharingAgentProductsSeeder extends Seeder
{
    public function run(): void
    {
        $seller = User::updateOrCreate(
            ['email' => 'seller1@gmail.com'],
            [
                'name' => 'SharingAgent',
                'password' => 'Seller1@gmail.com',
                'email_verified_at' => now(),
                'role' => 'seller',
                'status' => 'active',
                'must_change_password' => false,
            ],
        );

        $seller->syncRoles([Role::findOrCreate('seller', 'web')]);

        $shop = Shop::updateOrCreate(
            ['user_id' => $seller->id],
            [
                'name' => 'SharingAgent',
                'slug' => 'sharingagent',
                'description' => 'Sample marketplace shop for the SharingAgent farm and agriculture catalog.',
                'status' => 'approved',
                'commission_rate' => 10,
            ],
        );

        $agriculture = Category::updateOrCreate(
            ['slug' => 'agriculture'],
            ['name' => 'Agriculture', 'slug' => 'agriculture', 'parent_id' => null],
        );

        $catalog = [
            [
                'category' => 'Seeds & Seedlings',
                'option' => 'Pack Size',
                'variants' => ['Small (100 seeds)', 'Medium (500 seeds)', 'Bulk (1,000 seeds)'],
                'products' => [
                    ['Hybrid Tomato Seeds', 'High-germination tomato seeds selected for productive home and commercial gardens.'],
                    ['Sweet Corn Seeds', 'Sweet corn seed for reliable field planting and a flavorful harvest.'],
                ],
            ],
            [
                'category' => 'Fertilizers & Soil',
                'option' => 'Bag Size',
                'variants' => ['5 kg', '10 kg', '25 kg'],
                'products' => [
                    ['Organic Compost', 'Nutrient-rich compost to improve soil structure and support healthy crop growth.'],
                    ['Complete NPK Fertilizer', 'Balanced granular fertilizer for vegetables, fruit crops, and field plants.'],
                ],
            ],
            [
                'category' => 'Crop Protection',
                'option' => 'Bottle Size',
                'variants' => ['250 mL', '500 mL', '1 L'],
                'products' => [
                    ['Neem Oil Concentrate', 'Plant-derived neem oil concentrate for routine garden and crop care.'],
                    ['Organic Pest Control Spray', 'Ready-to-use botanical spray for common garden pest management.'],
                ],
            ],
            [
                'category' => 'Farm Tools & Equipment',
                'option' => 'Tool Size',
                'variants' => ['Compact', 'Standard', 'Heavy Duty'],
                'products' => [
                    ['Stainless Pruning Shears', 'Sharp, comfortable pruning shears for trimming plants and harvesting stems.'],
                    ['Heavy-Duty Garden Hoe', 'Durable steel hoe for weeding, soil preparation, and furrow making.'],
                ],
            ],
            [
                'category' => 'Irrigation & Watering',
                'option' => 'Coverage',
                'variants' => ['Small Plot', 'Medium Plot', 'Large Plot'],
                'products' => [
                    ['Drip Irrigation Kit', 'Water-saving drip lines and fittings for precise watering of crop rows.'],
                    ['Adjustable Sprinkler Set', 'Adjustable sprinklers for even watering across garden beds and small fields.'],
                ],
            ],
            [
                'category' => 'Animal Feed & Nutrition',
                'option' => 'Bag Size',
                'variants' => ['5 kg', '10 kg', '25 kg'],
                'products' => [
                    ['Layer Poultry Feed', 'Balanced daily feed formulated to support healthy laying hens.'],
                    ['Cattle Feed Pellets', 'Nutritious feed pellets for supplementing cattle diets.'],
                ],
            ],
            [
                'category' => 'Livestock Care',
                'option' => 'Pack Size',
                'variants' => ['Small Pack', 'Farm Pack', 'Bulk Pack'],
                'products' => [
                    ['Poultry Vitamin Supplement', 'Water-soluble vitamin supplement for everyday poultry care.'],
                    ['Livestock Mineral Block', 'Convenient mineral lick for cattle, goats, and other farm animals.'],
                ],
            ],
            [
                'category' => 'Harvest & Storage',
                'option' => 'Capacity',
                'variants' => ['10 kg', '20 kg', '30 kg'],
                'products' => [
                    ['Reusable Produce Harvest Crate', 'Ventilated reusable crate for collecting and transporting fresh produce.'],
                    ['Woven Grain Storage Sack', 'Durable woven sack for handling and storing harvested grains.'],
                ],
            ],
            [
                'category' => 'Greenhouse & Growing Supplies',
                'option' => 'Tray Size',
                'variants' => ['50 Cells', 'Tray of 72', 'Tray of 128'],
                'products' => [
                    ['Reusable Seedling Tray', 'Reusable propagation tray for starting vegetables and flowers.'],
                    ['UV-Resistant Shade Netting', 'Weather-resistant shade netting to help protect crops from intense sunlight.'],
                ],
            ],
            [
                'category' => 'Farm Safety & Workwear',
                'option' => 'Size',
                'variants' => ['Small', 'Medium', 'Large'],
                'products' => [
                    ['Nitrile-Coated Farm Gloves', 'Grip-enhanced work gloves for planting, pruning, and general farm tasks.'],
                    ['Waterproof Farm Boots', 'Waterproof boots for working in wet fields, gardens, and farmyards.'],
                ],
            ],
        ];

        $images = [
            'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=900&q=80',
        ];

        $productIndex = 0;

        foreach ($catalog as $categoryIndex => $categoryData) {
            $categorySlug = Str::slug($categoryData['category']);
            $category = Category::updateOrCreate(
                ['slug' => $categorySlug],
                [
                    'name' => $categoryData['category'],
                    'slug' => $categorySlug,
                    'parent_id' => $agriculture->id,
                ],
            );

            foreach ($categoryData['products'] as $productIndexInCategory => [$productName, $description]) {
                $sku = 'SA-'.str_pad((string) ($categoryIndex + 1), 2, '0', STR_PAD_LEFT)
                    .'-'.str_pad((string) ($productIndexInCategory + 1), 2, '0', STR_PAD_LEFT);
                $slug = Str::slug($productName.'-'.$categorySlug);
                $basePrice = 199 + ($categoryIndex * 33) + (($productIndexInCategory + 1) * 29);
                $salePrice = 169 + ($categoryIndex * 29) + (($productIndexInCategory + 1) * 21);

                $product = Product::updateOrCreate(
                    ['sku' => $sku],
                    [
                        'shop_id' => $shop->id,
                        'seller_id' => $shop->id,
                        'category_id' => $category->id,
                        'name' => $productName,
                        'slug' => $slug,
                        'description' => $description,
                        'condition' => 'new',
                        'authenticity_status' => 'verified',
                        'verification_status' => 'verified',
                        'base_price' => $basePrice,
                        'currency' => 'PHP',
                        'sale_price' => $salePrice,
                        'brand' => 'SharingAgent',
                        'stock_quantity' => 25 + (($productIndexInCategory + 1) * 10),
                        'status' => 'published',
                        'is_approved' => true,
                        'is_active' => true,
                        'published_at' => now(),
                    ],
                );

                for ($imageIndex = 0; $imageIndex < 5; $imageIndex++) {
                    ProductImage::updateOrCreate(
                        ['product_id' => $product->id, 'sort_order' => $imageIndex + 1],
                        [
                            'path' => $images[($productIndex * 5 + $imageIndex) % count($images)],
                            'is_primary' => $imageIndex === 0,
                        ],
                    );
                }

                $product->images()->whereNotIn('sort_order', range(1, 5))->delete();

                $option = $product->options()->updateOrCreate(
                    ['name' => $categoryData['option']],
                    ['sort_order' => 1],
                );
                $product->options()->where('id', '!=', $option->id)->delete();

                foreach ($categoryData['variants'] as $variantIndex => $variantName) {
                    $optionValue = $option->values()->updateOrCreate(
                        ['value' => $variantName],
                        ['sort_order' => $variantIndex + 1],
                    );
                    $variant = $product->variants()->updateOrCreate(
                        ['sku' => $product->sku.'-V'.($variantIndex + 1)],
                        [
                            'name' => $variantName,
                            'price' => (float) $salePrice + ($variantIndex * 25),
                            'stock_quantity' => 10 + ($variantIndex * 5),
                            'is_active' => true,
                        ],
                    );
                    $variant->optionValues()->delete();
                    $variant->optionValues()->create([
                        'product_option_value_id' => $optionValue->id,
                    ]);
                }

                $productIndex++;
            }
        }
    }
}
