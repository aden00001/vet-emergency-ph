import type { MetadataRoute } from "next";
import { DEFAULT_SITE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
