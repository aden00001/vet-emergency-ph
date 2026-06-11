/**
 * Find clinics that need Playwright Google Maps enrichment
 * (missing plus code, broken Maps URL, bad/missing coordinates).
 *
 * Usage:
 *   node scripts/audit-location-issues.mjs
 *   node scripts/audit-location-issues.mjs --file=data/clinics-merged.json --write
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyClinic } from "./location-audit-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const writeReport = args.includes("--write");
const inputPath =
  fileArg?.split("=")[1] ?? path.join(ROOT, "data", "clinics-merged.json");

function main() {
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

  const rows = clinics.map(classifyClinic);
  const needsPlaywright = rows.filter((r) => r.needs_playwright);
  const needsPinFix = rows.filter((r) => r.needs_pin_fix);
  const needsEnrichment = rows.filter((r) => r.needs_enrichment);
  const metroManila = rows.filter((r) => r.region === "metro_manila");
  const outsideNcr = rows.filter((r) => r.region === "outside_ncr");

  const issueCounts = {};
  for (const row of rows) {
    for (const issue of row.issues) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
  }

  const overlap = {
    missing_coords_and_no_plus: needsPlaywright.filter((r) =>
      r.issues.includes("missing_coordinates") && r.issues.includes("missing_plus_code_in_address")
    ).length,
    has_coords_no_plus_broken_url: needsPlaywright.filter(
      (r) =>
        !r.issues.includes("missing_coordinates") &&
        r.issues.includes("missing_plus_code_in_address") &&
        r.issues.includes("broken_maps_url")
    ).length,
    bad_geocode_with_place_id: needsPlaywright.filter((r) =>
      r.issues.includes("bad_geocode")
    ).length,
  };

  const summary = {
    audited_at: new Date().toISOString(),
    source_file: inputPath,
    total_clinics: clinics.length,
    metro_manila_total: metroManila.length,
    outside_ncr_total: outsideNcr.length,
    needs_pin_fix: needsPinFix.length,
    needs_pin_fix_metro_manila: needsPinFix.filter((r) => r.region === "metro_manila").length,
    needs_pin_fix_outside_ncr: needsPinFix.filter((r) => r.region === "outside_ncr").length,
    needs_enrichment_outside_ncr: needsEnrichment.length,
    needs_playwright: needsPlaywright.length,
    metro_manila_pins_ok: metroManila.filter((r) => !r.needs_pin_fix).length,
    issue_counts: issueCounts,
    overlap,
    notes: [
      "Metro Manila listings with working pins are excluded unless missing coordinates, unverified, or bad geocode.",
    ],
  };

  console.log("Location issue audit\n");
  console.log(`Total clinics:              ${summary.total_clinics}`);
  console.log(`  Metro Manila:             ${summary.metro_manila_total} (${summary.metro_manila_pins_ok} pins OK — skipped)`);
  console.log(`  Outside NCR:              ${summary.outside_ncr_total}`);
  console.log(`Need pin fix:               ${summary.needs_pin_fix}`);
  console.log(`  Metro Manila exceptions:  ${summary.needs_pin_fix_metro_manila}`);
  console.log(`  Outside NCR:              ${summary.needs_pin_fix_outside_ncr}`);
  console.log(`Need enrichment (outside):  ${summary.needs_enrichment_outside_ncr} (plus code / Maps URL only)`);
  console.log(`Playwright total:           ${summary.needs_playwright}`);
  console.log("\nIssue breakdown:");
  for (const [issue, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${issue}: ${count}`);
  }
  console.log("\nPlaywright target overlap:");
  for (const [key, count] of Object.entries(overlap)) {
    console.log(`  ${key}: ${count}`);
  }

  if (writeReport) {
    const outPath = path.join(ROOT, "data", "location-issues-report.json");
    const payload = {
      ...summary,
      pin_fix_clinics: needsPinFix,
      enrichment_clinics: needsEnrichment,
      clinics: needsPlaywright,
    };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`\nWrote ${needsPinFix.length} pin-fix + ${needsEnrichment.length} enrichment → ${outPath}`);
  } else {
    console.log("\nRun with --write to save data/location-issues-report.json");
  }
}

main();
