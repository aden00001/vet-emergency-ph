/**
 * Merge multiple clinic JSON files (Outscraper exports or parsed clinic lists).
 * Combines all inputs, deduplicates, and removes human bite centers.
 *
 * Usage:
 *   node scripts/merge-clinic-json.mjs export-cebu.json export-davao.json
 *   node scripts/merge-clinic-json.mjs data/*.json --out=data/clinics-philippines.json
 *   node scripts/merge-clinic-json.mjs file1.json file2.json --merge-existing
 *   node scripts/merge-clinic-json.mjs file1.json --import
 *
 * Drop new Outscraper JSON files anywhere, then pass their paths. Supports:
 *   - Raw Outscraper array: [{ title, categoryName, ... }]
 *   - Wrapped export: { results: [...] } or { data: [...] }
 *   - Parsed clinics: { clinics: [{ name, ... }] } or [{ name, ... }]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import {
  dedupeClinics,
  extractOutscraperRows,
  filterBiteCenters,
  isOutscraperExport,
  isParsedClinicsExport,
  parseOutscraperRows,
} from "./google-maps-parse-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "clinics-google-maps.json");

const args = process.argv.slice(2);
const inputPaths = args.filter((a) => !a.startsWith("--"));
const doImport = args.includes("--import");
const mergeExisting = args.includes("--merge-existing");
const outPath = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? DEFAULT_OUT;

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadClinicsFromFile(filePath) {
  const raw = loadJson(filePath);
  const baseName = path.basename(filePath);

  if (isOutscraperExport(raw)) {
    const rows = extractOutscraperRows(raw);
    const { clinics, excludedBite, excludedOther } = parseOutscraperRows(rows);
    return {
      file: baseName,
      format: "outscraper",
      clinics,
      excludedBite,
      excludedOther,
    };
  }

  if (isParsedClinicsExport(raw)) {
    const clinics = Array.isArray(raw) ? raw : raw.clinics;
    const { clinics: filtered, removed } = filterBiteCenters(clinics);
    return {
      file: baseName,
      format: "parsed",
      clinics: filtered,
      excludedBite: removed,
      excludedOther: 0,
    };
  }

  throw new Error(
    `${baseName}: unrecognized JSON format (expected Outscraper export or { clinics: [...] })`
  );
}

async function main() {
  if (!inputPaths.length) {
    console.error(`Usage: node scripts/merge-clinic-json.mjs <file1.json> [file2.json ...] [options]

Options:
  --out=path           Output file (default: data/clinics-google-maps.json)
  --merge-existing     Also merge clinics from the output file if it already exists
  --import             Run import-clinics.mjs --upsert after writing

Examples:
  node scripts/merge-clinic-json.mjs data/cebu-outscraper.json data/davao-outscraper.json
  node scripts/merge-clinic-json.mjs data/imports/*.json --out=data/clinics-philippines.json`);
    process.exit(1);
  }

  const fileStats = [];
  let allClinics = [];

  for (const inputPath of inputPaths) {
    const stat = loadClinicsFromFile(inputPath);
    fileStats.push(stat);
    allClinics.push(...stat.clinics);
    console.log(
      `${stat.file}: ${stat.clinics.length} clinics (${stat.format}, ${stat.excludedBite} bite centers excluded${
        stat.excludedOther ? `, ${stat.excludedOther} non-vet skipped` : ""
      })`
    );
  }

  let existingCount = 0;
  if (mergeExisting && fs.existsSync(outPath)) {
    const prev = loadJson(outPath);
    const existing = Array.isArray(prev) ? prev : (prev.clinics ?? []);
    const { clinics: filteredExisting, removed } = filterBiteCenters(existing);
    existingCount = filteredExisting.length;
    allClinics = [...filteredExisting, ...allClinics];
    if (removed) console.log(`Existing output: removed ${removed} bite center(s)`);
  }

  const { clinics: withoutBites, removed: postRemoved } = filterBiteCenters(allClinics);
  let clinics = dedupeClinics(withoutBites).sort((a, b) => a.name.localeCompare(b.name));

  const inputFiles = inputPaths.map((p) => path.basename(p));
  const payload = {
    scraped_at: new Date().toISOString(),
    region: "Philippines (merged Google Maps exports)",
    source: "google_maps_scrape",
    input_files: inputFiles,
    count: clinics.length,
    emergency_count: clinics.filter((c) => c.emergency_capable).length,
    with_coordinates: clinics.filter((c) => c.latitude != null).length,
    notes: [
      "Merged from multiple JSON inputs. Review before treating emergency_capable as verified.",
      "Excluded: human bite centers (anti-rabies / PEP clinics for people).",
      mergeExisting && existingCount
        ? `Merged with ${existingCount} existing clinics from ${path.basename(outPath)}.`
        : "",
    ].filter(Boolean),
    clinics,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  const totalFromInputs = fileStats.reduce((n, s) => n + s.clinics.length, 0);
  const totalBiteExcluded = fileStats.reduce((n, s) => n + s.excludedBite, 0);

  console.log(`\nLoaded ${totalFromInputs} clinics from ${inputPaths.length} file(s)`);
  console.log(`Excluded ${totalBiteExcluded} bite center(s) during parse`);
  if (postRemoved) console.log(`Removed ${postRemoved} additional bite center(s) after merge`);
  if (mergeExisting && existingCount) {
    console.log(`Included ${existingCount} existing clinic(s) from output file`);
  }
  console.log(`→ ${clinics.length} unique clinics after dedupe`);
  console.log(
    `${payload.emergency_count} emergency-capable, ${payload.with_coordinates} with coordinates`
  );
  console.log(`Wrote ${outPath}`);

  if (doImport) {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "import-clinics.mjs"), `--file=${outPath}`, "--upsert"],
      { stdio: "inherit", cwd: ROOT }
    );
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
