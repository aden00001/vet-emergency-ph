/**
 * Geocode clinic addresses via Nominatim (OpenStreetMap) with fallbacks.
 * Optional LocationIQ (free tier) and Google Places lookup by place_id.
 *
 * Nominatim usage policy: max 1 request/second. We enforce a global gap between calls.
 */

import { OpenLocationCode } from "open-location-code";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const olc = new OpenLocationCode();
const PLUS_CODE_RE = /[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i;
const PLUS_CODE_LEAD_RE = /^([23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,})/i;

let lastNominatimAt = 0;
let lastLocationIqAt = 0;

export function sanitizeAddress(address) {
  let a = (address || "").trim();
  a = a.replace(PLUS_CODE_RE, "").replace(/^,\s*/, "").trim();
  a = a.replace(/^St,\s*/i, "").trim();
  return a.replace(/\s+/g, " ");
}

export function parseAddressParts(address) {
  const parts = (address || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { street: sanitizeAddress(address), city: "", province: "" };
  }

  const province = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const street = sanitizeAddress(parts.slice(0, -2).join(", "));
  return { street, city, province };
}

/** Prioritized queries — best first, fewer total requests. */
export function extractPlusCode(address) {
  const m = (address || "").trim().match(PLUS_CODE_LEAD_RE);
  return m ? m[1].toUpperCase() : null;
}

export function extractCoordsFromUrl(url) {
  const m = url?.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  const at = url?.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { latitude: parseFloat(at[1]), longitude: parseFloat(at[2]) };
  return null;
}

export function extractPlaceId(url, explicitId) {
  if (explicitId) return String(explicitId);
  const chij = url?.match(/query_place_id=([^&]+)/);
  if (chij) return decodeURIComponent(chij[1]);
  const placeParam = url?.match(/place_id[=:]([A-Za-z0-9_-]+)/i);
  if (placeParam) return placeParam[1];
  const hex = url?.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return hex ? hex[1].toLowerCase() : null;
}

function normalizeCityToken(city) {
  return (city || "")
    .toLowerCase()
    .replace(/\s+city$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Reject vague Nominatim hits (e.g. USTP for every CDO address). */
export function isAcceptableGeocodeResult(clinic, result) {
  if (!result) return false;

  const rawAddress = clinic.address || "";
  const { street, city, province } = parseAddressParts(rawAddress);
  const displayLower = (result.display_name || "").toLowerCase();
  const nameLower = (clinic.name || "").toLowerCase();

  if (result.precision === "city" && (street || extractPlusCode(rawAddress))) {
    return false;
  }

  if (city) {
    const cityNorm = normalizeCityToken(city);
    if (cityNorm && !displayLower.includes(cityNorm)) return false;
  }

  if (province) {
    const provNorm = province.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (provNorm && !displayLower.includes(provNorm)) return false;
  }

  const landmarkTerms = /university|college|institute of technology|\bustp\b|hospital center|trauma and medical center/i;
  const businessLooksAcademic = /university|college|\bustp\b/i.test(`${nameLower} ${rawAddress}`);
  if (landmarkTerms.test(displayLower) && !businessLooksAcademic) {
    return false;
  }

  return true;
}

/** Detect coordinates saved from a bad city-level or landmark fallback. */
export function isBadGeocode(clinic) {
  if (clinic.latitude == null || clinic.longitude == null) return false;

  if (clinic.geocode_precision === "city") {
    const { street } = parseAddressParts(clinic.address || "");
    if (street || extractPlusCode(clinic.address)) return true;
  }

  const from = (clinic.geocoded_from || "").toLowerCase();
  const name = (clinic.name || "").toLowerCase();
  if (/university of science and technology|\bustp\b/i.test(from) && !/university|college|\bustp\b/i.test(name)) {
    return true;
  }

  return false;
}

export function clearGeocodeFields(clinic) {
  delete clinic.latitude;
  delete clinic.longitude;
  delete clinic.geocoded_from;
  delete clinic.geocode_precision;
  delete clinic.geocode_source;
  clinic.location_verified = false;
}

export function decodePlusCode(code, refLat = null, refLng = null) {
  try {
    let area;
    if (olc.isFull(code)) {
      area = olc.decode(code);
    } else if (refLat != null && refLng != null) {
      area = olc.decode(code, refLat, refLng);
    } else {
      return null;
    }
    return {
      latitude: area.latitudeCenter,
      longitude: area.longitudeCenter,
      display_name: `Plus code ${code}`,
      precision: "plus_code",
      source: "plus_code",
    };
  } catch {
    return null;
  }
}

export function geocodeQueries(clinic, maxQueries = 3) {
  const name = (clinic.name || "").trim();
  const rawAddress = (clinic.address || "").trim();
  const address = sanitizeAddress(rawAddress);
  const { street, city, province } = parseAddressParts(rawAddress);

  const queries = [];

  if (street && city && province) queries.push(`${street}, ${city}, ${province}, Philippines`);
  else if (address) queries.push(`${address}, Philippines`);
  if (name && city && province) queries.push(`${name}, ${city}, ${province}, Philippines`);
  if (city && province) queries.push(`${city}, ${province}, Philippines`);

  return [...new Set(queries.filter(Boolean))].slice(0, maxQueries);
}

async function waitForNominatimSlot(minIntervalMs) {
  const elapsed = Date.now() - lastNominatimAt;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
}

async function fetchNominatim(url, { minIntervalMs, onRateLimit }) {
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await waitForNominatimSlot(minIntervalMs);
    lastNominatimAt = Date.now();

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Vet247PH/1.0 (local dev; geocoding for vet directory)",
      },
    });

    if (res.status === 429) {
      const waitMs = Math.min(120_000, 20_000 * (attempt + 1));
      onRateLimit?.(waitMs, attempt + 1);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return res.json();
  }

  throw new Error("Nominatim 429 (rate limited — wait 10+ minutes and re-run)");
}

