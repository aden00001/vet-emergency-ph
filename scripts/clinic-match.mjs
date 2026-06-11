/**
 * Shared clinic identity matching for import + DB dedupe.
 * Mirrors dedupeClinics() in google-maps-parse-lib.mjs.
 */

import { extractPlaceId } from "./google-maps-parse-lib.mjs";

export { extractPlaceId };

export function normName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSameLocation(a, b) {
  if (a.latitude == null || b.latitude == null) return false;
  return (
    Math.abs(a.latitude - b.latitude) < 0.0008 &&
    Math.abs(a.longitude - b.longitude) < 0.0008
  );
}

export function getPlaceId(record) {
  return extractPlaceId(record.google_maps_url, record.google_place_id) ?? null;
}

export function clinicsMatch(a, b) {
  const pidA = getPlaceId(a);
  const pidB = getPlaceId(b);
  if (pidA && pidB && pidA === pidB) return true;

  if (normName(a.name) !== normName(b.name)) return false;
  if (isSameLocation(a, b)) return true;
  if (a.address && b.address && a.address === b.address) return true;
  return false;
}

export function findMatchingRows(target, rows) {
  return rows.filter((r) => clinicsMatch(target, r));
}

export function scoreRowForKeep(row) {
  let score = 0;
  if (row.image_url) score += 10;
  if (row.phone && row.phone !== "0000000000" && !/^\+6314/.test(row.phone ?? "")) score += 8;
  if (row.owner_verified) score += 20;
  if (row.claimed_by) score += 15;
  if (row.google_maps_url) score += 5;
  if (row.emergency_capable) score += 3;
  score += (row.confidence_score ?? 50) / 100;
  return score;
}

export function pickKeeper(rows) {
  return rows.reduce((best, row) =>
    scoreRowForKeep(row) > scoreRowForKeep(best) ? row : best
  );
}
