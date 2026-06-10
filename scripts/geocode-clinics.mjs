/**
 * Geocode clinics missing lat/lng using Nominatim (OpenStreetMap).
 *
 * Usage:
 *   node scripts/geocode-clinics.mjs data/clinics-merged.json
 *   node scripts/geocode-clinics.mjs --file=data/clinics-merged.json
 *
 * ~1 second per clinic (Nominatim rate limit). 900 clinics ≈ 15 minutes.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geocodeClinics } from "./geocode-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const inputPath =
  fileArg?.split("=")[1] ??
  args.find((a) => !a.startsWith("--")) ??
  path.join(__dirname, "../data/clinics-manual.json");

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const clinics = data.clinics ?? data;
  if (!Array.isArray(clinics)) {
    console.error("Expected { clinics: [...] } or a clinic array");
    process.exit(1);
  }

  const missing = clinics.filter((c) => c.latitude == null || c.longitude == null).length;
  if (!missing) {
    console.log("All clinics already have coordinates.");
    return;
  }

  console.log(`Geocoding ${missing} clinic(s) missing coordinates…`);
  console.log("This takes about 1 second per clinic (Nominatim rate limit).\n");

  const stats = await geocodeClinics(clinics, {
    onProgress({ phase, label, result, reason }) {
      if (phase === "start") {
        process.stdout.write(`Geocoding: ${label} … `);
      } else if (phase === "ok") {
        console.log(`${result.latitude}, ${result.longitude}`);
      } else {
        console.log(`NOT FOUND${reason ? ` (${reason})` : ""}`);
      }
    },
  });

  const payload = data.clinics ? { ...data, clinics } : { clinics };
  if (payload.clinics) {
    payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
    payload.count = clinics.length;
  }

  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));

  console.log(
    `\nDone: ${stats.geocoded} geocoded, ${stats.failed} failed, ${stats.skipped} already had coordinates`
  );
  console.log(`Updated ${inputPath}`);
  console.log(
    `\nNext: node scripts/import-clinics.mjs --file=${inputPath} --upsert`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
