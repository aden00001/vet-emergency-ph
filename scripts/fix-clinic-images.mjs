/**
 * Re-scrape listing photos from each clinic's Google Maps place page.
 * Fixes wrong photos (e.g. neighbor clinic on the same street).
 *
 * Usage:
 *   node scripts/fix-clinic-images.mjs --audit
 *   node scripts/fix-clinic-images.mjs --apply --limit=20
 *   node scripts/fix-clinic-images.mjs --apply --missing-only --name=blessed
 *   node scripts/fix-clinic-images.mjs --apply --missing-only --emergency-only --loop --limit=50
 *
 * Requires: npx playwright install chromium (once)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { extractPlaceId } from "./google-maps-parse-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REPORT_FILE = path.join(ROOT, "data", "image-audit-report.json");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const auditOnly = args.includes("--audit") || !apply;
const allWithMapsUrl = args.includes("--all-with-maps-url");
const missingOnly = args.includes("--missing-only");
const emergencyOnly = args.includes("--emergency-only");
const loop = args.includes("--loop");
const nameFilterArg = args.find((a) => a.startsWith("--name="));
const nameFilter = nameFilterArg
  ? nameFilterArg.split("=")[1].toLowerCase()
  : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const delayMs = 1200;

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const PLACEHOLDER_IMAGE =
  /default_user\.png|\/local\/servicebusiness\/default|\/ui\/avatar|\/profile\/default/i;

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

function normName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isImageUrl(value) {
  const s = (value || "").trim();
  if (!s.startsWith("http") || PLACEHOLDER_IMAGE.test(s)) return false;
  return (
    /googleusercontent\.com/i.test(s) ||
    /streetviewpixels/i.test(s) ||
    /maps\.googleapis\.com/i.test(s)
  );
}

function normalizeGooglePhotoUrl(url) {
  if (!url || !/googleusercontent\.com/i.test(url)) return url;
  return url.replace(/=w\d+-h\d+[^&?]*/i, "=w800-h500-k-no");
}

function imageKey(url) {
  if (!url) return null;
  return url.split("=")[0].replace(/\/+$/, "");
}

function buildSearchUrl(clinic) {
  const placeId = extractPlaceId(clinic.google_maps_url, clinic.google_place_id);
  if (!placeId) return null;
  const q = encodeURIComponent(clinic.name || "veterinary clinic");
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
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

async function scrapePlaceImage(page, clinic) {
  const url = buildSearchUrl(clinic);
  if (!url) return { error: "missing place id" };

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2200);

  const data = await page.evaluate(() => {
    const textOf = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    const pageName =
      textOf("h1.DUwDvf") ||
      textOf("h1") ||
      document.querySelector('[data-attrid="title"]')?.textContent?.trim() ||
      "";

    let image_url = null;
    let bestScore = 0;
    for (const img of document.querySelectorAll("img")) {
      const src = img.src || img.getAttribute("src") || "";
      if (
        !src.includes("googleusercontent.com") ||
        src.includes("default_user") ||
        src.includes("/s44-") ||
        src.includes("/s32-")
      ) {
        continue;
      }
      const score = (() => {
        const m = src.match(/=w(\d+)-h(\d+)/i);
        return m ? parseInt(m[1], 10) * parseInt(m[2], 10) : 1;
      })();
      if (score >= bestScore) {
        bestScore = score;
        image_url = src;
      }
    }

    return { pageName, image_url };
  });

  const pageNorm = normName(data.pageName);
  const clinicNorm = normName(clinic.name);
  const nameOk =
    !pageNorm ||
    !clinicNorm ||
    pageNorm.includes(clinicNorm) ||
    clinicNorm.includes(pageNorm) ||
    pageNorm.slice(0, 8) === clinicNorm.slice(0, 8);

  const image_url = isImageUrl(data.image_url)
    ? normalizeGooglePhotoUrl(data.image_url)
    : null;

  return {
    page_name: data.pageName || null,
    image_url,
    name_ok: nameOk,
    error: null,
  };
}

