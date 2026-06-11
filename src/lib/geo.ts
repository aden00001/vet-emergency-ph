export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function roundCoord(value: number, decimals = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function getNavigableCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
  locationVerified = true
): { lat: number; lng: number } | null {
  if (
    !locationVerified ||
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

export function hasNavigableLocation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  locationVerified = true
): boolean {
  return getNavigableCoords(lat, lng, locationVerified) !== null;
}

export function buildGoogleMapsDirectionsUrl(
  lat: number,
  lng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function buildWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
