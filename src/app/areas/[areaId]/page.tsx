import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { ClinicCard } from "@/components/clinic-card";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  fetchAreaGroups,
  fetchClinicsForArea,
  getAreaById,
} from "@/lib/clinic-areas";
import { clinicPath } from "@/lib/clinic-slug";
import {
  breadcrumbJsonLd,
  canonicalUrl,
  itemListJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { ArrowLeft } from "lucide-react";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ areaId: string }>;
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
      title: `Emergency Vets in ${area.label}`,
      description: `Find ${area.emergencyCount} emergency-capable veterinary clinics in ${area.label}, Philippines. Call before traveling — hours, phone numbers, and directions on Vet247PH.`,
      path: `/areas/${areaId}`,
    });
  } catch {
    return { title: "Emergency Vets by Area" };
  }
}

export default async function AreaDetailPage({ params }: PageProps) {
  const { areaId } = await params;

  let area: Awaited<ReturnType<typeof fetchClinicsForArea>>["area"] = null;
  let clinics: Awaited<ReturnType<typeof fetchClinicsForArea>>["clinics"] = [];

  try {
    const result = await fetchClinicsForArea(areaId, {
      emergencyOnly: true,
      limit: 50,
    });
    area = result.area;
    clinics = result.clinics;
  } catch {
    notFound();
  }

  if (!area) notFound();

  const path = `/areas/${areaId}`;
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Areas", path: "/areas" },
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
        <Link
          href="/areas"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "gap-2 -ml-2",
          })}
        >
          <ArrowLeft className="size-4" />
          All areas
        </Link>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Emergency vets in {area.label}
          </h1>
          <p className="text-muted-foreground">
            {clinics.length > 0
              ? `${clinics.length} emergency-capable ${clinics.length === 1 ? "clinic" : "clinics"} listed in ${area.label}. Always call before traveling.`
              : `No emergency-capable clinics are currently listed in ${area.label}. Try searching from the homepage or browse a nearby area.`}
          </p>
        </div>

        {clinics.length > 0 ? (
          <div className="space-y-3">
            {clinics.map((clinic) => (
              <ClinicCard key={clinic.id} clinic={clinic} />
            ))}
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
