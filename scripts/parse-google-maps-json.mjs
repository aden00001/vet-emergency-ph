/**
 * Parse Outscraper / Google Maps JSON export → clinics JSON for import.
 *
 * Usage:
 *   node scripts/parse-google-maps-json.mjs "path/to/export.json"
 *   node scripts/parse-google-maps-json.mjs data/metro-manila-outscraper.json --geocode
 *   node scripts/parse-google-maps-json.mjs data/metro-manila-outscraper.json --geocode --import
 *
 * For multiple files, use merge-clinic-json.mjs instead.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import {
  dedupeClinics,
  extractOutscraperRows,
  parseOutscraperRows,
} from "./google-maps-parse-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "clinics-google-maps.json");

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
const doImport = args.includes("--import");
const doGeocode = args.includes("--geocode");
const mergeExisting = !args.includes("--no-merge");
const outPath = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? DEFAULT_OUT;

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
  const rows = extractOutscraperRows(raw);
  const { clinics: parsed, excludedBite, excludedOther } = parseOutscraperRows(rows);

  let existing = [];
  if (mergeExisting && fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
    existing = prev.clinics ?? [];
  }

  let clinics = dedupeClinics([...existing, ...parsed]).sort((a, b) => a.name.localeCompare(b.name));

  let geocodeStats = null;
  if (doGeocode) {
    console.log(`Geocoding clinics missing coordinates (${clinics.filter((c) => c.latitude == null).length} to try)...`);
    geocodeStats = await geocodeClinics(clinics);
    clinics = dedupeClinics(clinics).sort((a, b) => a.name.localeCompare(b.name));
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
