/**
 * Geocode clinics missing lat/lng using Nominatim (OpenStreetMap).
 * Usage: node scripts/geocode-clinics.mjs data/clinics-manual.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2] || path.join(__dirname, "../data/clinics-manual.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(address) {
  const q = encodeURIComponent(`${address}, Philippines`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ph`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "VetEmergency.ph/1.0 (local dev; geocoding for vet directory)",
    },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = await res.json();
  if (!results.length) return null;
  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    display_name: results[0].display_name,
  };
}

async function main() {
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  let geocoded = 0;

  for (const clinic of data.clinics) {
    if (clinic.latitude != null && clinic.longitude != null) continue;

    console.log(`Geocoding: ${clinic.name}`);
    const result = await geocode(clinic.address);
    if (result) {
      clinic.latitude = result.latitude;
      clinic.longitude = result.longitude;
      clinic.geocoded_from = result.display_name;
      geocoded++;
      console.log(`  → ${result.latitude}, ${result.longitude}`);
    } else {
      console.warn(`  → NOT FOUND`);
    }
    await sleep(1100); // Nominatim rate limit: 1 req/sec
  }

  fs.writeFileSync(inputPath, JSON.stringify(data, null, 2));
  console.log(`\nGeocoded ${geocoded} clinics. Updated ${inputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
