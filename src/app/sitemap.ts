import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/disclaimer`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const supabase = await createClient();
    const { data: clinics } = await supabase
      .from("clinics")
      .select("id, updated_at");

    const clinicRoutes: MetadataRoute.Sitemap = (clinics ?? []).map((c) => ({
      url: `${baseUrl}/clinics/${c.id}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...clinicRoutes];
  } catch {
    return staticRoutes;
  }
}
