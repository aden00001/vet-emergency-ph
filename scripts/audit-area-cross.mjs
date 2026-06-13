/**
 * Cross-area audit: flag clinics bucketed under area A when locality
 * segments more strongly indicate area B.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolveClinicArea } from "../src/lib/ph-regions.ts";

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseLocalitySegments(address) {
  const segments = normalize(address)
    .split(/[,;|]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const withoutCountry = segments.filter(
    (segment) => segment !== "philippines" && segment !== "ph"
  );

  if (withoutCountry.length === 0) return [];
  if (withoutCountry.length >= 4) return withoutCountry.slice(-3);
  if (withoutCountry.length >= 2) return withoutCountry.slice(1);
  return withoutCountry;
}

const CITY_PATTERNS = [
  ["quezon city", "Quezon City"],
  ["san juan city", "San Juan"],
  ["san juan", "San Juan"],
  ["paranaque", "Parañaque"],
  ["las pinas", "Las Piñas"],
  ["muntinlupa", "Muntinlupa / Alabang"],
  ["alabang", "Muntinlupa / Alabang"],
  ["taguig", "Taguig / BGC"],
  ["bgc", "Taguig / BGC"],
  ["makati", "Makati"],
  ["pasig", "Pasig"],
  ["pasay", "Pasay"],
  ["mandaluyong", "Mandaluyong"],
  ["caloocan", "Caloocan"],
  ["marikina", "Marikina"],
  ["valenzuela", "Valenzuela"],
  ["malabon", "Malabon"],
  ["navotas", "Navotas"],
  ["pateros", "Pateros"],
  ["manila", "Manila"],
  ["cebu city", "Cebu City"],
  ["iloilo city", "Iloilo City"],
  ["davao city", "Davao City"],
  ["cagayan de oro", "Cagayan de Oro"],
  ["zamboanga city", "Zamboanga City"],
  ["general santos", "General Santos"],
  ["cotabato city", "Cotabato City"],
  ["baguio", "Baguio"],
  ["bacolod", "Bacolod"],
  ["tacloban", "Tacloban"],
  ["butuan", "Butuan"],
  ["iligan", "Iligan"],
  ["puerto princesa", "Puerto Princesa"],
].sort((a, b) => b[0].length - a[0].length);

const PROVINCE_PATTERNS = [
  ["la union", "La Union"],
  ["rizal", "Rizal"],
  ["laguna", "Laguna"],
  ["cavite", "Cavite"],
  ["batangas", "Batangas"],
  ["bulacan", "Bulacan"],
  ["pampanga", "Pampanga"],
  ["pangasinan", "Pangasinan"],
  ["cebu", "Cebu"],
  ["iloilo", "Iloilo"],
  ["negros occidental", "Negros Occidental"],
  ["negros oriental", "Negros Oriental"],
  ["davao del norte", "Davao del Norte"],
  ["davao del sur", "Davao del Sur"],
  ["south cotabato", "South Cotabato"],
  ["cagayan", "Cagayan"],
  ["isabela", "Isabela"],
  ["quezon", "Quezon"],
].sort((a, b) => b[0].length - a[0].length);

function isManilaRoad(segment) {
  return (
    /\bmetro\s+manila\b/.test(segment) ||
    /\b(new|east|north|south|west|eastern|northern|southern)\s+manila\b/.test(segment) ||
    /\bmanila\s+(east|north|south|west|eastern|northern|southern|n|s|e|w)\b/.test(segment) ||
    /\bmanila\s+(road|rd|hwy|highway|ave|avenue|blvd|boulevard|street|st|drive|dr|way)\b/.test(segment)
  );
}

function isRoadSegment(segment, place) {
  const re = new RegExp(
    `\\b${place.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s+(ave|avenue|road|rd|st|street|blvd|boulevard|highway|hwy|drive|dr|way|ext|extension)\\b`
  );
  return re.test(segment);
}

function detectCityInSegment(segment) {
  if (segment === "manila" || segment === "city of manila") return "Manila";
  if (isManilaRoad(segment)) return null;

  for (const [pattern, label] of CITY_PATTERNS) {
    if (pattern === "manila") {
      if (/\bmanila\b/.test(segment) && /\bmanila(?:\s+\d{4})?(?:\s+metro)?\s*$/.test(segment)) {
        return label;
      }
      continue;
    }
    if (!segment.includes(pattern)) continue;
    if (pattern.includes(" ")) {
      if (isRoadSegment(segment, pattern.split(" ")[0])) continue;
      return label;
    }
    if (isRoadSegment(segment, pattern)) continue;
    if (
      segment === pattern ||
      segment === `city of ${pattern}` ||
      segment.startsWith(`${pattern} `) ||
      segment.endsWith(` ${pattern}`) ||
      segment.endsWith(pattern)
    ) {
      return label;
    }
  }
  return null;
}

function detectProvinceInSegment(segment) {
  for (const [pattern, label] of PROVINCE_PATTERNS) {
    if (!segment.includes(pattern)) continue;
    if (pattern.includes(" ")) return label;
    if (isRoadSegment(segment, pattern)) continue;
    if (
      segment === pattern ||
      segment.startsWith(`${pattern} `) ||
      segment.endsWith(` ${pattern}`) ||
      segment.endsWith(pattern)
    ) {
      return label;
    }
  }
  return null;
}

function dominantLocality(localitySegments) {
  for (let i = localitySegments.length - 1; i >= 0; i -= 1) {
    const segment = localitySegments[i];
    if (segment.includes("metro manila")) continue;
    const city = detectCityInSegment(segment);
    if (city) return { kind: "city", label: city, segment };
    const province = detectProvinceInSegment(segment);
    if (province) return { kind: "province", label: province, segment };
  }
  return null;
}

const data = JSON.parse(readFileSync("data/clinics-merged.json", "utf8"));
const clinics = Array.isArray(data) ? data : data.clinics ?? [];
const mismatches = [];

for (const clinic of clinics) {
  const address = clinic.address || "";
  if (!address) continue;

  const resolved = resolveClinicArea(address);
  if (!resolved) continue;

  const locality = parseLocalitySegments(address);
  const dominant = dominantLocality(locality);
  if (!dominant) continue;

  const resolvedLabel = resolved.label;
  const dominantLabel = dominant.label;

  if (resolvedLabel !== dominantLabel) {
    mismatches.push({
      name: clinic.name,
      address,
      resolved: resolvedLabel,
      dominant: dominantLabel,
      dominantKind: dominant.kind,
      dominantSegment: dominant.segment,
      locality: locality.join(" | "),
    });
  }
}

const byResolved = new Map();
for (const row of mismatches) {
  const key = `${row.resolved} <- ${row.dominant}`;
  byResolved.set(key, (byResolved.get(key) ?? 0) + 1);
}

console.log("Cross-area mismatches:", mismatches.length);
console.log("\nBy pattern:");
for (const [key, count] of [...byResolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${count}x ${key}`);
}

console.log("\nSamples:");
for (const row of mismatches.slice(0, 35)) {
  console.log("---");
  console.log(`${row.resolved} (resolved) vs ${row.dominant} (locality) | ${row.name}`);
  console.log(row.address);
}

writeFileSync(
  "data/area-cross-audit.json",
  JSON.stringify({ mismatches, byResolved: Object.fromEntries(byResolved) }, null, 2)
);
