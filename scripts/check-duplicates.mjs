/**
 * Detect duplicate clinic listings in the live Supabase `clinics` table.
 *
 * Reports:
 *   - exact_name        : same normalized name appearing >1 time
 *   - near_duplicate    : different names within 60m of each other (likely same place)
 *
 * Usage:
 *   node scripts/check-duplicates.mjs
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

function normName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distanceM(a, b) {
  if (a.latitude == null || b.latitude == null) return Infinity;
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase
    .from("clinics")
    .select("id, name, phone, address, latitude, longitude");
  if (error) throw error;

  console.log(`Total clinics in DB: ${rows.length}\n`);

  // 1) Exact normalized-name duplicates
  const byName = new Map();
  for (const r of rows) {
    const k = normName(r.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const nameDupes = [...byName.values()].filter((g) => g.length > 1);

  console.log(`=== Exact name duplicates: ${nameDupes.length} group(s) ===`);
  for (const g of nameDupes) {
    console.log(`\n  "${g[0].name}" x${g.length}`);
    for (const r of g) {
      console.log(`    - id=${r.id} | ${r.phone ?? "no phone"} | ${r.address ?? "no address"}`);
    }
  }

  // 2) Near-duplicate by proximity with different names
  const near = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (normName(a.name) === normName(b.name)) continue; // already caught above
      const d = distanceM(a, b);
      if (d < 60) near.push({ a, b, meters: Math.round(d) });
    }
  }
  near.sort((x, y) => x.meters - y.meters);

  console.log(`\n\n=== Near-duplicate pairs (<60m, different names): ${near.length} ===`);
  for (const n of near) {
    console.log(`\n  ${n.meters}m apart:`);
    console.log(`    - id=${n.a.id} "${n.a.name}"`);
    console.log(`    - id=${n.b.id} "${n.b.name}"`);
  }

  console.log(
    `\n\nSummary: ${nameDupes.length} exact-name dup group(s), ${near.length} near-dup pair(s).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
