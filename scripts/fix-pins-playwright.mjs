/**
 * Fix clinic pins via Playwright Google Maps search (name + place_id).
 * Targets only listings flagged needs_pin_fix (Metro Manila OK pins skipped).
 *
 * Usage:
 *   node scripts/fix-pins-playwright.mjs --file=data/clinics-merged.json --limit=50 --loop
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
  extractPlusCode,
  isBadGeocode,
} from "./geocode-lib.mjs";
import { clinicNeedsPinFix } from "./location-audit-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const pauseArg = args.find((a) => a.startsWith("--batch-pause="));
const loop = args.includes("--loop");
const inputPath =
  fileArg?.split("=")[1] ?? path.join(ROOT, "data", "clinics-merged.json");
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const delayMs = 1500;
const batchPauseMs = pauseArg ? Number(pauseArg.split("=")[1]) : 5000;

const PLUS_CODE_PAGE_RE = /[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clinicKey(clinic) {
  return (
    clinic.id ??
    clinic.google_place_id ??
    `${clinic.name}|${clinic.address}`
  );
}

function writePayload(inputPath, data, clinics) {
  const payload = data.clinics ? { ...data, clinics } : { clinics };
  if (payload.clinics) {
    payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
    payload.count = clinics.length;
  }
  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));
}

function buildSearchUrl(clinic) {
  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (!placeId) return null;
  const q = encodeURIComponent(clinic.name || "veterinary clinic");
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
}

function canonicalPlaceUrl(url) {
  if (!url || !url.includes("/maps/place/")) return null;
  return url.split("?")[0];
}

function mergePlusCodeIntoAddress(address, plusCode) {
  if (!plusCode || !address) return address || plusCode || null;
  if (extractPlusCode(address)) return address;
  return `${plusCode}, ${address}`;
}

function needsFix(clinic, skipKeys = null) {
  if (skipKeys?.has(clinicKey(clinic))) return false;
  return clinicNeedsPinFix(clinic);
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

async function scrapePlacePanel(page) {
  return page.evaluate((pattern) => {
    const PLUS = new RegExp(pattern, "i");

    function pickPlusCode(text) {
      const m = (text || "").match(PLUS);
      return m ? m[0].toUpperCase() : null;
    }

    let plusCode = null;
    let address = "";

    for (const el of document.querySelectorAll("button[aria-label], [data-item-id], a[aria-label]")) {
      const label = el.getAttribute("aria-label") || "";
      const id = el.getAttribute("data-item-id") || "";

      if (!plusCode) {
        const fromLabel = pickPlusCode(label.replace(/plus code[:\s]*/i, ""));
        if (fromLabel) plusCode = fromLabel;
      }

      if (!address && (id.startsWith("address") || /^address:/i.test(label))) {
        address = label.replace(/^Address:\s*/i, "").trim();
      }
    }

    if (!plusCode) {
      for (const el of document.querySelectorAll("button, span, div")) {
        const t = el.textContent?.trim() || "";
        if (t.length > 20 || t.length < 7) continue;
        const code = pickPlusCode(t);
        if (code && !/^[A-Z0-9+]+,\s/.test(t)) {
          plusCode = code;
          break;
        }
      }
    }

    return { plusCode, address };
  }, PLUS_CODE_PAGE_RE.source);
}

async function waitForPlaceCoords(page, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const coords = extractCoordsFromUrl(page.url());
    if (coords) return coords;
    await page.waitForTimeout(400);
  }
  return null;
}

