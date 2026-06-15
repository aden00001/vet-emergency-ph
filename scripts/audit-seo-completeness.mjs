/**
 * SEO-focused clinic data completeness audit (Supabase only).
 *
 * Usage:
 *   npm run audit:seo
 *   npm run audit:seo -- --json   # writes data/seo-audit.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

function pct(n, total) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function hasPhone(phone) {
  if (!phone?.trim()) return false;
  if (/facebook|contact via/i.test(phone)) return false;
  return /^\+?\d[\d\s().-]{7,}$/.test(phone.trim());
}

function hasHours(hours) {
  return Boolean(hours?.trim());
}

function hasCoords(row) {
  return (
    row.latitude != null &&
    row.longitude != null &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude)
  );
}

async function main() {
  const writeJson = process.argv.includes("--json");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("clinics")
      .select(
        "id, name, slug, phone, hours, address, latitude, longitude, emergency_capable"
      )
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  const total = rows.length;
  const withPhone = rows.filter((r) => hasPhone(r.phone)).length;
  const withHours = rows.filter((r) => hasHours(r.hours)).length;
  const withCoords = rows.filter((r) => hasCoords(r)).length;
  const withSlug = rows.filter((r) => r.slug?.trim()).length;
  const withAddress = rows.filter((r) => r.address?.trim()).length;
  const emergency = rows.filter((r) => r.emergency_capable).length;
  const emergencyMissingPhone = rows.filter(
    (r) => r.emergency_capable && !hasPhone(r.phone)
  ).length;
  const emergencyMissingHours = rows.filter(
    (r) => r.emergency_capable && !hasHours(r.hours)
  ).length;
  const schemaReady = rows.filter(
    (r) => hasPhone(r.phone) && hasHours(r.hours) && hasCoords(r) && r.slug?.trim()
  ).length;

  const report = {
    generated_at: new Date().toISOString(),
    total,
    emergency_capable: emergency,
    with_phone: withPhone,
    with_hours: withHours,
    with_coordinates: withCoords,
    with_slug: withSlug,
    with_address: withAddress,
    schema_ready: schemaReady,
    emergency_missing_phone: emergencyMissingPhone,
    emergency_missing_hours: emergencyMissingHours,
  };

  console.log("=== SEO data completeness ===");
  console.log(`Total clinics: ${total}`);
  console.log(`Emergency-capable: ${emergency}`);
  console.log(`Phone: ${withPhone} (${pct(withPhone, total)})`);
  console.log(`Hours: ${withHours} (${pct(withHours, total)})`);
  console.log(`Coordinates: ${withCoords} (${pct(withCoords, total)})`);
  console.log(`Slug URL: ${withSlug} (${pct(withSlug, total)})`);
  console.log(`Address: ${withAddress} (${pct(withAddress, total)})`);
  console.log(
    `Schema-ready (phone + hours + coords + slug): ${schemaReady} (${pct(schemaReady, total)})`
  );
  console.log(`Emergency missing phone: ${emergencyMissingPhone}`);
  console.log(`Emergency missing hours: ${emergencyMissingHours}`);

  if (writeJson) {
    const out = path.join(ROOT, "data", "seo-audit.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
