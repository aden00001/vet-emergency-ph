import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/brand";
import { fetchAreaGroups, flattenAreas } from "@/lib/clinic-areas";
import { HELP_TOPICS } from "@/lib/help-content";
import { createServiceClient } from "@/lib/supabase/server";
import { clinicPath } from "@/lib/clinic-slug";

const STATIC_LAST_MODIFIED = new Date("2026-06-13");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/areas`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/for-clinics`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const helpRoutes: MetadataRoute.Sitemap = HELP_TOPICS.map((topic) => ({
    url: `${baseUrl}/help/${topic.slug}`,
    lastModified: STATIC_LAST_MODIFIED,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  let areaRoutes: MetadataRoute.Sitemap = [];
  try {
    const groups = await fetchAreaGroups();
    areaRoutes = flattenAreas(groups).map((area) => ({
      url: `${baseUrl}/areas/${area.id}`,
      lastModified: STATIC_LAST_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));
  } catch (error) {
    console.error("[sitemap] Failed to load area routes:", error);
  }

  try {
    const supabase = await createServiceClient();
    const { data: clinics, error } = await supabase
      .from("clinics")
      .select("id, slug, updated_at");

    if (error) {
      console.error("[sitemap] Failed to load clinic routes:", error.message);
      return [...staticRoutes, ...helpRoutes, ...areaRoutes];
    }

    const clinicRoutes: MetadataRoute.Sitemap = (clinics ?? []).map((c) => ({
      url: `${baseUrl}${clinicPath(c)}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : STATIC_LAST_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...helpRoutes, ...areaRoutes, ...clinicRoutes];
  } catch (error) {
    console.error("[sitemap] Unexpected failure loading clinics:", error);
    return [...staticRoutes, ...helpRoutes, ...areaRoutes];
  }
}
