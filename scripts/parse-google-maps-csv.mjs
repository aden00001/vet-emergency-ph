/**
 * Parse Google Maps scraper CSV export → clinics JSON for import.
 *
 * Expects columns like: URL, name, rating, reviews, category, ·, address, hours, ·, phone...
 * Lat/lng extracted from Google Maps URL: !3d14.xxx!4d121.xxx
 *
 * Usage:
 *   node scripts/parse-google-maps-csv.mjs data/google-maps-export.csv
 *   node scripts/parse-google-maps-csv.mjs data/google-maps-export.csv --import
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const inputPath = process.argv[2] || path.join(ROOT, "data", "google-maps-export.csv");
const doImport = process.argv.includes("--import");
const outPath = path.join(ROOT, "data", "clinics-google-maps.json");

const SKIP_CATEGORIES = [
  "pet groomer",
  "pet funeral",
  "pet store",
  "department store",
  "government office",
  "government",
  "general practitioner",
  "college",
  "university",
  "importer",
  "medical laboratory",
  "laboratory",
];

const SKIP_NAME = [
  /pet funeral/i,
  /aftercare/i,
  /aquamation/i,
  /paws to heaven/i,
  /precious paws aftercare/i,
  /^bureau of animal industry/i,
  /quarantine services/i,
  /veterinary department$/i,
  /animal health and welfare division/i,
  /^DR Animal Bite Clinic$/i,
  /prime animal bite clinic/i,
  /wecare animal bite clinic/i,
  /^dr\.?\s+mayem yao$/i,
  /college of veterinary/i,
  /veterinary medical association$/i,
  /retail veterinary medicines/i,
  /philippine college of canine/i,
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

function extractCoords(url) {
  const m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
  return null;
}

function normalizePhone(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/facebook.*/i, "").trim();
  const m = cleaned.match(/(?:\+63|0)?[\d\s().-]{8,}/);
  if (!m) return "";
  const digits = m[0].replace(/\D/g, "");
  if (looksLikeCoordinateDigits(digits)) return "";
  if (digits.startsWith("63") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.length === 10) return `+63${digits}`;
  if (digits.length >= 8 && digits.length <= 11) return `+63${digits.replace(/^0/, "")}`;
  if (digits.length === 7 && /^[2-9]/.test(digits)) return `+632${digits}`;
  return "";
}

/** Reject lat/lng digit runs accidentally parsed from Maps URLs or coords */
function looksLikeCoordinateDigits(digits) {
  if (!digits || digits.length < 7) return false;
  if (/^14\d{6,9}$/.test(digits)) return true;
  if (/^121\d{6,9}$/.test(digits)) return true;
  const asNum = Number(digits);
  if (asNum >= 14 && asNum <= 15 && digits.length >= 8) return true;
  if (asNum >= 120 && asNum <= 122 && digits.length >= 8) return true;
  return false;
}

function buildColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = (h || "").trim().toLowerCase();
    if (key) map[key] = i;
  });
  return map;
}

const PLACEHOLDER_IMAGE =
  /default_user\.png|\/local\/servicebusiness\/default|\/ui\/avatar|\/profile\/default/i;

function isImageUrl(value) {
  const s = (value || "").trim();
  if (!s.startsWith("http") || PLACEHOLDER_IMAGE.test(s)) return false;
  return (
    /googleusercontent\.com/i.test(s) ||
    /streetviewpixels/i.test(s) ||
    /maps\.googleapis\.com/i.test(s) ||
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(s)
  );
}

