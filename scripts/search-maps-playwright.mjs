/**
 * Search Google Maps by clinic name and scrape location details (free — no API key).
 *
 * Usage:
 *   node scripts/search-maps-playwright.mjs "KINGVET ANIMAL CLINIC"
 *   node scripts/search-maps-playwright.mjs "Blessed Veterinary Clinic" --near="Quezon City"
 *   node scripts/search-maps-playwright.mjs --file=data/clinics-merged.json --missing-place-id --limit=20
 *   node scripts/search-maps-playwright.mjs --file=data/clinics-merged.json --missing-coords --apply --loop
 *
 * Requires: npx playwright install chromium (once)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { extractPlaceId } from "./geocode-lib.mjs";
import {
  buildSearchQuery,
  cityHintFromAddress,
  dismissConsent,
  searchMapsByName,
} from "./maps-playwright-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "maps-search-results.json");

const args = process.argv.slice(2);
const queryArg = args.find((a) => a.startsWith("--query="));
const nearArg = args.find((a) => a.startsWith("--near="));
const fileArg = args.find((a) => a.startsWith("--file="));
const outArg = args.find((a) => a.startsWith("--out="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const nameFilterArg = args.find((a) => a.startsWith("--name="));
const positionalQuery = args.find((a) => !a.startsWith("--"));

const apply = args.includes("--apply");
const loop = args.includes("--loop");
const missingPlaceId = args.includes("--missing-place-id");
const missingCoords = args.includes("--missing-coords");
const missingPhoto = args.includes("--missing-photo");
const emergencyOnly = args.includes("--emergency-only");
const noPhoto = args.includes("--no-photo");

const inputPath = fileArg?.split("=")[1] ?? null;
const outPath = outArg?.split("=")[1] ?? DEFAULT_OUT;
const nearOverride = nearArg?.split("=")[1] ?? "";
const singleQuery = queryArg?.split("=")[1] ?? positionalQuery ?? null;
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const nameFilter = nameFilterArg?.split("=")[1] ?? null;
const delayMs = 1200;

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

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

function clinicKey(clinic) {
  return clinic.id ?? clinic.google_place_id ?? `${clinic.name}|${clinic.address}`;
}

function needsLookup(clinic, skipKeys) {
  if (skipKeys?.has(clinicKey(clinic))) return false;
  if (emergencyOnly && !clinic.emergency_capable) return false;
  if (missingPlaceId && extractPlaceId(clinic.google_maps_url, clinic.google_place_id)) {
    return false;
  }
  if (missingCoords && clinic.latitude != null && clinic.longitude != null) {
    return false;
  }
  if (missingPhoto && clinic.image_url) return false;
  if (!missingPlaceId && !missingCoords && !missingPhoto) return true;
  return missingPlaceId || missingCoords || missingPhoto;
}

function loadClinicsFromFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const clinics = data.clinics ?? data;
  if (!Array.isArray(clinics)) {
    throw new Error("Expected { clinics: [...] }");
  }
  return { data, clinics };
}

async function fetchClinicsFromDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("clinics")
      .select("id, name, address, phone, latitude, longitude, image_url, google_maps_url, emergency_capable")
      .order("name");

    if (emergencyOnly) query = query.eq("emergency_capable", true);
    if (missingPhoto) query = query.is("image_url", null);
    if (missingCoords) query = query.or("latitude.is.null,longitude.is.null");
    if (nameFilter) query = query.ilike("name", `%${nameFilter}%`);

    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  return { supabase, clinics: rows.filter((c) => needsLookup(c)) };
}

function writeResults(payload, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
}

function applyToClinicRecord(clinic, result) {
  clinic.name = result.name || clinic.name;
  if (result.address) clinic.address = result.address;
  if (result.phone) clinic.phone = result.phone;
  clinic.latitude = result.latitude;
  clinic.longitude = result.longitude;
  clinic.location_verified = true;
  clinic.geocode_source = "google_maps_playwright";
  clinic.geocode_precision = "google_maps_search";
  if (result.hours) clinic.hours = result.hours;
  if (result.category) clinic.category = result.category;
  if (result.google_maps_url) clinic.google_maps_url = result.google_maps_url;
  if (result.google_place_id) clinic.google_place_id = result.google_place_id;
  if (result.image_url) clinic.image_url = result.image_url;
}

async function applyToDb(supabase, clinic, result) {
  const row = {
    name: result.name || clinic.name,
    address: result.address || clinic.address,
    phone: result.phone || clinic.phone,
    location: `SRID=4326;POINT(${result.longitude} ${result.latitude})`,
    location_verified: true,
    hours: result.hours ?? clinic.hours,
    google_maps_url: result.google_maps_url,
    image_url: result.image_url ?? clinic.image_url,
  };

  const { error } = await supabase.from("clinics").update(row).eq("id", clinic.id);
  if (error) throw error;
}

async function processOne(page, clinic, options) {
  const near = options.near || cityHintFromAddress(clinic.address) || nearOverride;
  const query = buildSearchQuery(clinic.name, near);
  const result = await searchMapsByName(page, clinic.name, {
    near,
    delayMs,
    includePhoto: !noPhoto,
  });

  return result ? { query, ...result } : null;
}

async function runSingle(page) {
  const result = await searchMapsByName(page, singleQuery, {
    near: nearOverride,
    delayMs,
    includePhoto: !noPhoto,
  });

  if (!result) {
    console.error(`No place found for: ${singleQuery}`);
    process.exit(1);
  }

  const payload = {
    searched_at: new Date().toISOString(),
    query: buildSearchQuery(singleQuery, nearOverride),
    result,
  };

  writeResults(payload, outPath);
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nSaved → ${outPath}`);
}

async function runBatch(page) {
  let supabase = null;
  let data = null;
  let clinics = [];
  let fromDb = false;

  if (inputPath) {
    ({ data, clinics } = loadClinicsFromFile(inputPath));
  } else if (apply || missingPhoto || missingCoords || emergencyOnly) {
    ({ supabase, clinics } = await fetchClinicsFromDb());
    fromDb = true;
  } else {
    console.error("Batch mode needs --file=... or --apply with Supabase env.");
    process.exit(1);
  }

  const skipKeys = new Set();
  const report = {
    searched_at: new Date().toISOString(),
    mode: fromDb ? "supabase" : "file",
    source: inputPath,
    checked: 0,
    found: 0,
    failed: 0,
    applied: 0,
    batches: 0,
    results: [],
    failures: [],
  };

  do {
    const targets = clinics.filter((c) => needsLookup(c, skipKeys));
    const batch = targets.slice(0, limit);
    if (!batch.length) break;

    report.batches++;
    console.log(`\nBatch ${report.batches}: ${batch.length} clinic(s)…`);

    for (let i = 0; i < batch.length; i++) {
      const clinic = batch[i];
      process.stdout.write(
        `\r[${i + 1}/${batch.length}] ${clinic.name.slice(0, 45).padEnd(45)}`
      );

      try {
        report.checked++;
        const result = await processOne(page, clinic, { near: nearOverride });

        if (!result) {
          report.failed++;
          skipKeys.add(clinicKey(clinic));
          report.failures.push({ name: clinic.name, issue: "no place found" });
          continue;
        }

        report.found++;
        report.results.push({
          id: clinic.id ?? null,
          input_name: clinic.name,
          ...result,
        });

        if (inputPath) {
          applyToClinicRecord(clinic, result);
        }
        if (apply && supabase && clinic.id) {
          await applyToDb(supabase, clinic, result);
          report.applied++;
        }
      } catch (err) {
        report.failed++;
        skipKeys.add(clinicKey(clinic));
        report.failures.push({ name: clinic.name, issue: err.message });
      }

      await sleep(delayMs);
    }

    console.log("");

    if (inputPath && (report.found > 0 || report.batches === 1)) {
      const payload = data.clinics ? { ...data, clinics } : { clinics };
      if (payload.clinics) {
        payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
        payload.count = clinics.length;
      }
      fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2));
    }
  } while (loop);

  writeResults(report, outPath);

  console.log(
    `Done: ${report.checked} checked, ${report.found} found, ${report.failed} failed` +
      (apply ? `, ${report.applied} updated in Supabase` : "")
  );
  console.log(`Report → ${outPath}`);
  if (inputPath) console.log(`Updated → ${inputPath}`);
}

async function main() {
  if (!singleQuery && !inputPath && !apply && !missingPhoto && !missingCoords) {
    console.error(
      "Usage:\n" +
        '  node scripts/search-maps-playwright.mjs "Clinic Name"\n' +
        '  node scripts/search-maps-playwright.mjs "Clinic Name" --near="Quezon City"\n' +
        "  node scripts/search-maps-playwright.mjs --file=data/clinics-merged.json --missing-place-id --limit=20\n" +
        "  node scripts/search-maps-playwright.mjs --missing-place-id --emergency-only --apply --loop --limit=50"
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-PH",
    viewport: { width: 1400, height: 900 },
  });

  try {
    await page.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissConsent(page);

    if (singleQuery && !inputPath && !apply) {
      await runSingle(page);
    } else {
      await runBatch(page);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
