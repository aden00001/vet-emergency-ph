/**
 * Scrape veterinary clinics in Metro Manila (NCR) from OpenStreetMap via Overpass API.
 *
 * Why Overpass (not raw Google Maps scraping)?
 * - Google Maps HTML scraping violates Google's ToS and breaks often.
 * - Overpass/OSM is free, legal, and returns lat/lng + phone when mappers added them.
 * - Optional: Google Places API (official) if GOOGLE_PLACES_API_KEY is set — see scrapeGooglePlaces().
 *
 * Usage:
 *   node scripts/scrape-clinics.mjs
 *   node scripts/scrape-clinics.mjs --google   # also fetch from Places API (needs key)
 *
 * Output: data/clinics-scraped.json (review before import)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "data");
const OUT_FILE = path.join(OUT_DIR, "clinics-scraped.json");

// Metro Manila / NCR approximate bounding box
const NCR = { south: 14.35, west: 120.85, north: 14.75, east: 121.15 };

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
const useGoogle = args.includes("--google");

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

function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  return raw.trim();
}

function buildAddress(tags) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || tags["addr:place"],
    tags["addr:postcode"],
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return tags["addr:full"] || tags.address || "";
}

function inferEmergencyCapable(name, tags) {
  const text = `${name} ${tags.description || ""} ${tags["healthcare:speciality"] || ""}`.toLowerCase();
  return (
    /emergency|24\s*\/\s*7|24h|after.?hours|critical|trauma|hospital/.test(text) ||
    tags.emergency === "yes"
  );
}

function inferServices(name, tags) {
  const text = `${name} ${tags.description || ""}`.toLowerCase();
  const services = [];
  if (/trauma|accident|surgery|ortho|emergency|hospital/.test(text)) services.push("trauma");
  if (/poison|toxic/.test(text)) services.push("poisoning");
  if (/respiratory|oxygen|critical/.test(text)) services.push("respiratory");
  if (services.length === 0 && inferEmergencyCapable(name, tags)) {
    services.push("trauma", "poisoning", "respiratory");
  }
  return [...new Set(services)];
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dedupeClinics(clinics) {
  const kept = [];
  for (const c of clinics) {
    const dupe = kept.find(
      (k) =>
        k.name.toLowerCase() === c.name.toLowerCase() &&
        distanceMeters(k.latitude, k.longitude, c.latitude, c.longitude) < 150
    );
    if (!dupe) kept.push(c);
    else if (c.phone && !dupe.phone) Object.assign(dupe, { phone: c.phone });
  }
  return kept;
}

async function scrapeOverpass() {
  const query = `
[out:json][timeout:90];
(
  node["amenity"="veterinary"](${NCR.south},${NCR.west},${NCR.north},${NCR.east});
  way["amenity"="veterinary"](${NCR.south},${NCR.west},${NCR.north},${NCR.east});
  node["healthcare"="veterinary"](${NCR.south},${NCR.west},${NCR.north},${NCR.east});
  way["healthcare"="veterinary"](${NCR.south},${NCR.west},${NCR.north},${NCR.east});
);
out center tags;
`;

  console.log("Fetching clinics from OpenStreetMap (Overpass API)...");
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let lastError = "";
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "Vet247PH/1.0 (local dev; contact: dev@vet247ph.com)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastError = `${endpoint}: ${res.status}`;
        continue;
      }
      const json = await res.json();
      return parseOverpassElements(json.elements ?? []);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Overpass API failed: ${lastError}`);
}

function parseOverpassElements(elements) {
  return elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags.name || tags.brand;
      if (!name || lat == null || lng == null) return null;

      const address = buildAddress(tags) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const phone = normalizePhone(tags.phone || tags["contact:phone"] || tags.mobile);

      return {
        name,
        address,
        phone: phone || "",
        latitude: lat,
        longitude: lng,
        emergency_capable: inferEmergencyCapable(name, tags),
        owner_verified: false,
        services: inferServices(name, tags),
        hours: tags.opening_hours || tags["opening_hours:emergency"] || null,
        source: "openstreetmap",
        osm_id: `${el.type}/${el.id}`,
        website: tags.website || tags["contact:website"] || null,
      };
    })
    .filter(Boolean)
    .filter((c) => !isHumanBiteCenter(c.name));
}

async function scrapeGooglePlaces() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.warn("GOOGLE_PLACES_API_KEY not set — skipping Google Places.");
    return [];
  }

  console.log("Fetching clinics from Google Places API (Text Search)...");
  const center = "14.5995,120.9842"; // Manila
  const queries = [
    "emergency veterinary clinic Metro Manila",
    "24 hour vet clinic Quezon City",
    "animal hospital Makati",
    "veterinary clinic Pasig Taguig",
  ];

  const seen = new Set();
  const results = [];

  for (const q of queries) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", q);
    url.searchParams.set("location", center);
    url.searchParams.set("radius", "25000");
    url.searchParams.set("key", key);

    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.warn(`Places API (${q}): ${json.status} — ${json.error_message || ""}`);
      continue;
    }

    for (const place of json.results ?? []) {
      if (seen.has(place.place_id)) continue;
      seen.add(place.place_id);

      const lat = place.geometry?.location?.lat;
      const lng = place.geometry?.location?.lng;
      if (lat == null || lng == null) continue;
      if (lat < NCR.south || lat > NCR.north || lng < NCR.west || lng > NCR.east) continue;

      const name = place.name;
      if (isHumanBiteCenter(name, (place.types ?? []).join(" "))) continue;

      results.push({
        name,
        address: place.formatted_address || place.vicinity || "",
        phone: "",
        latitude: lat,
        longitude: lng,
        emergency_capable: inferEmergencyCapable(name, {
          description: place.types?.join(" "),
        }),
        owner_verified: false,
        services: inferServices(name, {}),
        hours: place.opening_hours?.open_now != null ? "See Google listing" : null,
        source: "google_places",
        google_place_id: place.place_id,
        website: null,
      });
    }
    await sleep(500);
  }

  // Enrich top results with phone via Place Details (limited to avoid quota burn)
  const toEnrich = results.filter((r) => !r.phone).slice(0, 30);
  for (const clinic of toEnrich) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", clinic.google_place_id);
    url.searchParams.set("fields", "formatted_phone_number,website,opening_hours");
    url.searchParams.set("key", key);
    const res = await fetch(url);
    const json = await res.json();
    if (json.result) {
      clinic.phone = normalizePhone(json.result.formatted_phone_number || "");
      clinic.website = json.result.website || clinic.website;
      if (json.result.opening_hours?.weekday_text) {
        clinic.hours = json.result.opening_hours.weekday_text.join("; ");
      }
    }
    await sleep(200);
  }

  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const overpass = await scrapeOverpass();
  console.log(`  OSM: ${overpass.length} raw results`);

  let google = [];
  if (useGoogle) {
    google = await scrapeGooglePlaces();
    console.log(`  Google Places: ${google.length} results`);
  }

  const merged = dedupeClinics([...overpass, ...google]);
  merged.sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Metro Manila (NCR)",
    count: merged.length,
    notes: [
      "Review this file before import. Set emergency_capable and owner_verified manually where needed.",
      "OSM data may lack phones — call clinics to verify or enrich with Google Places (--google + API key).",
      "Do not treat scraped emergency_capable as verified until a human or clinic owner confirms.",
    ],
    clinics: merged,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${merged.length} clinics to ${OUT_FILE}`);
  console.log("\nNext steps:");
  console.log("  1. Review/edit data/clinics-scraped.json");
  console.log("  2. node scripts/import-clinics.mjs --replace");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
