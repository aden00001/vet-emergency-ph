import { isHumanBiteCenter } from "@/lib/clinic-exclusions";

export interface MergedClinic {
  name: string;
  address: string | null;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  emergency_capable: boolean;
  owner_verified: boolean;
  services: string[];
  hours: string | null;
  source: string;
  google_maps_url?: string;
  google_place_id?: string;
  image_url?: string;
  category?: string;
  website?: string;
  rating?: number;
  review_count?: number;
}

export interface MergeFileResult {
  fileName: string;
  format: "apify" | "outscraper" | "parsed";
  clinics: MergedClinic[];
  excludedBite: number;
  excludedOther: number;
  error?: string;
}

export interface MergeSummary {
  files: MergeFileResult[];
  clinics: MergedClinic[];
  totalLoaded: number;
  totalBiteExcluded: number;
  postBiteRemoved: number;
  uniqueCount: number;
  emergencyCount: number;
  withCoordinates: number;
  payload: {
    scraped_at: string;
    region: string;
    source: string;
    input_files: string[];
    count: number;
    emergency_count: number;
    with_coordinates: number;
    notes: string[];
    clinics: MergedClinic[];
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

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

function normalizePhone(raw: unknown): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  if (digits.length >= 8 && digits.length <= 11) return `+63${digits.replace(/^0/, "")}`;
  return "";
}

function extractPlaceId(url?: string, explicitId?: string): string | null {
  if (explicitId) return explicitId;
  const chij = url?.match(/query_place_id=([^&]+)/);
  if (chij) return decodeURIComponent(chij[1]);
  const placeParam = url?.match(/place_id[=:]([A-Za-z0-9_-]+)/i);
  if (placeParam) return placeParam[1];
  const hex = url?.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return hex ? hex[1].toLowerCase() : null;
}

function extractCoordsFromUrl(url?: string) {
  const m = url?.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  const at = url?.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { latitude: parseFloat(at[1]), longitude: parseFloat(at[2]) };
  return null;
}

function formatHours(hours: unknown): string | null {
  if (!hours) return null;
  if (Array.isArray(hours)) {
    return hours
      .map((h: { day?: string; hours?: string | string[] }) => {
        const slot = Array.isArray(h.hours) ? h.hours.join(", ") : h.hours;
        return h.day ? `${h.day}: ${slot}` : slot;
      })
      .join("; ");
  }
  return String(hours);
}

function cleanGoogleMapsName(name: string): string {
  return name
    .replace(/\s+[|lI]\s+(Quezon City|Manila|Metro Manila|Makati|Taguig|Pasig)[^]*$/i, "")
    .replace(/\s+\|\s+/g, " — ")
    .trim();
}

function isVetRelevant(name: string, category: string): boolean {
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

function inferEmergency(name: string, category: string): boolean {
  const text = `${name} ${category}`.toLowerCase();
  if (isHumanBiteCenter(name, category)) return false;
  return /open 24 hours|24\s*\/\s*7|24 hrs|24 hour|on call emergency|emergency veterinarian|pet emergency/i.test(
    text
  );
}

function buildAddress(row: JsonValue): string {
  if (row.address) return String(row.address).replace(/\s+/g, " ").trim();
  if (row.full_address) return String(row.full_address).replace(/\s+/g, " ").trim();
  const parts = [row.street, row.city, row.state].filter(Boolean);
  return parts.join(", ").replace(/\s+/g, " ").trim();
}

function resolveCoords(row: JsonValue, address: string) {
  if (row.location?.lat != null && row.location?.lng != null) {
    return { latitude: row.location.lat as number, longitude: row.location.lng as number };
  }

  let latitude = row.latitude ?? row.lat ?? null;
  let longitude = row.longitude ?? row.lng ?? row.lon ?? null;
  if (latitude != null && longitude != null) {
    return { latitude: latitude as number, longitude: longitude as number };
  }

  const url = row.url || row.link || row.google_maps_url || "";
  const fromUrl = extractCoordsFromUrl(url);
  if (fromUrl) return fromUrl;

  return { latitude: null, longitude: null };
}

function parseScrapeRow(row: JsonValue): MergedClinic | null {
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
  const placeId = row.placeId || row.place_id;
  const google_place_id = extractPlaceId(mapsUrl, placeId) ?? undefined;
  const hoursText = formatHours(row.openingHours ?? row.hours ?? row.open_hours);
  const emergency_capable = inferEmergency(`${name} ${hoursText ?? ""}`, category);
  const { latitude, longitude } = resolveCoords(row, address);

  return {
    name,
    address: address || null,
    phone: normalizePhone(row.phone ?? row.phoneUnformatted),
    latitude,
    longitude,
    emergency_capable,
    owner_verified: false,
    services: emergency_capable ? ["trauma", "poisoning", "respiratory"] : ["trauma"],
    hours: hoursText,
    source: "google_maps_scrape",
    google_maps_url: mapsUrl || undefined,
    google_place_id,
    image_url: row.photo ?? row.mainPhoto ?? row.image ?? row.heroPhotoUrl ?? undefined,
    category,
    website: row.website || undefined,
    rating: row.totalScore ?? row.rating ?? undefined,
    review_count: row.reviewsCount ?? row.reviews_count ?? row.reviewCount ?? undefined,
  };
}

function extractScrapeRows(raw: JsonValue): JsonValue[] {
  if (Array.isArray(raw)) return raw;
  return raw.results ?? raw.data ?? raw.places ?? raw.items ?? [];
}

function isGoogleMapsScrapeExport(raw: JsonValue): boolean {
  const rows = extractScrapeRows(raw);
  if (!rows.length) return false;
  const first = rows[0];
  const rowName = first?.title || first?.name;
  return Boolean(
    rowName &&
      (first?.categoryName ||
        first?.category ||
        first?.categories ||
        first?.url ||
        first?.placeId ||
        first?.place_id ||
        first?.location)
  );
}

function isParsedClinicsExport(raw: JsonValue): boolean {
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.categoryName || first?.categories || first?.placeId || first?.location) {
      return false;
    }
    return Boolean(first?.name && !first?.title);
  }
  return Array.isArray(raw.clinics) && raw.clinics.length > 0 && Boolean(raw.clinics[0]?.name);
}

