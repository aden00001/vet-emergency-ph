import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { AreaPagination, CLINICS_PER_PAGE } from "@/components/area-pagination";
import { ClinicCard } from "@/components/clinic-card";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getAreaIntro } from "@/lib/area-intro";
import {
  fetchAreaGroups,
  fetchClinicsForArea,
  getAreaById,
} from "@/lib/clinic-areas";
import { clinicPath } from "@/lib/clinic-slug";
import { regionSlug } from "@/lib/ph-regions";
import {
  areaPageTitle,
  breadcrumbJsonLd,
  canonicalUrl,
  itemListJsonLd,
  pageMetadata,
} from "@/lib/seo";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  try {
    const groups = await fetchAreaGroups();
    return groups.flatMap((g) =>
      g.areas.map((area) => ({ areaId: area.id }))
    );
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { areaId } = await params;
  try {
    const groups = await fetchAreaGroups();
    const area = getAreaById(groups, areaId);
    if (!area) return { title: "Area Not Found", robots: { index: false } };

    return pageMetadata({
      title: areaPageTitle(area.label),
      description: `Find ${area.emergencyCount} 24/7 and emergency veterinary clinics in ${area.label}, Philippines. Call before traveling — hours, phone numbers, and directions on Vet247PH.`,
      path: `/areas/${areaId}`,
    });
  } catch {
    return { title: "Emergency Vets by Area" };
  }
}

export default async function AreaDetailPage({ params, searchParams }: PageProps) {
  const { areaId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * CLINICS_PER_PAGE;

  let area: Awaited<ReturnType<typeof fetchClinicsForArea>>["area"] = null;
  let clinics: Awaited<ReturnType<typeof fetchClinicsForArea>>["clinics"] = [];
  let total = 0;

  try {
    const result = await fetchClinicsForArea(areaId, {
      emergencyOnly: true,
      limit: CLINICS_PER_PAGE,
      offset,
    });
    area = result.area;
    clinics = result.clinics;
    total = result.total;
  } catch {
    notFound();
  }

  if (!area) notFound();

  const totalPages = Math.ceil(total / CLINICS_PER_PAGE);
  if (page > totalPages && totalPages > 0) notFound();

  const path = `/areas/${areaId}`;
  const intro = getAreaIntro(
    area,
    clinics.map((clinic) => clinic.name)
  );
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Areas", path: "/areas" },
    { name: area.group, path: `/areas/region/${regionSlug(area.group)}` },
    { name: area.label, path },
  ]);
  const itemList = itemListJsonLd(
    clinics.map((c) => ({
      name: c.name,
      url: canonicalUrl(clinicPath(c)),
    })),
    `Emergency vet clinics in ${area.label}`
  );

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd data={[breadcrumbs, itemList]} />
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <SiteBreadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Areas", href: "/areas" },
            { name: area.group, href: `/areas/region/${regionSlug(area.group)}` },
            { name: area.label },
          ]}
        />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Emergency vets in {area.label}
          </h1>
          <p className="text-muted-foreground">{intro}</p>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `${total} emergency-capable ${total === 1 ? "clinic" : "clinics"} in ${area.label}. Always call before traveling.`
              : `No emergency-capable clinics are currently listed in ${area.label}. Try searching from the homepage or browse a nearby area.`}
          </p>
        </div>

        {clinics.length > 0 ? (
          <div className="space-y-3">
            {clinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
            <AreaPagination areaId={areaId} page={page} total={total} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center">
            <p className="font-medium">No clinics found in this area</p>
            <Link
              href="/"
              className={buttonVariants({ className: "mt-4 shadow-soft" })}
            >
              Search from homepage
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
