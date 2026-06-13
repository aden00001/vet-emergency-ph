import { createServiceClient } from "@/lib/supabase/server";
import {
  buildCacheKey,
  getCachedNearbyClinics,
  setCachedNearbyClinics,
} from "@/lib/redis";
import { sortClinics, type ClinicSortOption } from "@/lib/clinic-sort";
import type { NearbyClinic, TriageCategory } from "@/types/database";

export interface NearbySearchParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  triage?: TriageCategory | null;
  emergencyOnly?: boolean;
  limit?: number;
  sort?: ClinicSortOption;
}

export async function fetchNearbyClinics({
  lat,
  lng,
  radiusKm = 25,
  triage = null,
  emergencyOnly = true,
  limit = 20,
  sort = "recommended",
}: NearbySearchParams): Promise<{ clinics: NearbyClinic[]; total: number }> {
  const cacheKey = buildCacheKey({
    lat,
    lng,
    radiusKm,
    triageCategory: triage,
    emergencyOnly,
  });

  let allClinics: NearbyClinic[] | null = await getCachedNearbyClinics(cacheKey);

  if (!allClinics) {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.rpc("nearby_emergency_clinics", {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_triage_category: triage,
      p_emergency_only: emergencyOnly,
    });

    if (error) throw new Error(error.message);
    allClinics = (data ?? []) as NearbyClinic[];
    await setCachedNearbyClinics(cacheKey, allClinics);
  }

  const total = allClinics.length;
  const sorted = sortClinics(allClinics, sort);
  return { clinics: sorted.slice(0, limit), total };
}
