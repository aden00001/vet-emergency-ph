import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sortClinics, type ClinicSortOption } from "@/lib/clinic-sort";
import {
  buildCacheKey,
  getCachedNearbyClinics,
  setCachedNearbyClinics,
} from "@/lib/redis";
import type { NearbyClinic } from "@/types/database";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(100).default(25),
  triage: z.enum(["trauma", "poisoning", "respiratory"]).optional(),
  emergencyOnly: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().refine((v) => [10, 20, 50].includes(v)).default(20),
  sort: z
    .enum([
      "recommended",
      "distance",
      "rating",
      "reviews",
      "confidence",
      "availability",
    ])
    .default("recommended"),
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { lat, lng, radius, triage, emergencyOnly, limit, sort } = parsed.data;
  const cacheKey = buildCacheKey({
    lat,
    lng,
    radiusKm: radius,
    triageCategory: triage,
    emergencyOnly,
  });

  let allClinics: NearbyClinic[] | null = await getCachedNearbyClinics(cacheKey);
  let fromCache = allClinics !== null;

  if (!allClinics) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("nearby_emergency_clinics", {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radius,
      p_triage_category: triage ?? null,
      p_emergency_only: emergencyOnly,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    allClinics = (data ?? []) as NearbyClinic[];
    await setCachedNearbyClinics(cacheKey, allClinics);
    fromCache = false;
  }

  const total = allClinics.length;
  const sorted = sortClinics(allClinics, sort as ClinicSortOption);
  const clinics = sorted.slice(0, limit);

  return NextResponse.json({ clinics, total, cached: fromCache });
}
