import { Redis } from "@upstash/redis";
import type { NearbyClinic, TriageCategory } from "@/types/database";
import { roundCoord } from "@/lib/geo";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export function buildCacheKey(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  triageCategory?: TriageCategory | null;
  emergencyOnly?: boolean;
}): string {
  const lat = roundCoord(params.lat);
  const lng = roundCoord(params.lng);
  const triage = params.triageCategory ?? "none";
  const emergency = params.emergencyOnly !== false ? "1" : "0";
  return `clinics:near:${lat}:${lng}:${params.radiusKm}:${triage}:${emergency}`;
}

export async function getCachedNearbyClinics(
  key: string
): Promise<NearbyClinic[] | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get<NearbyClinic[]>(key);
  } catch {
    return null;
  }
}

export async function setCachedNearbyClinics(
  key: string,
  data: NearbyClinic[],
  ttlSeconds = 60
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, data, { ex: ttlSeconds });
  } catch {
    // Graceful degradation
  }
}

export async function invalidateClinicCache(
  lat: number,
  lng: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const prefix = `clinics:near:${roundCoord(lat)}:${roundCoord(lng)}`;
    const keys = await client.keys(`${prefix}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Graceful degradation
  }
}
