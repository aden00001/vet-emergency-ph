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
        "id, name, address, phone, latitude, longitude, location_verified, emergency_capable, owner_verified, claimed_by, confidence_score, image_url, google_maps_url"
      )
      .order("id", { ascending: true })
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

  const { data: dupeStatus } = await supabase
    .from("clinic_status")
    .select("current_status, updated_at, updated_by")
    .eq("clinic_id", fromId)
    .maybeSingle();

  if (dupeStatus) {
    const { data: keeperStatus } = await supabase
      .from("clinic_status")
      .select("updated_at")
      .eq("clinic_id", toId)
      .maybeSingle();

    if (!keeperStatus || new Date(dupeStatus.updated_at) > new Date(keeperStatus.updated_at)) {
      await supabase.from("clinic_status").upsert(
        {
          clinic_id: toId,
          current_status: dupeStatus.current_status,
          updated_at: dupeStatus.updated_at,
          updated_by: dupeStatus.updated_by,
        },
        { onConflict: "clinic_id" }
      );
    }
  }

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

function hasImage(row) {
  return typeof row.image_url === "string" && row.image_url.trim().length > 0;
}

function hasCoordinates(row) {
  return row.latitude != null && row.longitude != null;
}

function hasVerifiedCoordinates(row) {
  return row.location_verified === true && hasCoordinates(row);
}

function sameCoordinates(a, b) {
  return (
    hasCoordinates(a) &&
    hasCoordinates(b) &&
    Number(a.latitude) === Number(b.latitude) &&
    Number(a.longitude) === Number(b.longitude)
  );
}

function pickBestImageRow(group, keeper) {
  if (hasImage(keeper)) return keeper;
  return group.filter(hasImage).sort((a, b) => pickScore(b) - pickScore(a))[0] ?? null;
}

function pickBestLocationRow(group, keeper) {
  if (hasVerifiedCoordinates(keeper)) return keeper;

  const verified = group
    .filter(hasVerifiedCoordinates)
    .sort((a, b) => pickScore(b) - pickScore(a))[0];
  if (verified) return verified;

  if (hasCoordinates(keeper)) return keeper;
  return group.filter(hasCoordinates).sort((a, b) => pickScore(b) - pickScore(a))[0] ?? null;
}

function pickScore(row) {
  return (
    (hasImage(row) ? 20 : 0) +
    (hasVerifiedCoordinates(row) ? 18 : hasCoordinates(row) ? 6 : 0) +
    (row.owner_verified ? 20 : 0) +
    (row.claimed_by ? 15 : 0) +
    (row.google_maps_url ? 5 : 0) +
    (row.emergency_capable ? 3 : 0) +
    ((row.confidence_score ?? 50) / 100)
  );
}

function buildKeeperPatch(group, keeper) {
  const patch = {};
  const imageRow = pickBestImageRow(group, keeper);
  const locationRow = pickBestLocationRow(group, keeper);

  if (imageRow && !hasImage(keeper)) {
    patch.image_url = imageRow.image_url;
  }

  if (!keeper.google_maps_url) {
    const mapsRow = group.find((row) => row.google_maps_url);
    if (mapsRow) patch.google_maps_url = mapsRow.google_maps_url;
  }

  if (locationRow && (!sameCoordinates(keeper, locationRow) || keeper.location_verified !== locationRow.location_verified)) {
    patch.location = `SRID=4326;POINT(${locationRow.longitude} ${locationRow.latitude})`;
    patch.location_verified = locationRow.location_verified === true;
  }

  return { patch, imageRow, locationRow };
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
    const { patch, imageRow, locationRow } = buildKeeperPatch(group, keeper);
    const dupes = group.filter((r) => r.id !== keeper.id);

    console.log(`  keep: ${keeper.name} (${keeper.id})`);
    if (imageRow && imageRow.id !== keeper.id) {
      console.log(`    copy image from: ${imageRow.name} (${imageRow.id})`);
    }
    if (locationRow && locationRow.id !== keeper.id) {
      console.log(
        `    copy coordinates from: ${locationRow.name} (${locationRow.id}) ` +
          `(${locationRow.latitude}, ${locationRow.longitude}, verified=${locationRow.location_verified})`
      );
    }
    if (!imageRow) {
      console.warn("    WARNING: no image found in this duplicate group");
    }
    if (!locationRow || !hasVerifiedCoordinates(locationRow)) {
      console.warn("    WARNING: no verified coordinates found in this duplicate group");
    }

    const readyToDedupe = Boolean(imageRow && locationRow && hasVerifiedCoordinates(locationRow));
    if (!readyToDedupe) {
      console.warn("    SKIP: survivor would not have both a photo and verified coordinates");
      if (apply) continue;
    }

    if (apply && Object.keys(patch).length) {
      const { error } = await supabase.from("clinics").update(patch).eq("id", keeper.id);
      if (error) {
        console.error(`    FAILED to update keeper ${keeper.id}: ${error.message}`);
        continue;
      }
    }

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