async function fetchClinics(supabase) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let query = supabase
      .from("clinics")
      .select("id, name, image_url, google_maps_url, emergency_capable")
      .not("google_maps_url", "is", null)
      .order("name");

    if (emergencyOnly) {
      query = query.eq("emergency_capable", true);
    }
    if (missingOnly) {
      query = query.is("image_url", null);
    } else if (!allWithMapsUrl) {
      query = query.not("image_url", "is", null);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function describeScope() {
  const parts = [];
  if (emergencyOnly) parts.push("emergency-capable");
  if (missingOnly) parts.push("missing photos");
  else if (allWithMapsUrl) parts.push("all with Maps URL");
  else parts.push("existing photos only");
  if (nameFilter) parts.push(`name contains "${nameFilter}"`);
  return parts.join(", ");
}

async function processBatch(page, supabase, batch, report, skipIds) {
  for (let i = 0; i < batch.length; i++) {
    const clinic = batch[i];
    process.stdout.write(
      `\r[${i + 1}/${batch.length}] ${clinic.name.slice(0, 45).padEnd(45)}`
    );

    try {
      const result = await scrapePlaceImage(page, clinic);
      report.checked++;

      if (result.error) {
        report.failed++;
        skipIds.add(clinic.id);
        report.mismatches.push({
          id: clinic.id,
          name: clinic.name,
          issue: result.error,
        });
        continue;
      }

      const oldKey = imageKey(clinic.image_url);
      const newKey = imageKey(result.image_url);
      const changed = oldKey !== newKey;

      if (!changed || !result.image_url) {
        report.unchanged++;
        if (!result.image_url) skipIds.add(clinic.id);
        continue;
      }

      const entry = {
        id: clinic.id,
        name: clinic.name,
        page_name: result.page_name,
        name_ok: result.name_ok,
        had_image: Boolean(clinic.image_url),
        now_has_image: Boolean(result.image_url),
      };

      if (apply) {
        const { error } = await supabase
          .from("clinics")
          .update({ image_url: result.image_url })
          .eq("id", clinic.id);
        if (error) {
          report.failed++;
          skipIds.add(clinic.id);
          entry.issue = error.message;
        } else if (!clinic.image_url && result.image_url) {
          report.added++;
        } else if (clinic.image_url && !result.image_url) {
          report.cleared++;
          skipIds.add(clinic.id);
        } else {
          report.updated++;
        }
      }

      report.mismatches.push(entry);
    } catch (err) {
      report.failed++;
      skipIds.add(clinic.id);
      report.mismatches.push({
        id: clinic.id,
        name: clinic.name,
        issue: err.message,
      });
    }

    await page.waitForTimeout(delayMs);
  }
  console.log("");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);
  const report = {
    generated_at: new Date().toISOString(),
    mode: auditOnly ? "audit" : "apply",
    scope: describeScope(),
    checked: 0,
    unchanged: 0,
    updated: 0,
    cleared: 0,
    added: 0,
    failed: 0,
    batches: 0,
    mismatches: [],
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-PH",
    viewport: { width: 1400, height: 900 },
  });

  const skipIds = new Set();

  try {
    await page.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await dismissConsent(page);

    do {
      let clinics = await fetchClinics(supabase);
      if (nameFilter) {
        clinics = clinics.filter((c) => c.name.toLowerCase().includes(nameFilter));
      }
      clinics = clinics.filter((c) => !skipIds.has(c.id));
      const batch = clinics.slice(0, limit);
      if (!batch.length) break;

      report.batches++;
      console.log(
        `\nBatch ${report.batches}: ${auditOnly ? "Auditing" : "Fixing"} ${batch.length} clinic photo(s) (${describeScope()})…`
      );

      await processBatch(page, supabase, batch, report, skipIds);
    } while (loop);
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log(
    `Done: ${report.checked} checked, ${report.unchanged} unchanged, ` +
      `${report.updated} updated, ${report.added} added, ${report.cleared} cleared, ` +
      `${report.failed} failed (${report.batches} batch(es))`
  );
  console.log(`Report → ${REPORT_FILE}`);

  if (auditOnly && report.mismatches.length) {
    console.log(`\n${report.mismatches.length} photo mismatch(es) found. Re-run with --apply to fix.`);
    for (const m of report.mismatches.slice(0, 15)) {
      console.log(`  • ${m.name}${m.page_name ? ` (Maps: ${m.page_name})` : ""}`);
    }
    if (report.mismatches.length > 15) {
      console.log(`  … and ${report.mismatches.length - 15} more in ${REPORT_FILE}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
