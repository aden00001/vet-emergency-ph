/**
 * Scrape a Google Maps search URL with Playwright (browser automation).
 *
 * Prefer GOOGLE_PLACES_API_KEY + scrape-google-places.mjs for production.
 * This script exists for one-off imports when you have a Maps search link but no API key.
 *
 * Usage:
 *   node scripts/scrape-google-maps-url.mjs "<maps search url>"
 *   node scripts/scrape-google-maps-url.mjs "<url>" --import
 *   node scripts/scrape-google-maps-url.mjs "<url>" --max=80
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { chromium } from "playwright";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "data", "clinics-google-maps.json");

const args = process.argv.slice(2);
const mapsUrl = args.find((a) => a.startsWith("http"));
const doImport = args.includes("--import");
const maxArg = args.find((a) => a.startsWith("--max="));
const maxPlaces = maxArg ? parseInt(maxArg.split("=")[1], 10) : 120;

const PLACEHOLDER_IMAGE =
  /default_user\.png|\/local\/servicebusiness\/default|\/ui\/avatar|\/profile\/default/i;

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

function imageSizeScore(url) {
  const m = url.match(/=w(\d+)-h(\d+)/i);
  if (!m) return 0;
  return parseInt(m[1], 10) * parseInt(m[2], 10);
}

function extractCoords(url) {
  const m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { latitude: parseFloat(at[1]), longitude: parseFloat(at[2]) };
  return null;
}

function extractPlaceId(url) {
  const m = url.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  return "";
}

function inferEmergency(name, hoursText, category) {
  const text = `${name} ${hoursText} ${category}`.toLowerCase();
  if (isHumanBiteCenter(name, category)) return false;
  return /open 24 hours|24\s*\/\s*7|24 hrs|24 hour|on call emergency|emergency veterinarian|pet emergency/i.test(
    text
  );
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

async function collectPlaceLinks(page) {
  const feed = page.locator('div[role="feed"]');
  await feed.waitFor({ timeout: 45000 });

  const seen = new Set();
  const links = [];
  let stale = 0;

  while (stale < 6 && links.length < maxPlaces) {
    const anchors = await page.locator('a[href*="/maps/place/"]').evaluateAll((els) =>
      els
        .map((el) => ({
          href: el.href,
          label: el.getAttribute("aria-label") || el.textContent?.trim() || "",
        }))
        .filter((x) => x.href.includes("/maps/place/"))
    );

    let added = 0;
    for (const { href, label } of anchors) {
      const base = href.split("?")[0];
      if (seen.has(base)) continue;
      seen.add(base);
      links.push({ href, label });
      added++;
      if (links.length >= maxPlaces) break;
    }

    stale = added === 0 ? stale + 1 : 0;
    await feed.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(1400);
  }

  return links;
}

async function scrapePlaceDetail(page, placeUrl, fallbackName) {
  await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const textOf = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    const name =
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

    const buttons = Array.from(document.querySelectorAll("button[data-item-id], button[aria-label]"));
    let phone = "";
    let address = "";
    let hours = "";

    for (const btn of buttons) {
      const id = btn.getAttribute("data-item-id") || "";
      const label = btn.getAttribute("aria-label") || "";
      if (!phone && (id.startsWith("phone:") || /phone/i.test(label))) {
        phone = label.replace(/^Phone:\s*/i, "").trim();
      }
      if (!address && (id.startsWith("address") || /address/i.test(label))) {
        address = label.replace(/^Address:\s*/i, "").trim();
      }
    }

    const hourNodes = document.querySelectorAll(
      '[aria-label*="hours" i], [aria-label*="Open" i], [aria-label*="Closed" i]'
    );
    for (const node of hourNodes) {
      const t = node.getAttribute("aria-label") || node.textContent?.trim() || "";
      if (/open|closed|hours/i.test(t) && t.length < 120) {
        hours = t;
        break;
      }
    }

    const category =
      document.querySelector('button[jsaction*="category"]')?.textContent?.trim() ||
      textOf(".DkEaL") ||
      "";

    return { name, image_url, phone, address, hours, category };
  });

  const coords = extractCoords(page.url()) || extractCoords(placeUrl);
  const name = data.name || fallbackName;
  if (!name || !coords) return null;

  const category = data.category || "";
  if (isHumanBiteCenter(name, category)) return null;

  const hours = data.hours || null;
  const emergency_capable = inferEmergency(name, hours || "", category);

  return {
    name,
    address: data.address || `${coords.latitude}, ${coords.longitude}`,
    phone: normalizePhone(data.phone) || "",
    latitude: coords.latitude,
    longitude: coords.longitude,
    emergency_capable,
    owner_verified: false,
    services: emergency_capable
      ? ["trauma", "poisoning", "respiratory"]
      : ["trauma"],
    hours,
    source: "google_maps_scrape",
    google_maps_url: placeUrl.split("?")[0],
    google_place_id: extractPlaceId(placeUrl) || undefined,
    image_url: isImageUrl(data.image_url)
      ? normalizeGooglePhotoUrl(data.image_url)
      : undefined,
    category,
  };
}

async function main() {
  if (!mapsUrl) {
    console.error(
      'Usage: node scripts/scrape-google-maps-url.mjs "<google maps search url>" [--import] [--max=80]'
    );
    process.exit(1);
  }

  console.log(`Opening Maps search (max ${maxPlaces} places)…`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-PH",
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(mapsUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await dismissConsent(page);

    const placeLinks = await collectPlaceLinks(page);
    console.log(`Found ${placeLinks.length} place links in search results`);

    const clinics = [];
    for (let i = 0; i < placeLinks.length; i++) {
      const { href, label } = placeLinks[i];
      process.stdout.write(`\rScraping ${i + 1}/${placeLinks.length}: ${label.slice(0, 40).padEnd(40)}`);
      try {
        const clinic = await scrapePlaceDetail(page, href, label);
        if (clinic) clinics.push(clinic);
      } catch (err) {
        console.warn(`\nSkip ${label}: ${err.message}`);
      }
      await page.waitForTimeout(400);
    }
    console.log("");

    const payload = {
      scraped_at: new Date().toISOString(),
      region: "Google Maps search scrape",
      source: "google_maps_scrape",
      search_url: mapsUrl,
      count: clinics.length,
      emergency_count: clinics.filter((c) => c.emergency_capable).length,
      photo_count: clinics.filter((c) => c.image_url).length,
      notes: [
        "Scraped via Playwright from a Google Maps search URL. Review emergency_capable before production.",
        "For ongoing updates, prefer GOOGLE_PLACES_API_KEY + scrape-google-places.mjs.",
      ],
      clinics: clinics.sort((a, b) => a.name.localeCompare(b.name)),
    };

    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));

    console.log(
      `Wrote ${clinics.length} clinics (${payload.emergency_count} emergency, ${payload.photo_count} with photos) → ${OUT_FILE}`
    );

    if (doImport) {
      const r = spawnSync(
        process.execPath,
        [path.join(__dirname, "import-clinics.mjs"), `--file=${OUT_FILE}`, "--upsert"],
        { stdio: "inherit", cwd: ROOT }
      );
      process.exit(r.status ?? 1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
