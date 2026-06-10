/**
 * Geocode clinic addresses via Nominatim (OpenStreetMap) with fallbacks.
 * Optional Google Places lookup by place_id when Nominatim fails or is skipped.
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

export async function geocodeClinic(clinic, options = {}) {
  const rawAddress = (clinic.address || "").trim();
  const nominatimOpts = {
    minIntervalMs: options.minIntervalMs ?? 2500,
    onRateLimit: options.onRateLimit,
  };

  const plusCode = extractPlusCode(rawAddress);
  if (plusCode) {
    const direct = decodePlusCode(plusCode);
    if (direct) return direct;

    const { city, province } = parseAddressParts(rawAddress);
    if (city && province) {
      const cityRef = await geocodeQuery(`${city}, ${province}, Philippines`, nominatimOpts);
      if (cityRef) {
        const decoded = decodePlusCode(plusCode, cityRef.latitude, cityRef.longitude);
        if (decoded) {
          decoded.display_name = `${plusCode}, ${city}, ${province}`;
          return decoded;
        }
      }
    }
  }

  const queries = geocodeQueries(clinic, options.maxQueries ?? 3);
  for (const query of queries) {
    const result = await geocodeQuery(query, nominatimOpts);
    if (result) return result;
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
    saveEvery,
    useNominatim = true,
    googleOnly = false,
    minIntervalMs = 2500,
    maxQueries = 3,
    googleDelayMs = 150,
    limit = Infinity,
  } = options;

  let geocoded = 0;
  let failed = 0;
  let skipped = 0;
  let googleFilled = 0;
  let processed = 0;
  let attempted = 0;
  let rateLimitPauses = 0;

  const nominatimOpts = {
    minIntervalMs,
    maxQueries,
    onRateLimit(waitMs, attempt) {
      rateLimitPauses++;
      onProgress?.({ phase: "rate_limit", waitMs, attempt });
    },
  };

  for (const clinic of clinics) {
    if (clinic.latitude != null && clinic.longitude != null) {
      skipped++;
      continue;
    }

    if (attempted >= limit) break;
    attempted++;

    const label = clinic.name || "Unknown clinic";
    onProgress?.({ phase: "start", clinic, label });

    if (!clinic.address && !clinic.name && !clinic.google_place_id) {
      onProgress?.({ phase: "fail", clinic, label, reason: "no address or name" });
      failed++;
      processed++;
      continue;
    }

    try {
      let result = null;

      if (!googleOnly && useNominatim) {
        result = await geocodeClinic(clinic, nominatimOpts);
      }

      if (!result && googleApiKey && clinic.google_place_id) {
        result = await googlePlaceCoords(clinic.google_place_id, googleApiKey);
        if (result) googleFilled++;
        await sleep(googleDelayMs);
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

    if (!googleOnly && useNominatim) {
      await sleep(minIntervalMs);
    } else if (googleApiKey) {
      await sleep(googleDelayMs);
    }
  }

  return { geocoded, failed, skipped, googleFilled, rateLimitPauses };
}
