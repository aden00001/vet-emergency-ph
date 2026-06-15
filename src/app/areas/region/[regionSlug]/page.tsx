import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { getRegionIntro } from "@/lib/area-intro";
import { fetchAreaGroups } from "@/lib/clinic-areas";
import {
  AREA_GROUP_ORDER,
  groupFromRegionSlug,
  regionSlug,
} from "@/lib/ph-regions";
import {
  breadcrumbJsonLd,
  pageMetadata,
  regionPageTitle,
} from "@/lib/seo";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ regionSlug: string }>;
}

export function generateStaticParams() {
  return AREA_GROUP_ORDER.map((group) => ({ regionSlug: regionSlug(group) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { regionSlug: slug } = await params;
  const group = groupFromRegionSlug(slug);
  if (!group) return { title: "Region Not Found", robots: { index: false } };

  return pageMetadata({
    title: regionPageTitle(group),
    description: `Browse ${group} cities and provinces for 24/7 and emergency veterinary clinics in the Philippines. Call before traveling — hours and capacity change frequently.`,
    path: `/areas/region/${slug}`,
  });
}

export default async function RegionAreasPage({ params }: PageProps) {
  const { regionSlug: slug } = await params;
  const group = groupFromRegionSlug(slug);
  if (!group) notFound();

  const groups = await fetchAreaGroups();
  const region = groups.find((g) => g.group === group);
  if (!region || region.areas.length === 0) notFound();

  const emergencyTotal = region.areas.reduce(
    (sum, area) => sum + area.emergencyCount,
    0
  );
  const path = `/areas/region/${slug}`;
  const intro = getRegionIntro(group, region.areas.length, emergencyTotal);

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Areas", path: "/areas" },
          { name: group, path },
        ])}
      />
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10">
        <SiteBreadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Areas", href: "/areas" },
            { name: group },
          ]}
        />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Emergency vets in {group}
          </h1>
          <p className="max-w-2xl text-muted-foreground">{intro}</p>
          <p className="text-sm text-muted-foreground">
            {region.areas.length} {region.areas.length === 1 ? "area" : "areas"} ·{" "}
            {emergencyTotal} emergency-capable clinics
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Cities and provinces</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {region.areas.map((area) => (
              <li key={area.id}>
                <Link
                  href={`/areas/${area.id}`}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <span className="font-medium">{area.label}</span>
                  <span className="text-muted-foreground">
                    {area.emergencyCount} emergency
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
