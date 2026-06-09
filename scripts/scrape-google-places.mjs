/**
 * Fetch vet clinics via official Google Places API (not HTML scraping).
 * Includes 24/7 AND normal business-hours clinics. Excludes human bite centers.
 *
 * Setup:
 *   GOOGLE_PLACES_API_KEY=... in .env.local
 *
 * Usage:
 *   node scripts/scrape-google-places.mjs
 *   node scripts/scrape-google-places.mjs --import
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "data", "clinics-google-places.json");

const NCR = { south: 14.35, west: 120.85, north: 14.75, east: 121.15 };

const SEARCH_QUERIES = [
  // General / business-hours clinics
  "veterinary clinic Metro Manila",
  "veterinarian Quezon City",
  "veterinary clinic Makati",
  "veterinary clinic Pasig",
  "veterinary clinic Taguig",
  "veterinary clinic Manila",
  "veterinary clinic Marikina",
  "veterinary clinic Parañaque",
  "veterinary clinic Caloocan",
  "veterinary clinic Mandaluyong",
  "veterinary clinic Las Piñas",
  "veterinary clinic Muntinlupa",
  "veterinary clinic Valenzuela",
  "pet clinic NCR",
  "animal clinic Metro Manila",
  // Emergency / 24h (still included)
  "24 hour veterinary clinic Metro Manila",
  "emergency vet clinic Quezon City",
  "animal hospital Makati",
];

const VET_PLACE_TYPES = new Set([
  "veterinary_care",
  "pet_store", // kept only when name is clearly vet — filtered below
]);

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const doImport = process.argv.includes("--import");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  return raw.trim();
}

function isVetPlace(name, types = []) {
  const text = `${name} ${types.join(" ")}`.toLowerCase();
  if (isHumanBiteCenter(name, types.join(" "))) return false;
  if (/veterinar|animal hospital|animal clinic|pet clinic|vet clinic|vet 911|beterinaryo|emergency vet/i.test(text)) {
    return true;
  }
  if (types.some((t) => VET_PLACE_TYPES.has(t))) {
    return /vet|veterinar|animal|pet clinic|beterinaryo/i.test(text);
  }
  return false;
}

function inferEmergencyFromHours(name, hoursText) {
  const text = `${name} ${hoursText}`.toLowerCase();
  if (isHumanBiteCenter(name)) return false;
  return /open 24 hours|24\s*\/\s*7|24 hour|24 hrs|open 24\/7|always open/i.test(text);
}

function inferServices(emergency) {
  return emergency
    ? ["trauma", "poisoning", "respiratory"]
    : ["trauma"];
}

function inNcr(lat, lng) {
  return lat >= NCR.south && lat <= NCR.north && lng >= NCR.west && lng <= NCR.east;
}

async function textSearch(query, key) {
  const results = [];
  let pageToken = null;

  for (let page = 0; page < 3; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", query);
    url.searchParams.set("region", "ph");
    url.searchParams.set("key", key);
    if (pageToken) url.searchParams.set("pagetoken", pageToken);

    const res = await fetch(url);
    const json = await res.json();

    if (json.status === "INVALID_REQUEST" && pageToken) {
      await sleep(2000);
      continue;
    }
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.warn(`Places (${query}): ${json.status} — ${json.error_message || ""}`);
      break;
    }

    results.push(...(json.results ?? []));
    pageToken = json.next_page_token;
    if (!pageToken) break;
    await sleep(2200);
  }

  return results;
}

async function placeDetails(placeId, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "name,formatted_address,formatted_phone_number,geometry,opening_hours,types,website,business_status"
  );
  url.searchParams.set("key", key);

  const res = await fetch(url);
  const json = await res.json();
  return json.result ?? null;
}

async function main() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.error(
      "Missing GOOGLE_PLACES_API_KEY in .env.local\n\n" +
        "We cannot scrape Google Maps HTML (violates Google ToS).\n" +
        "Options:\n" +
        "  1. Add GOOGLE_PLACES_API_KEY and run: npm run scrape:google-places\n" +
        "  2. Export a CSV from Maps and run: npm run parse:google-maps:import\n" +
        "  3. Use OSM data: npm run scrape:clinics && npm run import:clinics:osm"
    );
    process.exit(1);
  }

  const seen = new Set();
  const clinics = [];

  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: ${query}`);
    const places = await textSearch(query, key);

    for (const place of places) {
      if (seen.has(place.place_id)) continue;
      if (!isVetPlace(place.name, place.types ?? [])) continue;

      seen.add(place.place_id);
      const lat = place.geometry?.location?.lat;
      const lng = place.geometry?.location?.lng;
      if (lat == null || lng == null || !inNcr(lat, lng)) continue;

      clinics.push({
        place_id: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity || "",
        phone: "",
        latitude: lat,
        longitude: lng,
        emergency_capable: false,
        owner_verified: false,
        services: ["trauma"],
        hours: null,
        source: "google_places",
      });
    }
    await sleep(400);
  }

  console.log(`Enriching ${clinics.length} places with phone & hours…`);

  for (const clinic of clinics) {
    const details = await placeDetails(clinic.place_id, key);
    if (!details) continue;
    if (details.business_status === "CLOSED_PERMANENTLY") {
      clinic._closed = true;
    }
    if (isHumanBiteCenter(details.name ?? clinic.name, (details.types ?? []).join(" "))) {
      clinic._exclude = true;
      continue;
    }
    clinic.name = details.name ?? clinic.name;
    clinic.address = details.formatted_address || clinic.address;
    clinic.phone = normalizePhone(details.formatted_phone_number || "");
    if (details.opening_hours?.weekday_text?.length) {
      clinic.hours = details.opening_hours.weekday_text.join("; ");
    } else if (details.opening_hours?.open_now != null) {
      clinic.hours = details.opening_hours.open_now ? "Open now" : "Closed now";
    }
    clinic.emergency_capable = inferEmergencyFromHours(clinic.name, clinic.hours ?? "");
    clinic.services = inferServices(clinic.emergency_capable);
    clinic.website = details.website || null;
    await sleep(120);
  }

  const filtered = clinics
    .filter((c) => !c._exclude && !c._closed)
    .map(({ place_id, _exclude, _closed, ...rest }) => ({
      ...rest,
      google_place_id: place_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Metro Manila (Google Places API)",
    source: "google_places",
    count: filtered.length,
    emergency_count: filtered.filter((c) => c.emergency_capable).length,
    business_hours_count: filtered.filter((c) => !c.emergency_capable).length,
    notes: [
      "Official Google Places API — not HTML scraping.",
      "Human animal-bite / anti-rabies centers excluded.",
      "emergency_capable is inferred from 24/7 hours text only — review before production.",
    ],
    clinics: filtered,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(
    `\nWrote ${filtered.length} clinics (${payload.emergency_count} 24/7, ${payload.business_hours_count} normal hours) → ${OUT_FILE}`
  );

  if (doImport) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "import-clinics.mjs"), `--file=${OUT_FILE}`, "--upsert"],
      { stdio: "inherit", cwd: ROOT }
    );
    process.exit(r.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
