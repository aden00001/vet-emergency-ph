/**
 * Shared Playwright helpers for Google Maps place search + scrape.
 */

import { extractCoordsFromUrl, extractPlaceId } from "./geocode-lib.mjs";
import { normalizePhone } from "./google-maps-parse-lib.mjs";

export { extractCoordsFromUrl, extractPlaceId, normalizePhone };

const PLACEHOLDER_IMAGE =
  /default_user\.png|\/local\/servicebusiness\/default|\/ui\/avatar|\/profile\/default/i;

export function isImageUrl(value) {
  const s = (value || "").trim();
  if (!s.startsWith("http") || PLACEHOLDER_IMAGE.test(s)) return false;
  return (
    /googleusercontent\.com/i.test(s) ||
    /streetviewpixels/i.test(s) ||
    /maps\.googleapis\.com/i.test(s)
  );
}

export function normalizeGooglePhotoUrl(url) {
  if (!url || !/googleusercontent\.com/i.test(url)) return url;
  return url.replace(/=w\d+-h\d+[^&?]*/i, "=w800-h500-k-no");
}

export function buildMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export function buildMapsPlaceUrl(name, placeId) {
  if (!placeId) return null;
  const q = encodeURIComponent(name || "veterinary clinic");
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
}

export function canonicalPlaceUrl(url) {
  if (!url || !url.includes("/maps/place/")) return null;
  return url.split("?")[0];
}

export function buildSearchQuery(name, hint) {
  const parts = [name?.trim()].filter(Boolean);
  if (hint?.trim()) parts.push(hint.trim());
  return parts.join(", ");
}

export function cityHintFromAddress(address) {
  if (!address) return "";
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";
  return parts.slice(-2).join(", ");
}

export async function dismissConsent(page) {
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

export async function waitForPlaceCoords(page, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const coords = extractCoordsFromUrl(page.url());
    if (coords) return coords;
    await page.waitForTimeout(400);
  }
  return null;
}

export async function openFirstSearchResult(page, delayMs = 1500) {
  if (page.url().includes("/maps/place/")) return true;

  const placeLink = page.locator('a[href*="/maps/place/"]').first();
  if (await placeLink.count()) {
    try {
      await placeLink.click({ timeout: 8000 });
      await page.waitForTimeout(delayMs);
      return page.url().includes("/maps/place/") || Boolean(extractCoordsFromUrl(page.url()));
    } catch {
      return false;
    }
  }

  return false;
}

export async function scrapePlacePanel(page) {
  return page.evaluate(() => {
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
      if (!address && (id.startsWith("address") || /^address:/i.test(label))) {
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

    return { pageName, image_url, phone, address, hours, category };
  });
}

export async function scrapePlaceFromPage(page, fallbackName, options = {}) {
  const { includePhoto = true } = options;
  const panel = await scrapePlacePanel(page);
  const coords =
    (await waitForPlaceCoords(page, 4000)) || extractCoordsFromUrl(page.url());

  if (!coords) return null;

  const pageUrl = page.url();
  const placeId = extractPlaceId(pageUrl);
  const name = panel.pageName || fallbackName;
  const google_maps_url =
    buildMapsPlaceUrl(name, placeId) || canonicalPlaceUrl(pageUrl) || pageUrl.split("?")[0];

  return {
    name,
    address: panel.address || null,
    phone: normalizePhone(panel.phone) || "",
    latitude: coords.latitude,
    longitude: coords.longitude,
    hours: panel.hours || null,
    category: panel.category || "",
    google_maps_url,
    google_place_id: placeId || undefined,
    image_url:
      includePhoto && isImageUrl(panel.image_url)
        ? normalizeGooglePhotoUrl(panel.image_url)
        : undefined,
    maps_page_url: pageUrl,
  };
}

export async function searchMapsByName(page, name, options = {}) {
  const { near = "", delayMs = 1800, includePhoto = true } = options;
  const query = buildSearchQuery(name, near);

  await page.goto(buildMapsSearchUrl(query), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(delayMs);

  const opened = await openFirstSearchResult(page, delayMs);
  if (!opened && !page.url().includes("/maps/place/")) {
    await page.waitForTimeout(1000);
  }

  return scrapePlaceFromPage(page, name, { includePhoto });
}