async function openPlaceFromSearch(page, clinic) {
  const placeLink = page.locator('a[href*="/maps/place/"]').first();
  if (await placeLink.count()) {
    try {
      await placeLink.click({ timeout: 5000 });
      await page.waitForTimeout(delayMs);
      return true;
    } catch {
      /* fall through */
    }
  }

  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (!placeId) return false;

  const direct = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`;
  await page.goto(direct, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(delayMs);
  return true;
}

async function fixPin(page, clinic) {
  const searchUrl = buildSearchUrl(clinic);
  if (!searchUrl) return null;

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(delayMs);

  let coords = await waitForPlaceCoords(page, 8000);

  if (!coords && !page.url().includes("/maps/place/")) {
    await openPlaceFromSearch(page, clinic);
    coords = await waitForPlaceCoords(page, 8000);
  }

  let panel = await scrapePlacePanel(page);

  if (!coords) {
    await page.waitForTimeout(1500);
    coords = extractCoordsFromUrl(page.url());
    if (!panel.plusCode && !panel.address) {
      panel = await scrapePlacePanel(page);
    }
  }

  if (!coords) return null;

  const placeUrl = canonicalPlaceUrl(page.url());
  const plusCode = panel.plusCode;
  const mapsAddress = panel.address || null;

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    plus_code: plusCode,
    address: mapsAddress,
    google_maps_url: placeUrl,
    display_name: page.url(),
    precision: "google_maps_playwright",
    source: "google_maps_playwright",
  };
}

function applyFix(clinic, result) {
  clinic.latitude = result.latitude;
  clinic.longitude = result.longitude;
  clinic.geocoded_from = result.display_name;
  clinic.geocode_precision = result.precision;
  clinic.geocode_source = result.source;
  clinic.location_verified = true;

  if (result.google_maps_url) {
    clinic.google_maps_url = result.google_maps_url;
  }

  const baseAddress = result.address || clinic.address;
  if (result.plus_code) {
    clinic.plus_code = result.plus_code;
    clinic.address = mergePlusCodeIntoAddress(baseAddress, result.plus_code);
  } else if (result.address) {
    clinic.address = result.address;
  }
}

async function processBatch(page, batch, data, clinics, skipKeys) {
  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const clinic = batch[i];
    const label = clinic.name || "Unknown";
    process.stdout.write(`[${i + 1}/${batch.length}] ${label} … `);

    try {
      if (isBadGeocode(clinic)) clearGeocodeFields(clinic);

      const result = await fixPin(page, clinic);
      if (result) {
        applyFix(clinic, result);
        fixed++;
        const extra = result.plus_code ? ` + ${result.plus_code}` : "";
        console.log(`${result.latitude}, ${result.longitude}${extra}`);
      } else {
        failed++;
        skipKeys.add(clinicKey(clinic));
        console.log("no coords from Maps");
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

  return { fixed, failed };
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

  const initialTargets = clinics.filter((c) => needsFix(c));
  if (!initialTargets.length) {
    console.log("Nothing needs pin fix.");
    return;
  }

  console.log(
    `${initialTargets.length} clinic(s) need pin fix${Number.isFinite(limit) ? `, ${limit} per batch` : ""}${loop ? ", looping until done" : ""}.`
  );
  console.log("Metro Manila listings with OK pins are skipped.\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "en-PH", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto("https://www.google.com/maps", { waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissConsent(page);

  const skipKeys = new Set();
  let totalFixed = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (true) {
    const targets = clinics.filter((c) => needsFix(c, skipKeys));
    const batch = targets.slice(0, limit);

    if (!batch.length) break;

    batchNum++;
    console.log(
      `\n--- Batch ${batchNum}: ${batch.length} clinic(s) (${targets.length} queued, ${skipKeys.size} skipped this session) ---\n`
    );

    const { fixed, failed } = await processBatch(page, batch, data, clinics, skipKeys);
    totalFixed += fixed;
    totalFailed += failed;
    writePayload(inputPath, data, clinics);

    const remaining = clinics.filter((c) => needsFix(c, skipKeys)).length;
    console.log(`\nBatch ${batchNum} done: ${fixed} fixed, ${failed} failed. ${remaining} remaining.`);

    if (!loop || remaining === 0) break;

    if (fixed === 0) {
      console.log("No progress this batch — stopping loop.");
      break;
    }

    console.log(`Continuing in ${batchPauseMs / 1000}s…`);
    await sleep(batchPauseMs);
  }

  await browser.close();

  const remaining = clinics.filter((c) => needsFix(c, skipKeys)).length;
  console.log(`\nFinished: ${totalFixed} fixed, ${totalFailed} failed. Updated ${inputPath}`);
  if (remaining > 0) {
    console.log(`${remaining} still need pin fix (${skipKeys.size} skipped after failures this session).`);
  }
  console.log(`\nNext: npm run import:merged:upsert`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
