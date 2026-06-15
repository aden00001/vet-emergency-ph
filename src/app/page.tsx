import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { ClinicCard } from "@/components/clinic-card";
import { HeroIllustration } from "@/components/hero-illustration";
import { HomeSearch } from "@/components/home-search";
import { SiteHeader } from "@/components/site-header";
import { fetchAreaGroups, getTopAreas } from "@/lib/clinic-areas";
import { clinicPath } from "@/lib/clinic-slug";
import { getPresetById, DEFAULT_PRESET_ID } from "@/lib/location-presets";
import { fetchNearbyClinics } from "@/lib/nearby-clinics";
import {
  HOME_PAGE_TITLE,
  canonicalUrl,
  itemListJsonLd,
  pageMetadata,
} from "@/lib/seo";

export const metadata = pageMetadata({
  title: HOME_PAGE_TITLE,
  description:
    "Find 24/7 and after-hours emergency veterinary clinics across the Philippines. Search by location, call before traveling, and browse clinics in Metro Manila, Cebu, Davao, and nationwide.",
  path: "/",
  absoluteTitle: true,
});

const DEFAULT_PRESET = getPresetById(DEFAULT_PRESET_ID)!;

export default async function HomePage() {
  let initialClinics: Awaited<ReturnType<typeof fetchNearbyClinics>>["clinics"] =
    [];
  let initialTotal = 0;
  let topAreas: Awaited<ReturnType<typeof getTopAreas>> = [];

  try {
    const result = await fetchNearbyClinics({
      lat: DEFAULT_PRESET.latitude,
      lng: DEFAULT_PRESET.longitude,
      radiusKm: 25,
      emergencyOnly: true,
      limit: 20,
      sort: "recommended",
    });
    initialClinics = result.clinics;
    initialTotal = result.total;

    const groups = await fetchAreaGroups();
    topAreas = getTopAreas(groups, 12);
  } catch {
    // Graceful degradation — interactive search still works client-side
  }

  const itemList = itemListJsonLd(
    initialClinics.map((c) => ({
      name: c.name,
      url: canonicalUrl(clinicPath(c)),
    })),
    `Emergency vet clinics near ${DEFAULT_PRESET.label}`
  );

  return (
    <div className="app-backdrop flex min-h-full flex-col overflow-x-clip">
      <JsonLd data={itemList} />
      <SiteHeader />
      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-8 space-y-7">
        <section className="grid items-center gap-8 overflow-hidden sm:grid-cols-[1fr_minmax(200px,240px)] sm:gap-6">
          <div className="min-w-0 space-y-3 text-center sm:text-left">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2 shrink-0 overflow-hidden rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Live emergency directory · Philippines
            </span>
            <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
              Find emergency vet care{" "}
              <span className="text-gradient-brand">in seconds</span>
            </h1>
            <p className="mx-auto max-w-xl text-balance text-muted-foreground sm:mx-0">
              Locate, verify, and call emergency-capable veterinary clinics near
              you. Always phone the clinic before traveling.
            </p>
          </div>
          <HeroIllustration />
        </section>

        <HomeSearch
          initialClinics={initialClinics}
          initialTotal={initialTotal}
          initialLocationLabel={DEFAULT_PRESET.label}
        />

        {initialClinics.length > 0 && (
          <section
            className="space-y-4"
            aria-label={`Emergency vet clinics in ${DEFAULT_PRESET.label}`}
          >
            <div className="px-1">
              <h2 className="font-display text-lg font-bold">
                Emergency vets in {DEFAULT_PRESET.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {initialTotal} emergency-capable{" "}
                {initialTotal === 1 ? "clinic" : "clinics"} in this area.{" "}
                <Link href="/areas" className="font-medium text-primary hover:underline">
                  Browse all areas
                </Link>
              </p>
            </div>
            <div className="space-y-3">
              {initialClinics.map((clinic) => (
                <ClinicCard key={clinic.id} clinic={clinic} />
              ))}
            </div>
          </section>
        )}

        {topAreas.length > 0 && (
          <section className="space-y-3 px-1" aria-label="Browse by area">
            <h2 className="font-display text-lg font-bold">
              Browse emergency vets by area
            </h2>
            <ul className="flex flex-wrap gap-2">
              {topAreas.map((area) => (
                <li key={area.id}>
                  <Link
                    href={`/areas/${area.id}`}
                    className="inline-flex rounded-full border border-border/80 bg-background/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {area.label}
                    <span className="ml-1.5 text-muted-foreground">
                      ({area.emergencyCount})
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
