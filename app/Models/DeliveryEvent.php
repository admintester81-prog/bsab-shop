<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryEvent extends Model
{
    public $timestamps = false;

    protected $fillable = ['delivery_id', 'actor_id', 'status', 'note', 'proof_path', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function delivery()
    {
        return $this->belongsTo(Delivery::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
