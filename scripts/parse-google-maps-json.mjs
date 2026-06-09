/**
 * Parse Outscraper / Google Maps JSON export → clinics JSON for import.
 *
 * Usage:
 *   node scripts/parse-google-maps-json.mjs "path/to/export.json"
 *   node scripts/parse-google-maps-json.mjs data/metro-manila-outscraper.json --geocode
 *   node scripts/parse-google-maps-json.mjs data/metro-manila-outscraper.json --geocode --import
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "clinics-google-maps.json");

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
const doImport = args.includes("--import");
const doGeocode = args.includes("--geocode");
const mergeExisting = !args.includes("--no-merge");
const outPath = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? DEFAULT_OUT;

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

function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  if (digits.length >= 8 && digits.length <= 11) return `+63${digits.replace(/^0/, "")}`;
  return "";
}

function extractPlaceId(url) {
  const chij = url?.match(/query_place_id=([^&]+)/);
  if (chij) return decodeURIComponent(chij[1]);
  const hex = url?.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return hex ? hex[1].toLowerCase() : null;
}

function cleanGoogleMapsName(name) {
  return name
    .replace(/\s+[|lI]\s+(Quezon City|Manila|Metro Manila|Makati|Taguig|Pasig)[^]*$/i, "")
    .replace(/\s+\|\s+/g, " — ")
    .trim();
}

function isVetRelevant(name, category) {
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

function inferEmergency(name, category) {
  const text = `${name} ${category}`.toLowerCase();
  if (isHumanBiteCenter(name, category)) return false;
  return /open 24 hours|24\s*\/\s*7|24 hrs|24 hour|on call emergency|emergency veterinarian|pet emergency/i.test(
    text
  );
}

function buildAddress(row) {
  const parts = [row.street, row.city, row.state].filter(Boolean);
  return parts.join(", ").replace(/\s+/g, " ").trim();
}

function parseRow(row) {
  const name = cleanGoogleMapsName(row.title?.trim() || "");
  if (!name) return null;

  const category = row.categoryName || (row.categories ?? []).join(", ") || "";
  if (!isVetRelevant(name, category)) return null;

  const address = buildAddress(row);
  const google_place_id = extractPlaceId(row.url);
  const emergency_capable = inferEmergency(name, category);

  return {
    name,
    address: address || null,
    phone: normalizePhone(row.phone),
    latitude: row.latitude ?? row.lat ?? null,
    longitude: row.longitude ?? row.lng ?? row.lon ?? null,
    emergency_capable,
    owner_verified: false,
    services: emergency_capable ? ["trauma", "poisoning", "respiratory"] : ["trauma"],
    hours: row.openingHours ?? row.hours ?? null,
    source: "google_maps_scrape",
    google_maps_url: row.url?.split("?")[0] || undefined,
    google_place_id: google_place_id || undefined,
    image_url: row.photo ?? row.mainPhoto ?? row.image ?? undefined,
    category,
    website: row.website || undefined,
    rating: row.totalScore ?? undefined,
    review_count: row.reviewsCount ?? undefined,
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

function dedupe(clinics) {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(address, fallbackName) {
  for (const query of [address, fallbackName].filter(Boolean)) {
    const q = encodeURIComponent(`${query}, Philippines`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ph`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VetEmergency.ph/1.0 (local dev; geocoding for vet directory)",
      },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const results = await res.json();
    if (results.length) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
        display_name: results[0].display_name,
      };
    }
    if (query !== fallbackName) await sleep(1100);
  }
  return null;
}

async function geocodeClinics(clinics) {
  let geocoded = 0;
  let failed = 0;

  for (const clinic of clinics) {
    if (clinic.latitude != null && clinic.longitude != null) continue;
    if (!clinic.address) {
      console.warn(`  No address to geocode: ${clinic.name}`);
      failed++;
      continue;
    }

    process.stdout.write(`Geocoding: ${clinic.name} ... `);
    try {
      const fallback = `${clinic.name}, Metro Manila`;
      const result = await geocode(clinic.address, fallback);
      if (result) {
        clinic.latitude = result.latitude;
        clinic.longitude = result.longitude;
        clinic.geocoded_from = result.display_name;
        geocoded++;
        console.log(`${result.latitude}, ${result.longitude}`);
      } else {
        failed++;
        console.log("NOT FOUND");
      }
    } catch (err) {
      failed++;
      console.log(`ERROR (${err.message})`);
    }
    await sleep(1100);
  }

  return { geocoded, failed };
}

async function main() {
  if (!inputPath) {
    console.error("Usage: node scripts/parse-google-maps-json.mjs <export.json> [--geocode] [--import]");
    process.exit(1);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.results ?? raw.data ?? [];

  let excludedBite = 0;
  let excludedOther = 0;
  const parsed = [];

  for (const row of rows) {
    const category = row.categoryName || (row.categories ?? []).join(", ") || "";
    if (isHumanBiteCenter(row.title, category)) {
      excludedBite++;
      continue;
    }
    const clinic = parseRow(row);
    if (clinic) parsed.push(clinic);
    else excludedOther++;
  }

  let existing = [];
  if (mergeExisting && fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
    existing = prev.clinics ?? [];
  }

  let clinics = dedupe([...existing, ...parsed]).sort((a, b) => a.name.localeCompare(b.name));

  let geocodeStats = null;
  if (doGeocode) {
    console.log(`Geocoding clinics missing coordinates (${clinics.filter((c) => c.latitude == null).length} to try)...`);
    geocodeStats = await geocodeClinics(clinics);
    clinics = dedupe(clinics).sort((a, b) => a.name.localeCompare(b.name));
  }

  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Metro Manila (Google Maps export)",
    source: "google_maps_scrape",
    input_file: path.basename(inputPath),
    count: clinics.length,
    emergency_count: clinics.filter((c) => c.emergency_capable).length,
    with_coordinates: clinics.filter((c) => c.latitude != null).length,
    notes: [
      "Parsed from Google Maps JSON export (Outscraper-style). Review before treating emergency_capable as verified.",
      "Excluded: human bite centers, pet groomers-only, funeral services, most government offices.",
      mergeExisting ? "Merged with previous clinics-google-maps.json; duplicates removed." : "",
    ].filter(Boolean),
    clinics,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(
    `\nParsed ${parsed.length} from input (${excludedBite} bite centers excluded, ${excludedOther} non-vet skipped)`
  );
  if (mergeExisting) console.log(`Merged with ${existing.length} existing → ${clinics.length} unique clinics`);
  if (geocodeStats) {
    console.log(`Geocoded ${geocodeStats.geocoded}, failed ${geocodeStats.failed}`);
  }
  console.log(
    `${payload.emergency_count} emergency-capable, ${payload.with_coordinates} with coordinates`
  );
  console.log(`Wrote ${outPath}`);

  if (doImport) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "import-clinics.mjs"), `--file=${outPath}`, "--upsert"],
      { stdio: "inherit", cwd: ROOT }
    );
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
