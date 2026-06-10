/** Server/runtime Supabase config (avoids build-time inlining of NEXT_PUBLIC_* on Vercel). */
export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://placeholder.supabase.co"
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "placeholder-anon-key"
  );
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-key";
}

/** Safe diagnostics for /api/health (no secret values). */
export function getSupabaseEnvDiagnostics() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  let urlHost: string | null = null;
  let urlOk = false;
  try {
    urlHost = new URL(url).host;
    urlOk = urlHost.endsWith(".supabase.co") && !url.includes("placeholder");
  } catch {
    urlHost = null;
  }

  return {
    urlHost,
    urlOk,
    anonKeyFormat: anonKey.startsWith("eyJ")
      ? "jwt"
      : anonKey.startsWith("sb_")
        ? "publishable"
        : anonKey === "placeholder-anon-key"
          ? "missing"
          : "unknown",
    anonKeyLength: anonKey.length,
    serviceRoleConfigured:
      getSupabaseServiceRoleKey().startsWith("eyJ") &&
      getSupabaseServiceRoleKey().length > 100,
  };
}
