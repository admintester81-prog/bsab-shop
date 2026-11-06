<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductSearch extends Model
{
    protected $fillable = ['user_id', 'query', 'normalized_query'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
