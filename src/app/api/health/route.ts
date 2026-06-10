import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseEnvDiagnostics, getSupabaseUrl } from "@/lib/supabase/env";

export async function GET() {
  const env = getSupabaseEnvDiagnostics();

  let supabaseOk = false;
  let supabaseError: string | null = null;

  if (env.urlOk && env.anonKeyFormat === "jwt") {
    try {
      const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
      const { error } = await supabase.from("clinics").select("id", { head: true, count: "exact" });
      if (error) supabaseError = error.message;
      else supabaseOk = true;
    } catch (e) {
      supabaseError = e instanceof Error ? e.message : "Unknown error";
    }
  } else {
    supabaseError = "Supabase URL or anon key not configured correctly";
  }

  return NextResponse.json({
    ok: supabaseOk,
    env,
    supabaseError,
  });
}
