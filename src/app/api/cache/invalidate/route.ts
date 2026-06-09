import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invalidateClinicCache } from "@/lib/redis";

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  secret: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await invalidateClinicCache(parsed.data.lat, parsed.data.lng);
  return NextResponse.json({ ok: true });
}
