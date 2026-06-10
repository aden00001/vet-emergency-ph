import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedJson, setCachedJson } from "@/lib/redis";
import {
  AREA_GROUP_ORDER,
  resolveClinicArea,
  type AreaGroup,
  type ClinicArea,
} from "@/lib/ph-regions";

const CACHE_KEY = "clinics:areas:v2";
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 1 day — coverage changes rarely
const PAGE_SIZE = 1000;

interface AreaGroupResult {
  group: AreaGroup;
  areas: ClinicArea[];
}

interface ClinicAreaRow {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  emergency_capable: boolean | null;
}

function buildAreas(rows: ClinicAreaRow[]): AreaGroupResult[] {
  const acc = new Map<
    string,
    { label: string; group: AreaGroup; count: number; emergencyCount: number; sumLat: number; sumLng: number }
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

export async function GET() {
  const cached = await getCachedJson<AreaGroupResult[]>(CACHE_KEY);
  if (cached) {
    return NextResponse.json({ groups: cached, cached: true });
  }

  const supabase = await createClient();
  const rows: ClinicAreaRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("clinics")
      .select("address, latitude, longitude, emergency_capable")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as ClinicAreaRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  const groups = buildAreas(rows);
  await setCachedJson(CACHE_KEY, groups, CACHE_TTL_SECONDS);

  return NextResponse.json({ groups, cached: false });
}
