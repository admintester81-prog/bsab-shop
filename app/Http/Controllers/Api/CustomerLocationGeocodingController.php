<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class CustomerLocationGeocodingController extends Controller
{
    public function search(Request $request)
    {
        $data = $request->validate([
            'query' => ['required', 'string', 'max:255'],
        ]);

        $query = trim($data['query']);
        if (! str_contains(mb_strtolower($query), 'hinoba-an')) {
            $query .= ', Hinoba-an, Negros Occidental, Philippines';
        }

        $response = Http::acceptJson()
            ->withHeaders(['User-Agent' => 'BSAB-SHOP/1.0'])
            ->timeout(10)
            ->get('https://nominatim.openstreetmap.org/search', [
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'countrycodes' => 'ph',
                'limit' => 5,
                'q' => $query,
            ]);

        abort_unless($response->successful(), 502, 'Location search is temporarily unavailable.');

        return response()->json($response->json());
    }

    public function reverse(Request $request)
    {
        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lon' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $response = Http::acceptJson()
            ->withHeaders(['User-Agent' => 'BSAB-SHOP/1.0'])
            ->timeout(10)
            ->get('https://nominatim.openstreetmap.org/reverse', [
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'lat' => $data['lat'],
                'lon' => $data['lon'],
            ]);

        abort_unless($response->successful(), 502, 'Location lookup is temporarily unavailable.');

        return response()->json($response->json());
    }
}
