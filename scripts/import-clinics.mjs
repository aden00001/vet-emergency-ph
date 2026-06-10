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

  const { data: existing } = await supabase
    .from("clinics")
    .select("id, name, latitude, longitude, emergency_capable, phone, image_url");
  const existingByName = new Map(
    (existing ?? []).map((c) => [c.name.toLowerCase(), c.id])
  );
  const existingRows = existing ?? [];

  function findByCoords(lat, lng) {
    for (const row of existingRows) {
      if (row.latitude == null || row.longitude == null) continue;
      const dLat = Math.abs(row.latitude - lat);
      const dLng = Math.abs(row.longitude - lng);
      if (dLat < 0.0008 && dLng < 0.0008) return row.id;
    }
    return null;
  }

  function isBadPhone(phone) {
    return /^\+6314\d{7,9}$/.test(phone ?? "");
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let excluded = 0;

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

    let existingId = existingByName.get(c.name.toLowerCase());
    if (!existingId && (upsert || replace)) {
      existingId = findByCoords(c.latitude, c.longitude);
    }

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
        existingByName.set(c.name.toLowerCase(), existingId);
        if (prev) prev.name = c.name;
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
    existingByName.set(c.name.toLowerCase(), data.id);
  }

  await supabase.rpc("refresh_all_confidence_scores");

  console.log(
    `Import done: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${excluded} excluded (human bite centers)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
