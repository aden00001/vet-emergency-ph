import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { invalidateClinicCache } from "@/lib/redis";

const bodySchema = z.object({
  clinicId: z.string().uuid(),
  verificationType: z.enum([
    "confirmed_open",
    "confirmed_closed",
    "accepting_emergencies",
    "phone_not_working",
  ]),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const supabase = await createServiceClient();

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("verifications")
    .select("id")
    .eq("clinic_id", parsed.data.clinicId)
    .gte("created_at", oneHourAgo)
    .limit(20);

  if ((recent?.length ?? 0) >= 10) {
    return NextResponse.json(
      { error: "This clinic has received many recent verifications. Try again later." },
      { status: 429 }
    );
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("latitude, longitude")
    .eq("id", parsed.data.clinicId)
    .single();

  const { data, error } = await supabase
    .from("verifications")
    .insert({
      clinic_id: parsed.data.clinicId,
      verification_type: parsed.data.verificationType,
      source: "community",
      user_id: null,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("Rate limit")) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (clinic?.latitude && clinic?.longitude) {
    await invalidateClinicCache(clinic.latitude, clinic.longitude);
  }

  return NextResponse.json({ verification: data, ip });
}
