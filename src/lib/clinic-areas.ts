import { createServiceClient } from "@/lib/supabase/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import { sortClinics } from "@/lib/clinic-sort";
import {
  AREA_GROUP_ORDER,
  resolveClinicArea,
  type AreaGroup,
  type ClinicArea,
} from "@/lib/ph-regions";
import type { NearbyClinic } from "@/types/database";

const AREAS_CACHE_KEY = "clinics:areas:v3";
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

export async function fetchClinicsForArea(
  areaId: string,
  options: { emergencyOnly?: boolean; limit?: number } = {}
): Promise<{ area: ClinicArea | null; clinics: NearbyClinic[] }> {
  const { emergencyOnly = true, limit = 50 } = options;
  const groups = await fetchAreaGroups();
  const area = getAreaById(groups, areaId);
  if (!area) return { area: null, clinics: [] };

  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("nearby_emergency_clinics", {
    p_lat: area.lat,
    p_lng: area.lng,
    p_radius_km: 50,
    p_triage_category: null,
    p_emergency_only: emergencyOnly,
  });

  if (error) throw new Error(error.message);

  const filtered = ((data ?? []) as NearbyClinic[]).filter((clinic) => {
    const resolved = resolveClinicArea(clinic.address);
    return resolved?.id === areaId;
  });

  const sorted = sortClinics(filtered, "recommended");
  return { area, clinics: sorted.slice(0, limit) };
}
