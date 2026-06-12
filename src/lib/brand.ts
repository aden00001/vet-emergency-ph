export const SITE_NAME = "Vet247PH";
export const SITE_TAGLINE = "Find Emergency Vet Care Fast";
export const DEFAULT_SITE_URL = "https://vet247ph.online";

/** Canonical public site URL for SEO (sitemap, robots, Open Graph, JSON-LD). */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes(".vercel.app")) {
    return fromEnv;
  }
  return DEFAULT_SITE_URL;
}

/** Public contact for corrections, listing updates, and feedback. */
export const SITE_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "kennzchoice@gmail.com";

export const SITE_AUTHOR_NAME = "Kennz Choice";
export const SITE_AUTHOR_URL = "https://kennzchoice.online";
