import { createServiceClient } from "@/lib/supabase/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { sortClinics } from "@/lib/clinic-sort";
import {
  AREA_GROUP_ORDER,
  resolveClinicArea,
  type AreaGroup,
  type ClinicArea,
} from "@/lib/ph-regions";
import type { ClinicStatusType, NearbyClinic } from "@/types/database";

const AREAS_CACHE_KEY = "clinics:areas:v5";
const AREAS_CACHE_TTL_SECONDS = 60 * 60 * 24;
const PAGE_SIZE = 1000;

export interface AreaGroupResult {
  group: AreaGroup;
  areas: ClinicArea[];
}

interface ClinicAreaRow {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  emergency_capable: boolean | null;
}

interface ClinicStatusRow {
  current_status: ClinicStatusType | null;
  updated_at: string | null;
}

interface AreaClinicRow extends ClinicAreaRow {
  id: string;
  slug: string | null;
  name: string;
  phone: string | null;
  location_verified: boolean | null;
  owner_verified: boolean | null;
  services: string[] | null;
  hours: string | null;
  confidence_score: number | null;
  image_url: string | null;
  google_maps_url: string | null;
  clinic_status: ClinicStatusRow | ClinicStatusRow[] | null;
}

export function buildAreas(rows: ClinicAreaRow[]): AreaGroupResult[] {
  const acc = new Map<
    string,
    {
      label: string;
      group: AreaGroup;
      count: number;
      emergencyCount: number;
      sumLat: number;
      sumLng: number;
    }
  >();

  for (const row of rows) {
    if (row.latitude == null || row.longitude == null) continue;
    const area = resolveClinicArea(row.address);
    if (!area) continue;

    const entry = acc.get(area.id) ?? {
      label: area.label,
      group: area.group,
      count: 0,
      emergencyCount: 0,
      sumLat: 0,
      sumLng: 0,
    };
    entry.count += 1;
    if (row.emergency_capable) entry.emergencyCount += 1;
    entry.sumLat += row.latitude;
    entry.sumLng += row.longitude;
    acc.set(area.id, entry);
  }

  const areas: ClinicArea[] = [...acc.entries()].map(([id, e]) => ({
    id,
    label: e.label,
    group: e.group,
    count: e.count,
    emergencyCount: e.emergencyCount,
    lat: e.sumLat / e.count,
    lng: e.sumLng / e.count,
  }));

  return AREA_GROUP_ORDER.map((group) => ({
    group,
    areas: areas
      .filter((a) => a.group === group)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  })).filter((g) => g.areas.length > 0);
}

async function fetchClinicAreaRows(): Promise<ClinicAreaRow[]> {
  const supabase = await createServiceClient();
  const rows: ClinicAreaRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("clinics")
      .select("address, latitude, longitude, emergency_capable")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as ClinicAreaRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAreaClinicRows(
  emergencyOnly: boolean
): Promise<AreaClinicRow[]> {
  const supabase = await createServiceClient();
  const rows: AreaClinicRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("clinics")
      .select(
        [
          "id",
          "slug",
          "name",
          "address",
          "phone",
          "latitude",
          "longitude",
          "location_verified",
          "emergency_capable",
          "owner_verified",
          "services",
          "hours",
          "confidence_score",
          "image_url",
          "google_maps_url",
          "clinic_status(current_status, updated_at)",
        ].join(", ")
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .range(from, from + PAGE_SIZE - 1);

    if (emergencyOnly) {
      query = query.eq("emergency_capable", true);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as AreaClinicRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchAreaGroups(): Promise<AreaGroupResult[]> {
  const cached = await getCachedJson<AreaGroupResult[]>(AREAS_CACHE_KEY);
  if (cached) return cached;

  const rows = await fetchClinicAreaRows();
  const groups = buildAreas(rows);
  await setCachedJson(AREAS_CACHE_KEY, groups, AREAS_CACHE_TTL_SECONDS);
  return groups;
}

export function flattenAreas(groups: AreaGroupResult[]): ClinicArea[] {
  return groups.flatMap((g) => g.areas);
}

export function getAreaById(
  groups: AreaGroupResult[],
  areaId: string
): ClinicArea | null {
  for (const group of groups) {
    const area = group.areas.find((a) => a.id === areaId);
    if (area) return area;
  }
  return null;
}

export function getTopAreas(groups: AreaGroupResult[], limit = 12): ClinicArea[] {
  return flattenAreas(groups)
    .sort((a, b) => b.emergencyCount - a.emergencyCount || b.count - a.count)
    .slice(0, limit);
}

function distanceMeters(
  from: Pick<ClinicArea, "lat" | "lng">,
  to: Pick<AreaClinicRow, "latitude" | "longitude">
): number {
  if (to.latitude == null || to.longitude == null) return Number.POSITIVE_INFINITY;

  const radiusMeters = 6371_000;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function firstClinicStatus(
  status: AreaClinicRow["clinic_status"]
): ClinicStatusRow | null {
  return Array.isArray(status) ? (status[0] ?? null) : status;
}

function toNearbyClinic(row: AreaClinicRow, area: ClinicArea): NearbyClinic {
  const status = firstClinicStatus(row.clinic_status);
  const currentStatus = status?.current_status ?? "accepting";
  const confidenceScore = row.confidence_score ?? 0;
  const distance = distanceMeters(area, row);
  const rankScore =
    distance / 1000 -
    confidenceScore * 0.05 -
    (currentStatus === "accepting"
      ? 5
      : currentStatus === "limited"
        ? 2
        : currentStatus === "not_accepting"
          ? -3
          : -10) -
    (row.owner_verified ? 3 : 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address ?? "",
    phone: row.phone ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    location_verified: row.location_verified ?? false,
    emergency_capable: row.emergency_capable ?? false,
    owner_verified: row.owner_verified ?? false,
    services: row.services ?? [],
    hours: row.hours,
    confidence_score: confidenceScore,
    distance_meters: distance,
    current_status: currentStatus,
    status_updated_at: status?.updated_at ?? null,
    rank_score: rankScore,
    review_count: 0,
    average_rating: null,
    image_url: row.image_url,
    google_maps_url: row.google_maps_url,
  };
}

export async function fetchClinicsForArea(
  areaId: string,
  options: { emergencyOnly?: boolean; limit?: number } = {}
): Promise<{ area: ClinicArea | null; clinics: NearbyClinic[] }> {
  const { emergencyOnly = true, limit = 50 } = options;
  const groups = await fetchAreaGroups();
  const area = getAreaById(groups, areaId);
  if (!area) return { area: null, clinics: [] };

  const rows = await fetchAreaClinicRows(emergencyOnly);
  const filtered = rows.filter((clinic) => {
    const resolved = resolveClinicArea(clinic.address);
    return resolved?.id === areaId;
  });

  const sorted = sortClinics(
    filtered.map((clinic) => toNearbyClinic(clinic, area)),
    "recommended"
  );
  return { area, clinics: sorted.slice(0, limit) };
}