export async function geocodeQuery(query, options = {}) {
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ph`;
  const results = await fetchNominatim(url, options);
  if (!results.length) return null;

  const precision = query.split(",").length <= 3 ? "city" : "address";

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    display_name: results[0].display_name,
    precision,
    source: "nominatim",
  };
}

async function waitForLocationIqSlot(minIntervalMs = 550) {
  const elapsed = Date.now() - lastLocationIqAt;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
}

function precisionFromLocationIq(query, hit) {
  const cityTypes = new Set([
    "city",
    "town",
    "village",
    "municipality",
    "county",
    "state",
    "administrative",
  ]);
  if (cityTypes.has(hit.type) || cityTypes.has(hit.addresstype)) return "city";
  return query.split(",").length <= 3 ? "city" : "address";
}

/** LocationIQ forward geocode — free tier ~5k/day at locationiq.com */
export async function locationIqGeocodeQuery(query, apiKey, options = {}) {
  if (!apiKey || !query) return null;

  const maxAttempts = 4;
  const minIntervalMs = options.minIntervalMs ?? 550;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await waitForLocationIqSlot(minIntervalMs);
    lastLocationIqAt = Date.now();

    const url = new URL("https://us1.locationiq.com/v1/search");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ph");

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (res.status === 429) {
      const waitMs = Math.min(60_000, 5000 * (attempt + 1));
      options.onRateLimit?.(waitMs, attempt + 1);
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LocationIQ ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
    }

    const results = await res.json();
    if (!Array.isArray(results) || !results.length) return null;

    const hit = results[0];
    return {
      latitude: parseFloat(hit.lat),
      longitude: parseFloat(hit.lon),
      display_name: hit.display_name,
      precision: precisionFromLocationIq(query, hit),
      source: "locationiq",
    };
  }

  throw new Error("LocationIQ 429 (daily or per-second limit — wait and re-run)");
}

async function geocodeQueryWithProviders(query, options = {}) {
  const { locationIqApiKey, useNominatim = true, preferLocationIq = false } = options;
  const providers = [];

  if (locationIqApiKey && preferLocationIq) {
    providers.push(() => locationIqGeocodeQuery(query, locationIqApiKey, options));
    if (useNominatim) providers.push(() => geocodeQuery(query, options));
  } else {
    if (useNominatim) providers.push(() => geocodeQuery(query, options));
    if (locationIqApiKey) providers.push(() => locationIqGeocodeQuery(query, locationIqApiKey, options));
  }

  for (const run of providers) {
    const result = await run();
    if (result) return result;
  }

  return null;
}

function coordsFromUrl(clinic) {
  const coords = extractCoordsFromUrl(clinic.google_maps_url);
  if (!coords) return null;
  return {
    ...coords,
    display_name: clinic.google_maps_url,
    precision: "google_maps_url",
    source: "google_maps_url",
  };
}

export async function geocodeClinic(clinic, options = {}) {
  const rawAddress = (clinic.address || "").trim();
  const providerOpts = {
    minIntervalMs: options.minIntervalMs ?? 2500,
    onRateLimit: options.onRateLimit,
    locationIqApiKey: options.locationIqApiKey,
    useNominatim: options.useNominatim !== false,
    preferLocationIq: options.preferLocationIq === true,
  };
  const googleApiKey = options.googleApiKey;

  const fromUrl = coordsFromUrl(clinic);
  if (fromUrl) return fromUrl;

  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (placeId && googleApiKey) {
    const google = await googlePlaceCoords(placeId, googleApiKey);
    if (google) return google;
  }

  const plusCode = extractPlusCode(rawAddress);
  if (plusCode) {
    const direct = decodePlusCode(plusCode);
    if (direct) return direct;

    const { city, province } = parseAddressParts(rawAddress);
    if (city && province) {
      const cityQuery = `${city}, ${province}, Philippines`;
      const cityRef = await geocodeQueryWithProviders(cityQuery, providerOpts);
      if (cityRef && isAcceptableGeocodeResult(clinic, cityRef)) {
        const decoded = decodePlusCode(plusCode, cityRef.latitude, cityRef.longitude);
        if (decoded) {
          decoded.display_name = `${plusCode}, ${city}, ${province}`;
          decoded.precision = "plus_code";
          return decoded;
        }
      }
    }
  }

  const queries = geocodeQueries(clinic, options.maxQueries ?? 3);
  for (const query of queries) {
    const result = await geocodeQueryWithProviders(query, providerOpts);
    if (result && isAcceptableGeocodeResult(clinic, result)) return result;
  }

  if (placeId && googleApiKey) {
    return googlePlaceCoords(placeId, googleApiKey);
  }

  return null;
}

export async function googlePlaceCoords(placeId, apiKey) {
  if (!placeId || !apiKey) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "geometry,formatted_address");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "OK" || !json.result?.geometry?.location) return null;

  const { lat, lng } = json.result.geometry.location;
  return {
    latitude: lat,
    longitude: lng,
    display_name: json.result.formatted_address ?? placeId,
    precision: "google_places",
    source: "google_places",
  };
}

export async function geocodeClinics(clinics, options = {}) {
  const {
    onProgress,
    googleApiKey,
    locationIqApiKey,
    saveEvery,
    useNominatim = true,
    preferLocationIq = false,
    googleOnly = false,
    minIntervalMs = 2500,
    maxQueries = 3,
    googleDelayMs = 150,
    limit = Infinity,
    fixBad = false,
    force = false,
  } = options;

  let geocoded = 0;
  let failed = 0;
  let skipped = 0;
  let googleFilled = 0;
  let locationIqFilled = 0;
  let cleared = 0;
  let processed = 0;
  let attempted = 0;
  let rateLimitPauses = 0;

  const providerOpts = {
    minIntervalMs,
    maxQueries,
    googleApiKey,
    locationIqApiKey,
    useNominatim,
    preferLocationIq,
    onRateLimit(waitMs, attempt) {
      rateLimitPauses++;
      onProgress?.({ phase: "rate_limit", waitMs, attempt });
    },
  };

  for (const clinic of clinics) {
    const hasCoords = clinic.latitude != null && clinic.longitude != null;

    if (hasCoords) {
      if (fixBad && isBadGeocode(clinic)) {
        clearGeocodeFields(clinic);
        cleared++;
      } else if (force) {
        clearGeocodeFields(clinic);
        cleared++;
      } else {
        skipped++;
        continue;
      }
    }

    if (attempted >= limit) break;
    attempted++;

    const label = clinic.name || "Unknown clinic";
    onProgress?.({ phase: "start", clinic, label });

    if (!clinic.address && !clinic.name && !clinic.google_place_id && !clinic.google_maps_url) {
      onProgress?.({ phase: "fail", clinic, label, reason: "no address or name" });
      failed++;
      processed++;
      continue;
    }

    try {
      let result = null;

      if (googleOnly && googleApiKey) {
        const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
        if (placeId) {
          result = await googlePlaceCoords(placeId, googleApiKey);
          if (result) googleFilled++;
          await sleep(googleDelayMs);
        }
      } else if (!googleOnly && (useNominatim || locationIqApiKey)) {
        result = await geocodeClinic(clinic, providerOpts);
        if (result?.source === "google_places") googleFilled++;
        if (result?.source === "locationiq") locationIqFilled++;
      }

      if (!result && googleApiKey) {
        const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
        if (placeId) {
          result = await googlePlaceCoords(placeId, googleApiKey);
          if (result) googleFilled++;
          await sleep(googleDelayMs);
        }
      }

      if (result) {
        clinic.latitude = result.latitude;
        clinic.longitude = result.longitude;
        clinic.geocoded_from = result.display_name;
        clinic.geocode_precision = result.precision;
        clinic.geocode_source = result.source;
        geocoded++;
        onProgress?.({ phase: "ok", clinic, label, result });
      } else {
        failed++;
        onProgress?.({ phase: "fail", clinic, label, reason: "not found" });
      }
    } catch (err) {
      if (String(err.message).includes("429")) {
        onProgress?.({
          phase: "fail",
          clinic,
          label,
          reason: "rate limited — wait 10 min and re-run (progress is saved)",
        });
        if (saveEvery) onProgress?.({ phase: "save", clinic, label, processed });
        throw err;
      }
      failed++;
      onProgress?.({ phase: "fail", clinic, label, reason: err.message });
    }

    processed++;
    if (saveEvery && processed % saveEvery === 0) {
      onProgress?.({ phase: "save", clinic, label, processed });
    }

    if (!googleOnly && (useNominatim || locationIqApiKey)) {
      await sleep(locationIqApiKey && preferLocationIq ? 550 : minIntervalMs);
    } else if (googleApiKey) {
      await sleep(googleDelayMs);
    }
  }

  return { geocoded, failed, skipped, googleFilled, locationIqFilled, cleared, rateLimitPauses };
}
