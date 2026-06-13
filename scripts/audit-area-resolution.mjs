/**
 * Audit resolveClinicArea() against merged clinic data.
 * Flags listings whose resolved area label does not appear in locality segments.
 */
import { readFileSync, writeFileSync } from "fs";
import { resolveClinicArea } from "../src/lib/ph-regions.ts";

function parseLocalitySegments(address) {
  const segments = address
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
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

function labelInLocality(label, localitySegments) {
  const key = label.toLowerCase().replace(/ \/ .*/, "");
  return localitySegments.some((segment) => {
    if (segment.includes(key)) return true;
    if (key.includes(" ")) {
      const first = key.split(" ")[0];
      return segment.includes(first);
    }
    return false;
  });
}

const data = JSON.parse(readFileSync("data/clinics-merged.json", "utf8"));
const clinics = Array.isArray(data) ? data : data.clinics ?? [];

const byArea = new Map();
const suspicious = [];
let withArea = 0;

for (const clinic of clinics) {
  const address = clinic.address || "";
  if (!address) continue;

  const area = resolveClinicArea(address);
  if (!area) continue;
  withArea += 1;

  const locality = parseLocalitySegments(address);
  if (!labelInLocality(area.label, locality)) {
    suspicious.push({
      name: clinic.name,
      address,
      area: area.label,
      areaId: area.id,
      locality: locality.join(" | "),
    });
  }

  const bucket = byArea.get(area.label) ?? { total: 0, suspicious: 0 };
  bucket.total += 1;
  if (!labelInLocality(area.label, locality)) bucket.suspicious += 1;
  byArea.set(area.label, bucket);
}

const areaSummary = [...byArea.entries()]
  .map(([label, stats]) => ({
    label,
    total: stats.total,
    suspicious: stats.suspicious,
    rate: stats.total ? (stats.suspicious / stats.total).toFixed(3) : "0",
  }))
  .sort((a, b) => b.suspicious - a.suspicious || b.total - a.total);

console.log("Clinics with resolved area:", withArea);
console.log("Suspicious assignments:", suspicious.length);
console.log("\nTop areas by suspicious count:");
for (const row of areaSummary.filter((r) => r.suspicious > 0).slice(0, 25)) {
  console.log(`  ${row.label}: ${row.suspicious}/${row.total} (${row.rate})`);
}

console.log("\nSample suspicious listings:");
for (const row of suspicious.slice(0, 30)) {
  console.log("---");
  console.log(`${row.area} | ${row.name}`);
  console.log(row.address);
  console.log(`locality: ${row.locality}`);
}

writeFileSync(
  "data/area-resolution-audit.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), withArea, suspiciousCount: suspicious.length, areaSummary, suspicious }, null, 2)
);
console.log("\nWrote data/area-resolution-audit.json");
