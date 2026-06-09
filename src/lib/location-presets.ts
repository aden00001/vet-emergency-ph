export interface LocationPreset {
  id: string;
  label: string;
  region: string;
  latitude: number;
  longitude: number;
}

/** Preset centers for manual location when GPS is unavailable */
export const LOCATION_PRESETS: LocationPreset[] = [
  // Metro Manila (NCR)
  { id: "ncr-manila", label: "Manila", region: "Metro Manila (NCR)", latitude: 14.5995, longitude: 120.9842 },
  { id: "ncr-quezon-city", label: "Quezon City", region: "Metro Manila (NCR)", latitude: 14.676, longitude: 121.0437 },
  { id: "ncr-makati", label: "Makati", region: "Metro Manila (NCR)", latitude: 14.5547, longitude: 121.0244 },
  { id: "ncr-pasig", label: "Pasig", region: "Metro Manila (NCR)", latitude: 14.5764, longitude: 121.0851 },
  { id: "ncr-taguig", label: "Taguig / BGC", region: "Metro Manila (NCR)", latitude: 14.5176, longitude: 121.0509 },
  { id: "ncr-mandaluyong", label: "Mandaluyong", region: "Metro Manila (NCR)", latitude: 14.5794, longitude: 121.0359 },
  { id: "ncr-pasay", label: "Pasay", region: "Metro Manila (NCR)", latitude: 14.5378, longitude: 121.0014 },
  { id: "ncr-paranaque", label: "Parañaque", region: "Metro Manila (NCR)", latitude: 14.4791, longitude: 121.0198 },
  { id: "ncr-las-pinas", label: "Las Piñas", region: "Metro Manila (NCR)", latitude: 14.45, longitude: 120.9828 },
  { id: "ncr-muntinlupa", label: "Muntinlupa / Alabang", region: "Metro Manila (NCR)", latitude: 14.4081, longitude: 121.0415 },
  { id: "ncr-caloocan", label: "Caloocan", region: "Metro Manila (NCR)", latitude: 14.6488, longitude: 120.9839 },
  { id: "ncr-marikina", label: "Marikina", region: "Metro Manila (NCR)", latitude: 14.6507, longitude: 121.1029 },
  { id: "ncr-san-juan", label: "San Juan", region: "Metro Manila (NCR)", latitude: 14.6019, longitude: 121.0355 },
  { id: "ncr-valenzuela", label: "Valenzuela", region: "Metro Manila (NCR)", latitude: 14.7014, longitude: 120.983 },
  { id: "ncr-malabon", label: "Malabon", region: "Metro Manila (NCR)", latitude: 14.6578, longitude: 120.9944 },
  { id: "ncr-navotas", label: "Navotas", region: "Metro Manila (NCR)", latitude: 14.7122, longitude: 120.8738 },
  { id: "ncr-pateros", label: "Pateros", region: "Metro Manila (NCR)", latitude: 14.5437, longitude: 121.0727 },
  // QC districts (finer pins)
  { id: "qc-fairview", label: "Quezon City — Fairview / Novaliches", region: "Quezon City areas", latitude: 14.71, longitude: 121.06 },
  { id: "qc-cubao", label: "Quezon City — Cubao / Araneta", region: "Quezon City areas", latitude: 14.619, longitude: 121.056 },
  { id: "qc-timog", label: "Quezon City — Timog / Diliman", region: "Quezon City areas", latitude: 14.635, longitude: 121.038 },
  { id: "qc-commonwealth", label: "Quezon City — Commonwealth", region: "Quezon City areas", latitude: 14.685, longitude: 121.065 },
  // Nearby (common overflow from NCR search)
  { id: "rizal-cainta", label: "Cainta, Rizal", region: "Nearby", latitude: 14.581, longitude: 121.105 },
  { id: "rizal-antipolo", label: "Antipolo, Rizal", region: "Nearby", latitude: 14.625, longitude: 121.122 },
  { id: "cavite-bacoor", label: "Bacoor, Cavite", region: "Nearby", latitude: 14.454, longitude: 120.956 },
  { id: "laguna-santa-rosa", label: "Santa Rosa, Laguna", region: "Nearby", latitude: 14.312, longitude: 121.111 },
];

export const LOCATION_REGIONS = [
  ...new Set(LOCATION_PRESETS.map((p) => p.region)),
];

export function getPresetById(id: string): LocationPreset | undefined {
  return LOCATION_PRESETS.find((p) => p.id === id);
}

export const DEFAULT_PRESET_ID = "ncr-manila";

export type LocationSource = "gps" | "preset" | "search" | "custom" | "default";

export interface SavedLocation {
  lat: number;
  lng: number;
  label: string;
  presetId?: string;
  source?: LocationSource;
}

const STORAGE_KEY = "vetemergency_location";

export function loadSavedLocation(): SavedLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLocation;
  } catch {
    return null;
  }
}

export function saveLocation(loc: SavedLocation): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export interface GeolocationCoords {
  lat: number;
  lng: number;
}

/** Resolves the viewer's GPS coordinates via the browser Geolocation API. */
export function requestUserGeolocation(): Promise<GeolocationCoords> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("GPS is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300_000 }
    );
  });
}
