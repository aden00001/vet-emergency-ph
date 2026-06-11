/**
 * Remove duplicate clinic rows already in Supabase.
 *
 * Usage:
 *   node scripts/dedupe-clinics-db.mjs           # dry run (report only)
 *   node scripts/dedupe-clinics-db.mjs --apply   # merge FKs and delete dupes
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { clinicsMatch, pickKeeper } from "./clinic-match.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const apply = process.argv.includes("--apply");

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

async function fetchAllClinics(supabase) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("clinics")
      .select(
        "id, name, address, phone, latitude, longitude, emergency_capable, owner_verified, claimed_by, confidence_score, image_url, google_maps_url"
      )
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function buildDuplicateGroups(rows) {
  const groups = [];
  const assigned = new Set();

  for (const row of rows) {
    if (assigned.has(row.id)) continue;
    const group = rows.filter((r) => !assigned.has(r.id) && clinicsMatch(row, r));
    if (group.length < 2) continue;
    for (const r of group) assigned.add(r.id);
    groups.push(group);
  }

  return groups;
}

async function reassignChildRows(supabase, fromId, toId) {
  await supabase.from("verifications").update({ clinic_id: toId }).eq("clinic_id", fromId);

  const { data: dupeReviews } = await supabase
    .from("clinic_reviews")
    .select("id, user_id")
    .eq("clinic_id", fromId);

  for (const review of dupeReviews ?? []) {
    if (review.user_id) {
      const { data: conflict } = await supabase
        .from("clinic_reviews")
        .select("id")
        .eq("clinic_id", toId)
        .eq("user_id", review.user_id)
        .maybeSingle();
      if (conflict) {
        await supabase.from("clinic_reviews").delete().eq("id", review.id);
        continue;
      }
    }
    await supabase.from("clinic_reviews").update({ clinic_id: toId }).eq("id", review.id);
  }

  const { data: dupeClaims } = await supabase
    .from("claim_requests")
    .select("id, user_id")
    .eq("clinic_id", fromId);

  for (const claim of dupeClaims ?? []) {
    const { data: conflict } = await supabase
      .from("claim_requests")
      .select("id")
      .eq("clinic_id", toId)
      .eq("user_id", claim.user_id)
      .maybeSingle();
    if (conflict) {
      await supabase.from("claim_requests").delete().eq("id", claim.id);
      continue;
    }
    await supabase.from("claim_requests").update({ clinic_id: toId }).eq("id", claim.id);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env in .env.local");

  const supabase = createClient(url, key);
  const rows = await fetchAllClinics(supabase);
  const groups = buildDuplicateGroups(rows);

  console.log(`Total clinics: ${rows.length}`);
  console.log(`Duplicate groups: ${groups.length}`);
  console.log(`Rows to remove: ${groups.reduce((n, g) => n + g.length - 1, 0)}`);
  console.log(apply ? "\nApplying dedupe…\n" : "\nDry run — pass --apply to delete duplicates.\n");

  let removed = 0;

  for (const group of groups) {
    const keeper = pickKeeper(group);
    const dupes = group.filter((r) => r.id !== keeper.id);

    console.log(`  keep: ${keeper.name} (${keeper.id})`);
    for (const dupe of dupes) {
      console.log(`    drop: ${dupe.name} (${dupe.id})`);
      if (!apply) continue;

      await reassignChildRows(supabase, dupe.id, keeper.id);
      const { error } = await supabase.from("clinics").delete().eq("id", dupe.id);
      if (error) {
        console.error(`    FAILED to delete ${dupe.id}: ${error.message}`);
        continue;
      }
      removed++;
    }
  }

  if (apply) {
    await supabase.rpc("refresh_all_confidence_scores");
    console.log(`\nRemoved ${removed} duplicate row(s).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
