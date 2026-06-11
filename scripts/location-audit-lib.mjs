/**
 * Shared location issue classification (audit + Playwright pin fix).
 */

import {
  extractPlaceId,
  extractPlusCode,
  isBadGeocode,
} from "./geocode-lib.mjs";

/** Metro Manila / NCR bounding box (matches scrape-google-places.mjs). */
export const NCR_BOUNDS = { south: 14.35, west: 120.85, north: 14.75, east: 121.15 };

export const NCR_ADDRESS_RE =
  /metro manila|\bncr\b|quezon city|manila|makati|taguig|pasig|mandaluyong|pasay|parañaque|paranaque|las piñas|las pinas|muntinlupa|caloocan|marikina|san juan|valenzuela|malabon|navotas|pateros/i;

export function isMetroManila(clinic) {
  if (clinic.latitude != null && clinic.longitude != null) {
    const { latitude: lat, longitude: lng } = clinic;
    return (
      lat >= NCR_BOUNDS.south &&
      lat <= NCR_BOUNDS.north &&
      lng >= NCR_BOUNDS.west &&
      lng <= NCR_BOUNDS.east
    );
  }
  return NCR_ADDRESS_RE.test(clinic.address || "");
}

export function isBrokenMapsUrl(url) {
  if (!url) return true;
  const u = url.trim();
  if (!u.includes("google.com/maps")) return true;
  if (/\/maps\/search\/?$/.test(u)) return true;
  if (/\/maps\/search\/\?/.test(u) && !u.includes("/maps/place/")) return true;
  return !u.includes("/maps/place/") && !u.includes("query_place_id=");
}

export function classifyClinic(clinic) {
  const issues = [];
  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  const plusCode = extractPlusCode(clinic.address);
  const hasCoords = clinic.latitude != null && clinic.longitude != null;
  const verified = clinic.location_verified !== false;

  if (!hasCoords) issues.push("missing_coordinates");
  if (!verified) issues.push("location_unverified");
  if (hasCoords && isBadGeocode(clinic)) issues.push("bad_geocode");
  if (!plusCode) issues.push("missing_plus_code_in_address");
  if (isBrokenMapsUrl(clinic.google_maps_url)) issues.push("broken_maps_url");
  if (!placeId) issues.push("no_place_id");

  const pinIssues = ["missing_coordinates", "location_unverified", "bad_geocode"];
  const enrichmentIssues = ["missing_plus_code_in_address", "broken_maps_url"];
  const hasPinIssue = pinIssues.some((i) => issues.includes(i));
  const hasEnrichmentIssue = enrichmentIssues.some((i) => issues.includes(i));
  const metroManila = isMetroManila(clinic);

  const needsPinFix = Boolean(placeId) && hasPinIssue;
  const needsEnrichment =
    Boolean(placeId) && !metroManila && hasEnrichmentIssue && !hasPinIssue;

  return {
    name: clinic.name,
    address: clinic.address || null,
    google_place_id: placeId,
    google_maps_url: clinic.google_maps_url || null,
    latitude: clinic.latitude ?? null,
    longitude: clinic.longitude ?? null,
    location_verified: verified,
    plus_code_in_address: plusCode,
    geocode_source: clinic.geocode_source ?? null,
    geocode_precision: clinic.geocode_precision ?? null,
    region: metroManila ? "metro_manila" : "outside_ncr",
    issues,
    needs_pin_fix: needsPinFix,
    needs_enrichment: needsEnrichment,
    needs_playwright: needsPinFix || needsEnrichment,
  };
}

export function clinicNeedsPinFix(clinic) {
  return classifyClinic(clinic).needs_pin_fix;
}
