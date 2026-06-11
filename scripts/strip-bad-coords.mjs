/**
 * Strip unreliable coordinates from clinic JSON (address-only listings).
 *
 * Usage:
 *   node scripts/strip-bad-coords.mjs --file=data/clinics-merged.json
 *   node scripts/strip-bad-coords.mjs --file=data/clinics-merged.json --all-missing-maps
 *
 * Then import to Supabase:
 *   node scripts/import-clinics.mjs --file=data/clinics-merged.json --upsert
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearGeocodeFields, isBadGeocode } from "./geocode-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const allMissingMaps = args.includes("--all-missing-maps");
const inputPath =
  fileArg?.split("=")[1] ?? path.join(ROOT, "data", "clinics-merged.json");

function shouldStrip(clinic) {
  if (isBadGeocode(clinic)) return true;
  if (allMissingMaps) {
    const hasMapsLink = Boolean(clinic.google_maps_url || clinic.google_place_id);
    return !hasMapsLink && clinic.latitude != null;
  }
  return false;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const clinics = data.clinics ?? data;
  if (!Array.isArray(clinics)) {
    console.error("Expected { clinics: [...] }");
    process.exit(1);
  }

  let stripped = 0;

  for (const clinic of clinics) {
    if (!shouldStrip(clinic)) continue;
    clearGeocodeFields(clinic);
    stripped++;
    console.log(`Stripped coords: ${clinic.name}`);
  }

  const payload = data.clinics ? { ...data, clinics } : { clinics };
  if (payload.clinics) {
    payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
    payload.count = clinics.length;
  }

  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));

  console.log(`\nDone: ${stripped} clinic(s) set to address-only in ${inputPath}`);
  console.log(
    "Next: node scripts/import-clinics.mjs --file=" +
      inputPath +
      " --upsert"
  );
}

main();
