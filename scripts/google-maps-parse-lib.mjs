/**
 * Shared Google Maps / Outscraper → clinic record parsing.
 */

import { isHumanBiteCenter } from "./clinic-exclusions.mjs";
import { decodePlusCode, extractPlusCode } from "./geocode-lib.mjs";

const SKIP_CATEGORIES = [
  "pet groomer",
  "pet funeral",
  "pet store",
  "department store",
  "government office",
  "government",
  "general practitioner",
  "college",
  "university",
  "importer",
  "medical laboratory",
  "laboratory",
];

const SKIP_NAME = [
  /pet funeral/i,
  /aftercare/i,
  /aquamation/i,
  /paws to heaven/i,
  /precious paws aftercare/i,
  /^bureau of animal industry/i,
  /quarantine services/i,
  /veterinary department$/i,
  /animal health and welfare division/i,
  /^DR Animal Bite Clinic$/i,
  /prime animal bite clinic/i,
  /wecare animal bite clinic/i,
  /^dr\.?\s+mayem yao$/i,
  /college of veterinary/i,
  /veterinary medical association$/i,
  /retail veterinary medicines/i,
  /philippine college of canine/i,
];

export function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  if (digits.length >= 8 && digits.length <= 11) return `+63${digits.replace(/^0/, "")}`;
  return "";
}

export function extractPlaceId(url) {
  const chij = url?.match(/query_place_id=([^&]+)/);
  if (chij) return decodeURIComponent(chij[1]);
  const hex = url?.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return hex ? hex[1].toLowerCase() : null;
}

export function cleanGoogleMapsName(name) {
  return name
    .replace(/\s+[|lI]\s+(Quezon City|Manila|Metro Manila|Makati|Taguig|Pasig)[^]*$/i, "")
    .replace(/\s+\|\s+/g, " — ")
    .trim();
}

export function isVetRelevant(name, category) {
  const text = `${name} ${category}`.toLowerCase();
  if (SKIP_NAME.some((re) => re.test(name))) return false;
  if (isHumanBiteCenter(name, category)) return false;
  if (SKIP_CATEGORIES.some((s) => category.toLowerCase().includes(s))) {
    if (!/vet|veterinar|animal hospital|animal clinic|emergency|911|pet clinic/i.test(text)) {
      return false;
    }
  }
  return /vet|veterinar|animal|pet clinic|emergency|911|paw|medical center/i.test(text);
}

export function inferEmergency(name, category) {
  const text = `${name} ${category}`.toLowerCase();
  if (isHumanBiteCenter(name, category)) return false;
  return /open 24 hours|24\s*\/\s*7|24 hrs|24 hour|on call emergency|emergency veterinarian|pet emergency/i.test(
    text
  );
}

export function buildAddress(row) {
  if (row.full_address) return String(row.full_address).replace(/\s+/g, " ").trim();
  const parts = [row.street, row.city, row.state].filter(Boolean);
  return parts.join(", ").replace(/\s+/g, " ").trim();
}

function extractCoordsFromUrl(url) {
  const m = url?.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  const at = url?.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { latitude: parseFloat(at[1]), longitude: parseFloat(at[2]) };
  return null;
}

function resolveCoords(row, address) {
  let latitude = row.latitude ?? row.lat ?? null;
  let longitude = row.longitude ?? row.lng ?? row.lon ?? null;
  if (latitude != null && longitude != null) return { latitude, longitude };

  const url = row.url || row.link || row.google_maps_url || "";
  const fromUrl = extractCoordsFromUrl(url);
  if (fromUrl) return fromUrl;

  const plusCode = row.plus_code || extractPlusCode(address);
  if (plusCode) {
    const decoded = decodePlusCode(String(plusCode).toUpperCase());
    if (decoded) return { latitude: decoded.latitude, longitude: decoded.longitude };
  }

  return { latitude: null, longitude: null };
}

