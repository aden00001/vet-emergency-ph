/**
 * Backfill slug column for all clinics in Supabase.
 *
 * Usage: node scripts/backfill-clinic-slugs.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { buildClinicSlug } from "./clinic-slug.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

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

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key);
  const used = new Set();
  const rows = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("clinics")
      .select("id, name, address, slug")
      .order("created_at", { ascending: true })
      .range(from, from + 999);

    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  for (const row of rows) {
    if (row.slug) used.add(row.slug);
  }

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.slug) {
      skipped++;
      continue;
    }

    const slug = buildClinicSlug(row.name, row.address, used);
    const { error } = await supabase.from("clinics").update({ slug }).eq("id", row.id);
    if (error) {
      console.error(`Failed ${row.name}: ${error.message}`);
      continue;
    }
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} slugs written…`);
  }

  console.log(`Done: ${updated} slugs created, ${skipped} already had slugs (${rows.length} total).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
