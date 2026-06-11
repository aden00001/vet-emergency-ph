/**
 * Resolve clinic coordinates from Google Maps place URLs using Playwright.
 * Free alternative to Google Places API — opens each listing in a headless browser
 * and reads lat/lng from the redirected Maps URL (!3d…!4d…).
 *
 * Usage:
 *   node scripts/resolve-coords-playwright.mjs --file=data/clinics-merged.json --fix-bad
 *   node scripts/resolve-coords-playwright.mjs --file=data/clinics-merged.json --fix-bad --limit=50
 *   node scripts/resolve-coords-playwright.mjs --file=data/clinics-merged.json --fix-bad --limit=50 --loop
 *
 * Requires: npx playwright install chromium (once)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import {
  clearGeocodeFields,
  extractCoordsFromUrl,
  extractPlaceId,
  isBadGeocode,
} from "./geocode-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const pauseArg = args.find((a) => a.startsWith("--batch-pause="));
const fixBad = args.includes("--fix-bad");
const loop = args.includes("--loop");
const inputPath =
  fileArg?.split("=")[1] ?? path.join(ROOT, "data", "clinics-merged.json");
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const delayMs = 1200;
const batchPauseMs = pauseArg ? Number(pauseArg.split("=")[1]) : 5000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clinicKey(clinic) {
  return (
    clinic.id ??
    clinic.google_place_id ??
    clinic.google_maps_url ??
    `${clinic.name}|${clinic.address}`
  );
}

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

function placeMapsUrl(clinic) {
  if (clinic.google_maps_url) return clinic.google_maps_url;
  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (!placeId) return null;
  const q = encodeURIComponent(clinic.name || "veterinary clinic");
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
}

function needsResolve(clinic, skipKeys = null) {
  if (skipKeys?.has(clinicKey(clinic))) return false;
  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (!placeId && !clinic.google_maps_url) return false;
  if (fixBad && isBadGeocode(clinic)) return true;
  return clinic.latitude == null || clinic.longitude == null;
}

async function dismissConsent(page) {
  for (const label of ["Accept all", "Reject all", "I agree", "Tanggapin lahat"]) {
    const btn = page.getByRole("button", { name: label });
    if (await btn.count()) {
      try {
        await btn.first().click({ timeout: 3000 });
        await page.waitForTimeout(800);
        return;
      } catch {
        /* continue */
      }
    }
  }
}

async function resolveCoords(page, clinic) {
  const url = placeMapsUrl(clinic);
  if (!url) return null;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(delayMs);

  let coords = extractCoordsFromUrl(page.url());
  if (!coords) {
    await page.waitForTimeout(1500);
    coords = extractCoordsFromUrl(page.url());
  }
  if (!coords) return null;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    display_name: page.url(),
    precision: "google_maps_playwright",
    source: "google_maps_playwright",
  };
}

async function processBatch(page, batch, data, clinics, skipKeys) {
  let resolved = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const clinic = batch[i];
    const label = clinic.name || "Unknown";
    process.stdout.write(`[${i + 1}/${batch.length}] ${label} … `);

    try {
      if (fixBad && isBadGeocode(clinic)) clearGeocodeFields(clinic);

      const result = await resolveCoords(page, clinic);
      if (result) {
        clinic.latitude = result.latitude;
        clinic.longitude = result.longitude;
        clinic.geocoded_from = result.display_name;
        clinic.geocode_precision = result.precision;
        clinic.geocode_source = result.source;
        clinic.location_verified = true;
        resolved++;
        console.log(`${result.latitude}, ${result.longitude}`);
      } else {
        failed++;
        skipKeys.add(clinicKey(clinic));
        console.log("no coords in URL");
      }
    } catch (err) {
      failed++;
      skipKeys.add(clinicKey(clinic));
      console.log(`error (${err.message})`);
    }

    if ((i + 1) % 25 === 0) {
      writePayload(inputPath, data, clinics);
      console.log(`  Saved progress (${clinics.filter((c) => c.latitude != null).length} with coordinates)\n`);
    }
  }

  return { resolved, failed };
}

async function main() {
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

  const initialTargets = clinics.filter((c) => needsResolve(c));
  if (!initialTargets.length) {
    console.log("Nothing to resolve (use --fix-bad for suspect coordinates).");
    return;
  }

  console.log(
    `${initialTargets.length} clinic(s) to resolve${Number.isFinite(limit) ? `, ${limit} per batch` : ""}${loop ? ", looping until done" : ""}.`
  );
  console.log("Free method: Playwright reads coords from Google Maps URLs (no API key).\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "en-PH", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto("https://www.google.com/maps", { waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissConsent(page);

  const skipKeys = new Set();
  let totalResolved = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (true) {
    const targets = clinics.filter((c) => needsResolve(c, skipKeys));
    const batch = targets.slice(0, limit);

    if (!batch.length) break;

    batchNum++;
    console.log(
      `\n--- Batch ${batchNum}: ${batch.length} clinic(s) (${targets.length} queued, ${skipKeys.size} skipped this session) ---\n`
    );

    const { resolved, failed } = await processBatch(page, batch, data, clinics, skipKeys);
    totalResolved += resolved;
    totalFailed += failed;
    writePayload(inputPath, data, clinics);

    const remaining = clinics.filter((c) => needsResolve(c, skipKeys)).length;
    console.log(`\nBatch ${batchNum} done: ${resolved} resolved, ${failed} failed. ${remaining} remaining.`);

    if (!loop || remaining === 0) break;

    if (resolved === 0) {
      console.log("No progress this batch — stopping loop.");
      break;
    }

    console.log(`Continuing in ${batchPauseMs / 1000}s…`);
    await sleep(batchPauseMs);
  }

  await browser.close();

  const remaining = clinics.filter((c) => needsResolve(c, skipKeys)).length;
  console.log(`\nFinished: ${totalResolved} resolved, ${totalFailed} failed. Updated ${inputPath}`);
  if (remaining > 0) {
    if (loop) {
      console.log(`${remaining} still need coords (${skipKeys.size} skipped after failures this session).`);
    } else {
      console.log(`${remaining} remaining — re-run with --loop to continue automatically.`);
    }
  }
  console.log(`\nNext: node scripts/import-clinics.mjs --file=${inputPath} --upsert`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
