/**
 * Geocode clinics missing lat/lng.
 *
 * Usage:
 *   node scripts/geocode-clinics.mjs --file=data/clinics-merged.json
 *   node scripts/geocode-clinics.mjs --file=data/clinics-merged.json --google
 *   node scripts/geocode-clinics.mjs --file=data/clinics-merged.json --google-only
 *   node scripts/geocode-clinics.mjs --file=data/clinics-merged.json --limit=75 --delay=3000
 *
 * Nominatim: ~2.5s between requests (strict 1 req/sec policy). Saves every 25 clinics.
 * If you hit 429 errors, wait 15 minutes then re-run — already-geocoded rows are skipped.
 * Without Google API keys, use --limit=75 batches across multiple sessions.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { geocodeClinics } from "./geocode-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const delayArg = args.find((a) => a.startsWith("--delay="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const useGoogle = args.includes("--google") || args.includes("--google-only");
const googleOnly = args.includes("--google-only");
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const inputPath =
  fileArg?.split("=")[1] ??
  args.find((a) => !a.startsWith("--")) ??
  path.join(__dirname, "../data/clinics-manual.json");
const minIntervalMs = delayArg ? Number(delayArg.split("=")[1]) : 2500;

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

function writePayload(inputPath, data, clinics) {
  const payload = data.clinics ? { ...data, clinics } : { clinics };
  if (payload.clinics) {
    payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
    payload.count = clinics.length;
  }
  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));
}

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
  const withCoords = clinics.length - missing;

  if (!missing) {
    console.log("All clinics already have coordinates.");
    return;
  }

  const googleApiKey = useGoogle ? process.env.GOOGLE_PLACES_API_KEY : null;
  if (googleOnly && !googleApiKey) {
    console.error(
      "Missing GOOGLE_PLACES_API_KEY in .env.local — required for --google-only.\n" +
        "Add your key, or wait 10+ minutes and re-run without --google-only."
    );
    process.exit(1);
  }

  console.log(`${withCoords} already geocoded, ${missing} remaining.`);
  if (googleOnly) {
    console.log("Mode: Google Places only (skipping Nominatim).");
  } else {
    console.log(`Mode: Nominatim (${minIntervalMs}ms between requests)${googleApiKey ? " + Google fallback" : ""}.`);
    console.log("Plus codes (e.g. VV26+M8V) are decoded locally when possible.");
    console.log("If you see 429 errors, stop, wait 15 minutes, and re-run the same command.");
  }
  if (Number.isFinite(limit)) {
    console.log(`Batch limit: ${limit} clinics this run (re-run until all are done).`);
  }
  console.log("Progress saves every 25 clinics.\n");

  try {
    const stats = await geocodeClinics(clinics, {
      googleApiKey: googleApiKey || undefined,
      googleOnly,
      useNominatim: !googleOnly,
      minIntervalMs,
      limit,
      saveEvery: 25,
      onProgress({ phase, label, result, reason, waitMs, attempt }) {
        if (phase === "start") {
          process.stdout.write(`Geocoding: ${label} … `);
        } else if (phase === "ok") {
          const tag = result.precision === "city" ? " (city-level)" : "";
          const src = result.source === "google_places" ? " [Google]" : "";
          console.log(`${result.latitude}, ${result.longitude}${tag}${src}`);
        } else if (phase === "rate_limit") {
          console.log(`\n  ⏳ Nominatim 429 — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt})…`);
        } else if (phase === "save") {
          writePayload(inputPath, data, clinics);
          console.log(
            `\n  Saved progress (${clinics.filter((c) => c.latitude != null).length} with coordinates)\n`
          );
        } else {
          console.log(`NOT FOUND${reason ? ` (${reason})` : ""}`);
        }
      },
    });

    writePayload(inputPath, data, clinics);

    const finalWithCoords = clinics.filter((c) => c.latitude != null).length;
    const stillMissing = clinics.length - finalWithCoords;

    console.log(
      `\nDone: ${stats.geocoded} geocoded (${stats.googleFilled} via Google), ${stats.failed} failed, ${stats.skipped} already had coordinates`
    );
    if (stats.rateLimitPauses) {
      console.log(`Nominatim rate-limit pauses: ${stats.rateLimitPauses}`);
    }
    console.log(`${finalWithCoords} / ${clinics.length} clinics now have coordinates`);
    if (stillMissing) {
      console.log(
        `${stillMissing} still missing — try: npm run geocode:merged:google-only (needs GOOGLE_PLACES_API_KEY)`
      );
    }
    console.log(`Updated ${inputPath}`);
    console.log(`\nNext: node scripts/import-clinics.mjs --file=${inputPath} --upsert`);
  } catch (err) {
    writePayload(inputPath, data, clinics);
    const saved = clinics.filter((c) => c.latitude != null).length;
    console.error(`\nStopped early: ${err.message}`);
    console.error(`Progress saved: ${saved} / ${clinics.length} with coordinates.`);
    console.error("Wait 10+ minutes, then re-run the same command.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
