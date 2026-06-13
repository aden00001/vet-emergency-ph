import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isClinicUuid } from "@/lib/clinic-slug";

export async function fetchClinicBySlugOrId(param: string) {
  const supabase = await createClient();
  const column = isClinicUuid(param) ? "id" : "slug";

  return supabase
    .from("clinics")
    .select("*, clinic_status(current_status, updated_at)")
    .eq(column, param)
    .single();
}

export async function fetchTopClinicSlugs(limit = 100): Promise<string[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("slug")
    .eq("emergency_capable", true)
    .not("slug", "is", null)
    .order("confidence_score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => row.slug as string).filter(Boolean);
}