function extractPlaceId(url) {
  const m = url.match(/1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function extractImageUrl(cells, colMap) {
  // Browser-extension scrapers (Jn12ke src) and Outscraper-style exports (photo)
  for (const key of ["jn12ke src", "photo", "main_photo", "image", "image_url"]) {
    const idx = colMap[key];
    if (idx == null) continue;
    const fromCol = cells[idx]?.trim();
    if (isImageUrl(fromCol)) return fromCol;
  }
  for (const cell of cells) {
    const t = cell?.trim() ?? "";
    if (isImageUrl(t)) return t;
  }
  return null;
}

function cleanGoogleMapsName(name) {
  let cleaned = name
    .replace(/\s+[|lI]\s+(Quezon City|Manila|Metro Manila|Makati|Taguig|Pasig)[^]*$/i, "")
    .replace(/\s+\|\s+/g, " — ")
    .trim();
  if (/^pawprint\b/i.test(cleaned)) {
    cleaned = cleaned.replace(/^Pawprint/i, "Paw Print");
  }
  return cleaned;
}

function isVetRelevant(name, category, cells) {
  const text = `${name} ${category} ${cells.join(" ")}`.toLowerCase();
  if (SKIP_NAME.some((re) => re.test(name))) return false;
  if (isHumanBiteCenter(name, category)) return false;
  if (SKIP_CATEGORIES.some((s) => category.toLowerCase().includes(s))) {
    if (!/vet|veterinar|animal hospital|animal clinic|emergency|911|pet clinic/i.test(text)) {
      return false;
    }
  }
  return /vet|veterinar|animal|pet clinic|emergency|911|paw|medical center/i.test(text);
}

function inferEmergency(name, category, hoursText, cells) {
  const text = `${name} ${category} ${hoursText} ${cells.join(" ")}`.toLowerCase();
  if (isHumanBiteCenter(name, category)) return false;
  if (/open 24 hours|24\s*\/\s*7|24 hrs|24 hour|on call emergency|emergency veterinarian|pet emergency/i.test(text)) {
    return true;
  }
  if (/animal hospital|vet 911|serbisyo beterinaryo/i.test(text) && /24|emergency/i.test(text)) {
    return true;
  }
  return false;
}

function looksLikeReviewText(t) {
  if (!t) return true;
  if (/^["'“”]/.test(t) || /["'“”]$/.test(t)) return true;
  if (/^[\d.]+ \(/.test(t) || /^\(\d+\)$/.test(t)) return true;
  if (t.length > 90 && /\b(my|they|the vet|our pet|very friendly|affordable)\b/i.test(t)) return true;
  if (/^(vet|doctors?|services?|medicines?)$/i.test(t)) return true;
  return false;
}

function buildAddress(cells) {
  const skip = new Set([
    "·",
    "Directions",
    "Website",
    "Open 24 hours",
    "Closed",
    "Onsite services",
  ]);
  const parts = [];
  for (const c of cells) {
    const t = c.trim();
    if (!t || skip.has(t)) continue;
    if (/^·\s*opens?\s/i.test(t) || /^opens?\s/i.test(t)) continue;
    if (/^https?:\/\//.test(t)) continue;
    if (/^[\uE000-\uF8FF]/.test(t)) continue;
    if (/^(Veterinarian|Animal hospital|Medical clinic|Hospital|Veterinary care|Emergency veterinarian service|Pet supply store|Emergency veterinarian service)$/i.test(t)) continue;
    if (/^\d\.\d$/.test(t)) continue;
    if (/^\+?\d[\d\s().-]{7,}$/.test(t.replace(/\s/g, ""))) continue;
    if (/contact via facebook/i.test(t)) continue;
    if (looksLikeReviewText(t)) continue;
    if (parts.includes(t)) continue;
    parts.push(t);
  }
  return parts.slice(0, 3).join(", ").replace(/,\s*,/g, ",").replace(/,\s*"/g, ",").trim();
}

function parseRow(cells, colMap = {}) {
  const urlIdx = colMap["hfpxzc href"] ?? 0;
  const nameIdx = colMap["qbf1pd"] ?? 1;
  const categoryIdx = colMap["w4efsd"] ?? 4;

  const url = cells[urlIdx]?.trim() || "";
  if (!url.includes("google.com/maps/place")) return null;

  const name = cleanGoogleMapsName(cells[nameIdx]?.trim() || "");
  if (!name) return null;

  const coords = extractCoords(url);
  if (!coords) return null;

  const category = cells[categoryIdx]?.trim() || "";
  const image_url = extractImageUrl(cells, colMap);
  if (!isVetRelevant(name, category, cells)) return null;

  let phone = "";
  let contactNote = "";
  let hoursText = "";
  // Skip column 0 (Maps URL) — it contains lat/lng that were misread as phone numbers
  for (let i = 1; i < cells.length; i++) {
    const t = cells[i]?.trim() ?? "";
    if (/contact via facebook/i.test(t)) {
      contactNote = "Contact via Facebook";
      continue;
    }
    if (/open 24 hours|24\s*\/\s*7|closed|opens?\s+\d/i.test(t)) hoursText += ` ${t}`;
    const p = normalizePhone(t);
    if (p && !phone) phone = p;
  }

  const address = buildAddress(cells.slice(4));
  const emergency_capable = inferEmergency(name, category, hoursText, cells);

  return {
    name,
    address: address || `${coords.latitude}, ${coords.longitude}`,
    phone,
    latitude: coords.latitude,
    longitude: coords.longitude,
    emergency_capable,
    owner_verified: false,
    services: emergency_capable
      ? ["trauma", "poisoning", "respiratory"]
      : ["trauma"],
    hours: hoursText.trim() || null,
    contact_note: contactNote || undefined,
    source: "google_maps_scrape",
    google_maps_url: url.split("?")[0],
    google_place_id: extractPlaceId(url) || undefined,
    image_url: image_url || undefined,
    category,
  };
}

function isSameLocation(a, b) {
  return (
    Math.abs(a.latitude - b.latitude) < 0.0008 &&
    Math.abs(a.longitude - b.longitude) < 0.0008
  );
}

function mergeClinic(dupe, c) {
  if (c.phone && !dupe.phone) dupe.phone = c.phone;
  if (c.emergency_capable) dupe.emergency_capable = true;
  if (c.hours && (!dupe.hours || c.hours.length > dupe.hours.length)) dupe.hours = c.hours;
  if (c.image_url && !dupe.image_url) dupe.image_url = c.image_url;
  if (c.address && c.address.length > (dupe.address?.length ?? 0)) dupe.address = c.address;
  if (c.name.length > dupe.name.length) dupe.name = c.name;
}

function dedupe(clinics) {
  const kept = [];
  for (const c of clinics) {
    const dupe = kept.find(
      (k) =>
        (c.google_place_id && k.google_place_id === c.google_place_id) ||
        (k.name.toLowerCase() === c.name.toLowerCase() && isSameLocation(k, c))
    );
    if (!dupe) kept.push(c);
    else mergeClinic(dupe, c);
  }
  return kept;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(inputPath, "utf8");
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const colMap = buildColumnMap(header);
  const dataRows = rows.slice(1);

  const parsed = dataRows
    .map((row) => parseRow(row, colMap))
    .filter(Boolean);

  const clinics = dedupe(parsed).sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Metro Manila (Google Maps export)",
    source: "google_maps_scrape",
    count: clinics.length,
    emergency_count: clinics.filter((c) => c.emergency_capable).length,
    notes: [
      "Parsed from Google Maps CSV export. Review before treating emergency_capable as verified.",
      "Excluded: pet groomers-only, funeral services, most government offices.",
    ],
    clinics,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  const photoCount = clinics.filter((c) => c.image_url).length;
  console.log(`Parsed ${clinics.length} vet clinics (${payload.emergency_count} flagged emergency-capable, ${photoCount} with photos)`);
  console.log(`Wrote ${outPath}`);
  if (photoCount === 0 && header.some((h) => /jn12ke/i.test(h))) {
    console.warn(
      "CSV header has image column but no photo URLs in rows — use a full Google Maps export (Jn12ke src populated) for listing photos."
    );
  }

  if (doImport) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "import-clinics.mjs"), `--file=${outPath}`, "--upsert"],
      { stdio: "inherit", cwd: ROOT }
    );
    process.exit(r.status ?? 1);
  }
}

main();