export function parseOutscraperRow(row) {
  const name = cleanGoogleMapsName(row.title?.trim() || row.name?.trim() || "");
  if (!name) return null;

  const category =
    row.categoryName ||
    row.category ||
    row.type ||
    (row.categories ?? []).join(", ") ||
    "";
  if (!isVetRelevant(name, category)) return null;

  const address = buildAddress(row);
  const mapsUrl = row.url || row.link || row.google_maps_url || "";
  const google_place_id = row.place_id || extractPlaceId(mapsUrl);
  const emergency_capable = inferEmergency(name, category);
  const { latitude, longitude } = resolveCoords(row, address);

  return {
    name,
    address: address || null,
    phone: normalizePhone(row.phone),
    latitude,
    longitude,
    emergency_capable,
    owner_verified: false,
    services: emergency_capable ? ["trauma", "poisoning", "respiratory"] : ["trauma"],
    hours: row.openingHours ?? row.hours ?? null,
    source: "google_maps_scrape",
    google_maps_url: mapsUrl || undefined,
    google_place_id: google_place_id || undefined,
    image_url: row.photo ?? row.mainPhoto ?? row.image ?? undefined,
    category,
    website: row.website || undefined,
    rating: row.totalScore ?? undefined,
    review_count: row.reviewsCount ?? row.reviews ?? undefined,
  };
}

function isSameLocation(a, b) {
  if (a.latitude == null || b.latitude == null) return false;
  return (
    Math.abs(a.latitude - b.latitude) < 0.0008 &&
    Math.abs(a.longitude - b.longitude) < 0.0008
  );
}

function normName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mergeClinic(dupe, c) {
  if (c.phone && !dupe.phone) dupe.phone = c.phone;
  if (c.emergency_capable) dupe.emergency_capable = true;
  if (c.hours && (!dupe.hours || String(c.hours).length > String(dupe.hours).length)) {
    dupe.hours = c.hours;
  }
  if (c.image_url && !dupe.image_url) dupe.image_url = c.image_url;
  if (c.address && c.address.length > (dupe.address?.length ?? 0)) dupe.address = c.address;
  if (c.name.length > dupe.name.length) dupe.name = c.name;
  if (c.website && !dupe.website) dupe.website = c.website;
  if (c.google_place_id && !dupe.google_place_id) dupe.google_place_id = c.google_place_id;
  if (c.latitude != null && dupe.latitude == null) {
    dupe.latitude = c.latitude;
    dupe.longitude = c.longitude;
  }
}

export function dedupeClinics(clinics) {
  const kept = [];
  for (const c of clinics) {
    const dupe = kept.find(
      (k) =>
        (c.google_place_id && k.google_place_id === c.google_place_id) ||
        (normName(k.name) === normName(c.name) &&
          (isSameLocation(k, c) || k.latitude == null || c.latitude == null)) ||
        (normName(k.name) === normName(c.name) && k.address && c.address && k.address === c.address)
    );
    if (!dupe) kept.push(c);
    else mergeClinic(dupe, c);
  }
  return kept;
}

export function extractOutscraperRows(raw) {
  if (Array.isArray(raw)) return raw;
  return raw.results ?? raw.data ?? [];
}

export function isOutscraperExport(raw) {
  const rows = extractOutscraperRows(raw);
  if (!rows.length) return false;
  const first = rows[0];
  return Boolean(first?.title && (first?.categoryName || first?.categories || first?.url));
}

export function isParsedClinicsExport(raw) {
  if (Array.isArray(raw)) {
    const first = raw[0];
    return Boolean(first?.name && !first?.title);
  }
  return Array.isArray(raw.clinics) && raw.clinics.length > 0 && Boolean(raw.clinics[0]?.name);
}

export function parseOutscraperRows(rows) {
  let excludedBite = 0;
  let excludedOther = 0;
  const parsed = [];

  for (const row of rows) {
    const category = row.categoryName || (row.categories ?? []).join(", ") || "";
    if (isHumanBiteCenter(row.title, category)) {
      excludedBite++;
      continue;
    }
    const clinic = parseOutscraperRow(row);
    if (clinic) parsed.push(clinic);
    else excludedOther++;
  }

  return { clinics: parsed, excludedBite, excludedOther };
}

export function filterBiteCenters(clinics) {
  let removed = 0;
  const kept = clinics.filter((c) => {
    if (isHumanBiteCenter(c.name, c.category)) {
      removed++;
      return false;
    }
    return true;
  });
  return { clinics: kept, removed };
}
