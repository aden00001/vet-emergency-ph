/**
 * Audit clinic data across CSV → JSON → Supabase.
 *
 * Usage:
 *   node scripts/audit-clinic-data.mjs
 *   node scripts/audit-clinic-data.mjs --fix-report   # writes data/audit-report.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

function normName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function looksLikeLatPhone(phone, latitude) {
  if (!phone || latitude == null) return false;
  if (/facebook|contact via/i.test(phone)) return false;
  const latDigits = String(latitude).replace(".", "").replace(/^0+/, "");
  const phoneDigits = phone.replace(/\D/g, "");
  return phoneDigits.endsWith(latDigits.slice(0, 9)) || /^\+6314\d{7,9}$/.test(phone);
}

function hasCallablePhone(phone) {
  if (!phone) return false;
  if (/facebook|contact via/i.test(phone)) return false;
  return /^\+?\d[\d\s().-]{7,}$/.test(phone.trim());
}

function distanceM(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function main() {
  const writeReport = process.argv.includes("--fix-report");

  const google = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "clinics-google-maps.json"), "utf8")
  ).clinics;
  const manual = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "clinics-manual.json"), "utf8")
  ).clinics;
  const osm = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "clinics-scraped.json"), "utf8")
  ).clinics;

  const csvLines = fs
    .readFileSync(path.join(ROOT, "data", "google-maps-export.csv"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean).length;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const supabase = createClient(url, key);
  const { data: dbRows, error } = await supabase
    .from("clinics")
    .select("id, name, phone, address, latitude, longitude, emergency_capable");

  if (error) throw error;

  const dbByNorm = new Map((dbRows ?? []).map((r) => [normName(r.name), r]));

  const issues = [];

  for (const c of google) {
    if (isHumanBiteCenter(c.name, c.category)) {
      issues.push({
        severity: "error",
        type: "human_bite_center",
        name: c.name,
        source: "google",
      });
    }
    if (!hasCallablePhone(c.phone) && !c.contact_note) {
      issues.push({ severity: "error", type: "missing_phone", name: c.name });
    } else if (!hasCallablePhone(c.phone) && c.contact_note) {
      issues.push({
        severity: "warn",
        type: "facebook_only_contact",
        name: c.name,
        contact_note: c.contact_note,
      });
    } else if (looksLikeLatPhone(c.phone, c.latitude)) {
      issues.push({
        severity: "error",
        type: "phone_is_latitude",
        name: c.name,
        phone: c.phone,
        latitude: c.latitude,
      });
    }
    if (/\bl\s+Quezon City|\|\s*Quezon/i.test(c.name)) {
      issues.push({ severity: "warn", type: "mangled_google_name", name: c.name });
    }
    if (c.address && /\d+\.\d+,\s*\d+\.\d+/.test(c.address)) {
      issues.push({
        severity: "warn",
        type: "coord_fallback_address",
        name: c.name,
        address: c.address,
      });
    }

    const db = dbByNorm.get(normName(c.name));
    if (!db) {
      issues.push({ severity: "error", type: "missing_in_db", name: c.name, source: "google" });
    } else if (!hasCallablePhone(db.phone) && /facebook|contact via/i.test(db.phone ?? "")) {
      issues.push({
        severity: "warn",
        type: "db_facebook_only_phone",
        name: db.name,
        phone: db.phone,
      });
    } else if (db.phone !== c.phone && looksLikeLatPhone(db.phone, db.latitude)) {
      issues.push({
        severity: "error",
        type: "db_bad_phone",
        name: db.name,
        phone: db.phone,
      });
    }
  }

  for (const row of dbRows ?? []) {
    if (isHumanBiteCenter(row.name)) {
      issues.push({
        severity: "error",
        type: "human_bite_center_in_db",
        name: row.name,
      });
    }
  }

  for (const c of manual) {
    const db = dbByNorm.get(normName(c.name));
    if (!db) {
      issues.push({ severity: "error", type: "missing_in_db", name: c.name, source: "manual" });
    } else if (!hasCallablePhone(c.phone) && !c.contact_note) {
      issues.push({ severity: "error", type: "missing_phone", name: c.name, source: "manual" });
    }
  }

  // OSM entries within 80m of a Google/manual pin but different name
  for (const o of osm) {
    if (o.latitude == null) continue;
    const near = [...google, ...manual].find(
      (g) => distanceM(o, g) < 80
    );
    if (near && normName(o.name) !== normName(near.name)) {
      issues.push({
        severity: "info",
        type: "alias_candidate",
        osm: o.name,
        curated: near.name,
        meters: Math.round(distanceM(o, near)),
      });
    }
  }

  const summary = {
    csv_rows: csvLines - 1,
    google_json: google.length,
    manual_json: manual.length,
    osm_json: osm.length,
    db_total: dbRows?.length ?? 0,
    issues_by_type: issues.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {}),
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warn"),
  };

  console.log("=== Clinic data audit ===");
  console.log(`CSV rows: ${summary.csv_rows} | Google JSON: ${summary.google_json} | Manual: ${summary.manual_json} | OSM: ${summary.osm_json} | DB: ${summary.db_total}`);
  console.log("Issues:", summary.issues_by_type);
  console.log("\nErrors:");
  for (const e of summary.errors.slice(0, 30)) console.log(" ", e);
  if (summary.errors.length > 30) console.log(`  ... and ${summary.errors.length - 30} more`);

  if (writeReport) {
    const out = path.join(ROOT, "data", "audit-report.json");
    fs.writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), ...summary, issues }, null, 2));
    console.log(`\nWrote ${out}`);
  }

  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
