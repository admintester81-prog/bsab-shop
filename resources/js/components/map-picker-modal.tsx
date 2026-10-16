import 'leaflet/dist/leaflet.css';
import { api, getApiErrorMessage } from '@/lib/api';
import L from 'leaflet';
import { AlertCircle, Check, Crosshair, Layers3, Loader2, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SelectedLocation {
    line1: string;
    barangay: string;
    city: string;
    province: string;
    postal_code: string;
    formatted: string;
    lat: number;
    lng: number;
}

interface MapPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialAddress?: {
        line1?: string;
        barangay?: string | null;
        city?: string;
        province?: string;
        postal_code?: string;
        latitude?: number | null;
        longitude?: number | null;
    };
    deliveryBarangays?: string[];
    onSelectLocation: (location: SelectedLocation) => void;
}

// Custom modern green pin icon using HTML/SVG to avoid bundler image asset issues
const createCustomPinIcon = () =>
    L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
            <div style="position:relative; width:40px; height:48px; transform:translate(-20px, -48px);">
                <div style="width:38px; height:38px; background:#23834b; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(35,131,75,0.45); border:3px solid #ffffff;">
                    <div style="width:14px; height:14px; background:#ffffff; border-radius:50%; transform:rotate(45deg);"></div>
                </div>
                <div style="position:absolute; bottom:0; left:12px; width:16px; height:6px; background:rgba(0,0,0,0.25); border-radius:50%; filter:blur(2px);"></div>
            </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
    });

function isHinobaAnAddress(address: Record<string, string | undefined>) {
    const normalize = (value: string) =>
        value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    const localities = [
        address.city,
        address.town,
        address.municipality,
        address.village,
        address.county,
        address.city_district,
        address.state_district,
        address.district,
    ]
        .filter((value): value is string => Boolean(value))
        .map(normalize);
    const provinces = [
        address.province,
        address.state,
        address.region,
        address.county,
        address.state_district,
        address['ISO3166-2-lvl4'],
    ]
        .filter((value): value is string => Boolean(value))
        .map(normalize);
    const country = address.country ? normalize(address.country) : '';

    return (
        localities.includes('hinobaan') &&
        (!country || country === 'philippines' || country === 'pilipinas') &&
        (provinces.includes('negrosoccidental') ||
            provinces.includes('negrosislandregion') ||
            provinces.includes('westernvisayas') ||
            provinces.includes('regionvi') ||
            provinces.includes('ph06') ||
            provinces.length === 0)
    );
}

function normalizeBarangay(value: string) {
    return value.toLowerCase().replace(/^barangay\s+/i, '').replace(/[^a-z0-9]/g, '');
}

function getBarangay(address: Record<string, string | undefined>) {
    return address.barangay || address.suburb || address.neighbourhood || address.quarter || address.city_district || address.hamlet || '';
}

