/**
 * Import reviewed clinic JSON into Supabase.
 *
 * Usage:
 *   node scripts/import-clinics.mjs              # merge (skip duplicates by name)
 *   node scripts/import-clinics.mjs --replace    # wipe clinics + re-import
 *   node scripts/import-clinics.mjs --upsert         # update existing rows by name
 *   node scripts/import-clinics.mjs --file=data/clinics-merged.json --geocode-first --upsert
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { isHumanBiteCenter } from "./clinic-exclusions.mjs";
import {
  findMatchingRows,
  getPlaceId,
  pickKeeper,
} from "./clinic-match.mjs";
import { geocodeClinics } from "./geocode-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const upsert = args.includes("--upsert");
const geocodeFirst = args.includes("--geocode-first");
const fileArg = args.find((a) => a.startsWith("--file="));
const inputFile = fileArg
  ? fileArg.split("=")[1]
  : path.join(ROOT, "data", "clinics-scraped.json");

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
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Missing ${inputFile} — run: node scripts/scrape-clinics.mjs`);
  }

  const payload = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const clinics = payload.clinics ?? payload;
  if (!Array.isArray(clinics) || clinics.length === 0) {
    throw new Error("No clinics in input file");
  }

  if (geocodeFirst) {
    const missing = clinics.filter((c) => c.latitude == null || c.longitude == null).length;
    if (missing) {
      console.log(`Geocoding ${missing} clinic(s) before import (~1 sec each)…`);
      const stats = await geocodeClinics(clinics, {
        onProgress({ phase, label, result, reason }) {
          if (phase === "start") process.stdout.write(`  ${label} … `);
          else if (phase === "ok") console.log(`${result.latitude}, ${result.longitude}`);
          else console.log(`NOT FOUND${reason ? ` (${reason})` : ""}`);
        },
      });
      console.log(
        `Geocode done: ${stats.geocoded} found, ${stats.failed} failed, ${stats.skipped} already had coordinates`
      );
      if (payload.clinics) {
        payload.clinics = clinics;
        payload.with_coordinates = clinics.filter((c) => c.latitude != null).length;
        fs.writeFileSync(inputFile, JSON.stringify(payload, null, 2));
        console.log(`Saved coordinates back to ${inputFile}`);
      }
    }
  }

  const supabase = createClient(url, key);

  if (replace) {
    console.log("Replacing all clinic data...");
    await supabase.from("verifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("clinic_status").delete().neq("clinic_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("claim_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("clinics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const existingRows = await fetchAllClinics(supabase);

  async function removeDuplicateRows(keeperId, dupeIds) {
    for (const dupeId of dupeIds) {
      await supabase.from("verifications").update({ clinic_id: keeperId }).eq("clinic_id", dupeId);

      const { data: dupeReviews } = await supabase
        .from("clinic_reviews")
        .select("id, user_id")
        .eq("clinic_id", dupeId);
      for (const review of dupeReviews ?? []) {
        if (review.user_id) {
          const { data: conflict } = await supabase
            .from("clinic_reviews")
            .select("id")
            .eq("clinic_id", keeperId)
            .eq("user_id", review.user_id)
            .maybeSingle();
          if (conflict) {
            await supabase.from("clinic_reviews").delete().eq("id", review.id);
            continue;
          }
        }
        await supabase.from("clinic_reviews").update({ clinic_id: keeperId }).eq("id", review.id);
      }

      const { data: dupeClaims } = await supabase
        .from("claim_requests")
        .select("id, user_id")
        .eq("clinic_id", dupeId);
      for (const claim of dupeClaims ?? []) {
        const { data: conflict } = await supabase
          .from("claim_requests")
          .select("id")
          .eq("clinic_id", keeperId)
          .eq("user_id", claim.user_id)
          .maybeSingle();
        if (conflict) {
          await supabase.from("claim_requests").delete().eq("id", claim.id);
          continue;
        }
        await supabase.from("claim_requests").update({ clinic_id: keeperId }).eq("id", claim.id);
      }

      const { error } = await supabase.from("clinics").delete().eq("id", dupeId);
      if (error) console.error(`  Dedupe delete failed ${dupeId}: ${error.message}`);
      else {
        const idx = existingRows.findIndex((r) => r.id === dupeId);
        if (idx !== -1) existingRows.splice(idx, 1);
      }
    }
  }

  function findExistingMatches(clinic) {
    const probe = {
      name: clinic.name,
      address: clinic.address || null,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      google_place_id: clinic.google_place_id,
      google_maps_url: clinic.google_maps_url,
    };
    return findMatchingRows(probe, existingRows);
  }

  function isBadPhone(phone) {
    return /^\+6314\d{7,9}$/.test(phone ?? "");
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let excluded = 0;
  let deduped = 0;

  for (const c of clinics) {
    if (isHumanBiteCenter(c.name, c.category)) {
      console.warn(`Excluded (human bite center): ${c.name}`);
      excluded++;
      continue;
    }
    if (c.latitude == null || c.longitude == null) {
      console.warn(`Skipping (no coordinates): ${c.name}`);
      skipped++;
      continue;
    }

    let phone = c.phone || "";
    if (!phone && c.contact_note) phone = c.contact_note;
    if (!phone) phone = "0000000000";
    let hours = c.hours || null;
    if (c.contact_note && c.phone) {
      hours = hours ? `${hours} | ${c.contact_note}` : c.contact_note;
    }
    if (c.phone_alt) {
      hours = hours ? `${hours} | Alt: ${c.phone_alt}` : `Alt: ${c.phone_alt}`;
    }

    const row = {
      name: c.name,
      address: c.address || "Metro Manila",
      phone,
      location: `SRID=4326;POINT(${c.longitude} ${c.latitude})`,
      emergency_capable: c.emergency_capable === true,
      owner_verified: c.owner_verified === true,
      services: c.services?.length ? c.services : ["trauma", "poisoning", "respiratory"],
      hours,
      confidence_score: c.owner_verified ? 75 : c.source === "manual" ? 65 : 50,
    };

    if (c.google_maps_url) row.google_maps_url = c.google_maps_url;
    if (c.image_url) row.image_url = c.image_url;

    const matches = findExistingMatches(c);
    const existingId = matches.length ? pickKeeper(matches).id : null;

    if (existingId && (upsert || replace)) {
      const prev = existingRows.find((r) => r.id === existingId);
      if (prev?.emergency_capable && !row.emergency_capable) {
        row.emergency_capable = true;
      }
      if (isBadPhone(row.phone) && prev?.phone && !isBadPhone(prev.phone)) {
        row.phone = prev.phone;
      }
      if (!row.image_url && prev?.image_url) {
        row.image_url = prev.image_url;
      }
      const { error } = await supabase.from("clinics").update(row).eq("id", existingId);
      if (error) console.error(`Update failed: ${c.name} — ${error.message}`);
      else {
        updated++;
        if (prev) {
          Object.assign(prev, row, { id: existingId, latitude: c.latitude, longitude: c.longitude });
        }
        const dupeIds = matches.filter((r) => r.id !== existingId).map((r) => r.id);
        if (dupeIds.length) {
          await removeDuplicateRows(existingId, dupeIds);
          deduped += dupeIds.length;
        }
      }
      continue;
    }

    if (!replace && existingId) {
      skipped++;
      continue;
    }

    const { data, error } = await supabase
      .from("clinics")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error(`Failed: ${c.name} — ${error.message}`);
      continue;
    }

    await supabase.from("clinic_status").upsert(
      { clinic_id: data.id, current_status: "accepting" },
      { onConflict: "clinic_id" }
    );

    inserted++;
    existingRows.push({
      id: data.id,
      name: c.name,
      address: row.address,
      phone: row.phone,
      latitude: c.latitude,
      longitude: c.longitude,
      emergency_capable: row.emergency_capable,
      owner_verified: row.owner_verified,
      image_url: row.image_url ?? null,
      google_maps_url: row.google_maps_url ?? null,
      google_place_id: c.google_place_id,
    });
  }

  await supabase.rpc("refresh_all_confidence_scores");

  console.log(
    `Import done: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${deduped} DB dupes removed, ${excluded} excluded (human bite centers)`
  );
}

async function fetchAllClinics(supabase) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("clinics")
      .select(
        "id, name, address, latitude, longitude, emergency_capable, phone, image_url, google_maps_url, owner_verified, claimed_by, confidence_score"
      )
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      rows.push({ ...row, google_place_id: getPlaceId(row) });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
