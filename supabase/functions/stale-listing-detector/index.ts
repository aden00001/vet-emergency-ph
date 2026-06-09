import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: clinics, error: clinicsError } = await supabase
      .from("clinics")
      .select("id, name, claimed_by, latitude, longitude");

    if (clinicsError) throw clinicsError;

    let processed = 0;

    for (const clinic of clinics ?? []) {
      const { data: recentVerifications } = await supabase
        .from("verifications")
        .select("id")
        .eq("clinic_id", clinic.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .limit(1);

      if (recentVerifications && recentVerifications.length > 0) continue;

      await supabase.from("verifications").insert({
        clinic_id: clinic.id,
        verification_type: "confirmed_closed",
        source: "system",
        user_id: null,
      });

      await supabase.rpc("refresh_clinic_confidence_score", {
        p_clinic_id: clinic.id,
      });

      if (clinic.claimed_by) {
        const { data: userData } = await supabase.auth.admin.getUserById(
          clinic.claimed_by
        );
        const email = userData?.user?.email;
        if (email) {
          console.log(
            `Stale listing reminder for ${clinic.name} → ${email}`
          );
        }
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ ok: true, processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
