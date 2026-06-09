/**
 * Remove human anti-rabies / animal-bite centers from Supabase.
 *
 * Usage: node scripts/purge-human-bite-clinics.mjs
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const { data: clinics, error } = await supabase.from("clinics").select("id, name");
  if (error) throw error;

  const toRemove = (clinics ?? []).filter((c) => isHumanBiteCenter(c.name));

  if (toRemove.length === 0) {
    console.log("No human bite centers found in database.");
    return;
  }

  for (const c of toRemove) {
    const { error: delError } = await supabase.from("clinics").delete().eq("id", c.id);
    if (delError) console.error(`Failed to delete ${c.name}: ${delError.message}`);
    else console.log(`Removed: ${c.name}`);
  }

  console.log(`Purged ${toRemove.length} human bite center(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