export default function MapPickerModal({ isOpen, onClose, initialAddress, deliveryBarangays, onSelectLocation }: MapPickerModalProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [mapMode, setMapMode] = useState<'street' | 'satellite'>('street');
    const [isSearching, setIsSearching] = useState(false);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSupportedLocation, setIsSupportedLocation] = useState(false);
    const [isSupportedBarangay, setIsSupportedBarangay] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
        line1: initialAddress?.line1 || '',
        barangay: initialAddress?.barangay || '',
        city: initialAddress?.city || '',
        province: initialAddress?.province || '',
        postal_code: initialAddress?.postal_code || '',
        formatted: [initialAddress?.line1, initialAddress?.barangay, initialAddress?.city, initialAddress?.province, initialAddress?.postal_code]
            .filter(Boolean)
            .join(', ') || 'Philippines',
        lat: 9.6021766,
        lng: 122.4670994,
    });

    // Reverse geocode through the authenticated app endpoint to avoid browser cross-origin blocking.
    async function reverseGeocode(lat: number, lng: number) {
        setIsReverseGeocoding(true);
        setLookupError('');
        try {
            const { data } = await api.get('/customer/location/reverse', { params: { lat, lon: lng } });
            const addr = data.address || {};
            const isSupported = isHinobaAnAddress(addr);
            const rawBarangay = getBarangay(addr);
            const matchedBarangay = deliveryBarangays?.find(
                (barangay) => normalizeBarangay(barangay) === normalizeBarangay(rawBarangay),
            );

            const streetNumber = addr.house_number || '';
            const road = addr.road || addr.street || addr.pedestrian || addr.suburb || addr.neighbourhood || '';
            const line1 = [streetNumber, road].filter(Boolean).join(' ') || data.name || '';
            const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
            const province = addr.province || addr.state || addr.region || '';
            const postal_code = addr.postcode || '';

            const formatted = data.display_name || [line1, city, province, postal_code].filter(Boolean).join(', ');

            setSelectedLocation({
                line1,
                barangay: matchedBarangay || rawBarangay,
                city: isSupported ? 'Hinoba-an' : city,
                province: isSupported ? 'Negros Occidental' : province,
                postal_code,
                formatted,
                lat,
                lng,
            });
            setIsSupportedLocation(isSupported);
            setIsSupportedBarangay(Boolean(rawBarangay));
        } catch (error: unknown) {
            setLookupError(getApiErrorMessage(error, 'Unable to look up this location. Try again or choose another point on the map.'));
            setSelectedLocation((prev) => ({
                ...prev,
                barangay: '',
                city: '',
                province: '',
                lat,
                lng,
                formatted: `Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            }));
            setIsSupportedLocation(false);
            setIsSupportedBarangay(false);
        } finally {
            setIsReverseGeocoding(false);
        }
    }

    // Search through the authenticated app endpoint to avoid browser cross-origin blocking.
    async function handleSearch(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        setIsSearching(true);
        setLookupError('');
        try {
            const { data: results } = await api.get('/customer/location/search', { params: { query: trimmed } });
            setSearchResults(results);

            if (results && results.length > 0) {
                const first = results[0];
                const lat = parseFloat(first.lat);
                const lon = parseFloat(first.lon);
                moveToCoordinates(lat, lon, 16);
            } else {
                setLookupError('No matching locations found. Try a street, landmark, or barangay in Hinoba-an.');
            }
        } catch (error: unknown) {
            setSearchResults([]);
            setLookupError(getApiErrorMessage(error, 'Location search is temporarily unavailable. Please try again.'));
        } finally {
            setIsSearching(false);
        }
    }

    function moveToCoordinates(lat: number, lng: number, zoomLevel = 16) {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.setView([lat, lng], zoomLevel);
        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        }
        reverseGeocode(lat, lng);
    }

    // Geolocation: Find user current location
    function locateUser() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                moveToCoordinates(latitude, longitude, 17);
            },
            () => {
                alert('Could not access your location. Please ensure location permissions are allowed.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // Initialize map on modal open
    useEffect(() => {
        if (!isOpen) {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                tileLayerRef.current = null;
            }
            setMapMode('street');
            return;
        }

        // Delay slightly so DOM is measured properly
        const timer = setTimeout(() => {
            if (!mapContainerRef.current || mapInstanceRef.current) return;

            const hasSavedCoordinates =
                Number.isFinite(initialAddress?.latitude) &&
                Number.isFinite(initialAddress?.longitude);
            const initialLat = hasSavedCoordinates ? Number(initialAddress?.latitude) : 9.6021766;
            const initialLng = hasSavedCoordinates ? Number(initialAddress?.longitude) : 122.4670994;

            const map = L.map(mapContainerRef.current, {
                center: [initialLat, initialLng],
                zoom: 13,
                zoomControl: false,
            });

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);
            tileLayerRef.current = streetTiles;

            const pinIcon = createCustomPinIcon();
            const marker = L.marker([initialLat, initialLng], {
                icon: pinIcon,
                draggable: true,
            }).addTo(map);

            marker.on('dragend', () => {
                const latlng = marker.getLatLng();
                reverseGeocode(latlng.lat, latlng.lng);
            });

            map.on('click', (e: L.LeafletMouseEvent) => {
                marker.setLatLng(e.latlng);
                reverseGeocode(e.latlng.lat, e.latlng.lng);
            });

            mapInstanceRef.current = map;
            markerRef.current = marker;
            window.requestAnimationFrame(() => map.invalidateSize(true));

            // If initial address exists, search and locate it
            const addressString = [initialAddress?.line1, initialAddress?.barangay, initialAddress?.city, initialAddress?.province]
                .filter(Boolean)
                .join(', ');

            if (hasSavedCoordinates) {
                map.setView([initialLat, initialLng], 17);
                reverseGeocode(initialLat, initialLng);
            } else if (addressString) {
                api.get('/customer/location/search', { params: { query: addressString } })
                    .then(({ data: results }) => {
                        if (!results?.length) {
                            setLookupError('Could not find the saved address. Search for a nearby street or move the map pin.');
                            reverseGeocode(initialLat, initialLng);
                            return;
                        }
                        const lat = Number(results[0].lat);
                        const lon = Number(results[0].lon);
                        moveToCoordinates(lat, lon, 15);
                    })
                    .catch((error: unknown) => {
                        setLookupError(getApiErrorMessage(error, 'Could not find the saved address. Search for a nearby street or move the map pin.'));
                        reverseGeocode(initialLat, initialLng);
                    });
            } else {
                reverseGeocode(initialLat, initialLng);
            }
        }, 150);

        return () => {
            clearTimeout(timer);
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                tileLayerRef.current = null;
            }
        };
    }, [isOpen]);

    function switchMapMode(mode: 'street' | 'satellite') {
        const map = mapInstanceRef.current;
        if (!map || mapMode === mode) return;

        if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
        }

        tileLayerRef.current =
            mode === 'satellite'
                ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                      maxZoom: 19,
                  })
                : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                      maxZoom: 19,
                  });
        tileLayerRef.current.addTo(map);
        window.requestAnimationFrame(() => map.invalidateSize(true));
        setMapMode(mode);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-[#0f281b]/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Dialog */}
            <div className="relative flex flex-col w-full max-w-3xl h-[88vh] max-h-[750px] overflow-hidden rounded-2xl border border-[#d9eee0] bg-white shadow-[0_20px_50px_rgba(10,50,28,0.25)] animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#e5efe7] bg-[#f9fcf9] px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2f2e4] text-[#23834b]">
                            <MapPin size={18} />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-[#145437] sm:text-[15px]">Pick Address on Map</h2>
                            <p className="text-[10px] text-[#5c6e63] sm:text-[11px]">Click or drag the marker to your precise delivery location</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-full text-[#5c6e63] hover:bg-[#f5fcf7] hover:text-[#173b2a] transition"
                        aria-label="Close map picker"
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* Search Bar & Quick Action */}
                <div className="relative z-10 border-b border-[#e5eee7] bg-white p-3 sm:px-6 sm:py-2.5">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647568]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search city, barangay, street, or landmark in Philippines..."
                                className="w-full rounded-full border border-[#dfeae2] bg-[#fbfdfb] pl-9 pr-8 py-2 text-xs text-[#173b2a] outline-none transition placeholder:text-[#5c6e63] focus:border-[#2c9350] focus:bg-white focus:ring-4 focus:ring-[#e6f7eb]"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSearchResults([]);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c6e63] hover:text-[#173b2a]"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#23834b] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#186a3a] disabled:opacity-60 shadow-sm shadow-[#23834b]/20"
                        >
                            {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                            <span className="hidden sm:inline">Search</span>
                        </button>
                        <button
                            type="button"
                            onClick={locateUser}
                            title="Use my current GPS location"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#dfeae2] bg-[#f5fcf7] px-3 py-2 text-xs font-semibold text-[#1f7a42] hover:bg-[#eaf8ee] transition"
                        >
                            <Crosshair size={14} />
                            <span className="hidden md:inline">Locate Me</span>
                        </button>
                        <div className="inline-flex shrink-0 items-center rounded-full border border-[#dfeae2] bg-[#f5fcf7] p-0.5" role="group" aria-label="Map style">
                            <button type="button" onClick={() => switchMapMode('street')} aria-pressed={mapMode === 'street'} className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${mapMode === 'street' ? 'bg-[#23834b] text-white' : 'text-[#1f7a42] hover:bg-white'}`}>
                                Map
                            </button>
                            <button type="button" onClick={() => switchMapMode('satellite')} aria-pressed={mapMode === 'satellite'} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${mapMode === 'satellite' ? 'bg-[#23834b] text-white' : 'text-[#1f7a42] hover:bg-white'}`}>
                                <Layers3 size={12} /> Satellite
                            </button>
                        </div>
                    </form>

                    {/* Search Suggestions dropdown */}
                    {searchResults.length > 0 && (
                        <div className="absolute left-4 right-4 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#dfeae2] bg-white p-1 shadow-lg sm:left-6 sm:right-6">
                            {searchResults.map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        const lat = parseFloat(item.lat);
                                        const lon = parseFloat(item.lon);
                                        moveToCoordinates(lat, lon, 16);
                                        setSearchResults([]);
                                        setSearchQuery(item.display_name.split(',')[0]);
                                    }}
                                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs text-[#173b2a] hover:bg-[#f5fcf7] transition"
                                >
                                    <MapPin size={13} className="mt-0.5 shrink-0 text-[#2c9350]" />
                                    <span className="truncate">{item.display_name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {lookupError && (
                        <p role="alert" className="mt-2 rounded-lg bg-[#fff3f1] px-3 py-2 text-xs font-semibold text-[#a63d36]">
                            {lookupError}
                        </p>
                    )}
                </div>

                {/* Map Area */}
                <div className="relative flex-1 bg-[#f7fbf7]">
                    <div ref={mapContainerRef} className="h-full w-full" />

                    {/* Geocoding indicator pill */}
                    {isReverseGeocoding && (
                        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-[#2c9350]/30 bg-white/95 px-3.5 py-1.5 shadow-md backdrop-blur-sm">
                            <Loader2 size={13} className="animate-spin text-[#2c9350]" />
                            <span className="text-[11px] font-semibold text-[#2c9350]">Locating address...</span>
                        </div>
                    )}

                    {/* Hint badge */}
                    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-1.5 rounded-lg border border-[#dfeae2] bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur-sm text-[10px] text-[#5c6e63]">
                        <MapPin size={11} className="text-[#2c9350]" />
                        <span>Tip: Drag marker or click anywhere to adjust location</span>
                    </div>
                </div>

                {/* Footer / Selected Address Preview */}
                <div className="border-t border-[#e5eee7] bg-white p-3 sm:p-4 md:px-6">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div className="min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5c6e63]">
                                Selected Location
                            </span>
                            <p className="mt-0.5 truncate text-xs font-bold text-[#145437] sm:text-sm">
                                {selectedLocation.line1 || selectedLocation.barangay || selectedLocation.city || 'No specific street detected'}
                            </p>
                            <p className="truncate text-[11px] text-[#5d7768]">
                                {[selectedLocation.barangay, selectedLocation.city, selectedLocation.province, selectedLocation.postal_code]
                                    .filter(Boolean)
                                    .join(', ') || selectedLocation.formatted}
                            </p>
                            {!isSupportedLocation && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#b3413a]">
                                    <AlertCircle size={12} />
                                    Choose a location within Hinoba-an, Negros Occidental.
                                </p>
                            )}
                            {isSupportedLocation && (
                                <label className="mt-2 block max-w-sm text-[11px] font-semibold text-[#315843]">
                                    Barangay / sitio
                                    <input
                                        value={selectedLocation.barangay}
                                        onChange={(event) => {
                                            const barangay = event.target.value;
                                            setSelectedLocation((current) => ({ ...current, barangay }));
                                            setIsSupportedBarangay(Boolean(barangay.trim()));
                                        }}
                                        placeholder="Enter your barangay or sitio"
                                        className="mt-1 w-full rounded-lg border border-[#dfeae2] bg-white px-3 py-2 text-xs font-normal text-[#173b2a] outline-none focus:border-[#2c9350] focus:ring-2 focus:ring-[#2c9350]/15"
                                    />
                                </label>
                            )}
                            {isSupportedLocation && !isSupportedBarangay && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#b3413a]">
                                    <AlertCircle size={12} />
                                    Enter your barangay or sitio to confirm this address.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full border border-[#dfeae2] bg-white px-4 py-2 text-xs font-semibold text-[#647568] hover:bg-[#f5fcf7] transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!isSupportedLocation || !selectedLocation.barangay.trim() || isReverseGeocoding}
                                onClick={() => {
                                    onSelectLocation(selectedLocation);
                                    onClose();
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#23834b] px-5 py-2 text-xs font-bold text-white shadow-md shadow-[#23834b]/20 transition hover:bg-[#186a3a] focus-visible:outline-2 focus-visible:outline-[#23834b] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Check size={14} strokeWidth={2.5} />
                                <span>Confirm Address</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