function scrapeExportFormat(rows: JsonValue[]): MergeFileResult["format"] {
  const first = rows[0] ?? {};
  if (first.location?.lat != null || first.placeId) return "apify";
  return "outscraper";
}

function parseScrapeRows(rows: JsonValue[]) {
  let excludedBite = 0;
  let excludedOther = 0;
  const parsed: MergedClinic[] = [];

  for (const row of rows) {
    const rowName = row.title || row.name || "";
    const category =
      row.categoryName ||
      row.category ||
      (row.categories ?? []).join(", ") ||
      "";
    if (isHumanBiteCenter(rowName, category)) {
      excludedBite++;
      continue;
    }
    const clinic = parseScrapeRow(row);
    if (clinic) parsed.push(clinic);
    else excludedOther++;
  }

  return { clinics: parsed, excludedBite, excludedOther };
}

function filterBiteCenters(clinics: MergedClinic[]) {
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

function isSameLocation(a: MergedClinic, b: MergedClinic): boolean {
  if (a.latitude == null || b.latitude == null) return false;
  return (
    Math.abs(a.latitude - b.latitude) < 0.0008 &&
    Math.abs(a.longitude! - b.longitude!) < 0.0008
  );
}

function normName(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mergeClinicFields(dupe: MergedClinic, c: MergedClinic) {
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

export function dedupeClinics(clinics: MergedClinic[]): MergedClinic[] {
  const kept: MergedClinic[] = [];
  for (const c of clinics) {
    const dupe = kept.find(
      (k) =>
        (c.google_place_id && k.google_place_id === c.google_place_id) ||
        (normName(k.name) === normName(c.name) &&
          (isSameLocation(k, c) || k.latitude == null || c.latitude == null)) ||
        (normName(k.name) === normName(c.name) && k.address && c.address && k.address === c.address)
    );
    if (!dupe) kept.push(c);
    else mergeClinicFields(dupe, c);
  }
  return kept;
}

export function loadClinicsFromJson(fileName: string, raw: JsonValue): MergeFileResult {
  if (isGoogleMapsScrapeExport(raw)) {
    const rows = extractScrapeRows(raw);
    const { clinics, excludedBite, excludedOther } = parseScrapeRows(rows);
    return {
      fileName,
      format: scrapeExportFormat(rows),
      clinics,
      excludedBite,
      excludedOther,
    };
  }

  if (isParsedClinicsExport(raw)) {
    const clinics = Array.isArray(raw) ? raw : raw.clinics;
    const { clinics: filtered, removed } = filterBiteCenters(clinics);
    return {
      fileName,
      format: "parsed",
      clinics: filtered,
      excludedBite: removed,
      excludedOther: 0,
    };
  }

  return {
    fileName,
    format: "outscraper",
    clinics: [],
    excludedBite: 0,
    excludedOther: 0,
    error: "Unrecognized JSON format (expected Apify/Outscraper JSON or { clinics: [...] })",
  };
}

export async function mergeUploadedFiles(files: File[]): Promise<MergeSummary> {
  const fileResults: MergeFileResult[] = [];
  let allClinics: MergedClinic[] = [];

  for (const file of files) {
    const text = await file.text();
    let raw: JsonValue;
    try {
      raw = JSON.parse(text);
    } catch {
      fileResults.push({
        fileName: file.name,
        format: "outscraper",
        clinics: [],
        excludedBite: 0,
        excludedOther: 0,
        error: "Invalid JSON",
      });
      continue;
    }
    const result = loadClinicsFromJson(file.name, raw);
    fileResults.push(result);
    if (!result.error) allClinics.push(...result.clinics);
  }

  const { clinics: withoutBites, removed: postBiteRemoved } = filterBiteCenters(allClinics);
  const clinics = dedupeClinics(withoutBites).sort((a, b) => a.name.localeCompare(b.name));

  const inputFiles = files.map((f) => f.name);
  const totalLoaded = fileResults.reduce((n, s) => n + s.clinics.length, 0);
  const totalBiteExcluded = fileResults.reduce((n, s) => n + s.excludedBite, 0);

  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Philippines (merged Google Maps exports)",
    source: "google_maps_scrape",
    input_files: inputFiles,
    count: clinics.length,
    emergency_count: clinics.filter((c) => c.emergency_capable).length,
    with_coordinates: clinics.filter((c) => c.latitude != null).length,
    notes: [
      "Merged from multiple JSON uploads. Review before treating emergency_capable as verified.",
      "Excluded: human bite centers (anti-rabies / PEP clinics for people).",
    ],
    clinics,
  };

  return {
    files: fileResults,
    clinics,
    totalLoaded,
    totalBiteExcluded,
    postBiteRemoved,
    uniqueCount: clinics.length,
    emergencyCount: payload.emergency_count,
    withCoordinates: payload.with_coordinates,
    payload,
  };
}

export function downloadMergedJson(payload: MergeSummary["payload"], fileName = "clinics-merged.json") {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
