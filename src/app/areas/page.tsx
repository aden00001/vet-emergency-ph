import Link from "next/link";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { fetchAreaGroups } from "@/lib/clinic-areas";
import { regionSlug } from "@/lib/ph-regions";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Emergency Vet Clinics by Area",
  description:
    "Browse emergency and 24/7 veterinary clinics by city and province across the Philippines — Metro Manila, Cebu, Davao, and nationwide.",
  path: "/areas",
});

export const revalidate = 3600;

export default async function AreasIndexPage() {
  let groups: Awaited<ReturnType<typeof fetchAreaGroups>> = [];

  try {
    groups = await fetchAreaGroups();
  } catch {
    // Empty state below
  }

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10">
        <SiteBreadcrumbs
          items={[{ name: "Home", href: "/" }, { name: "Areas" }]}
        />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Emergency vets by area
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Find emergency-capable veterinary clinics in your city or province.
            Browse by region — Metro Manila, Luzon, Visayas, or Mindanao — then
            open a city page for clinic phone numbers and hours. Always call
            before traveling.
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            Area listings are temporarily unavailable.{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              Search from the homepage
            </Link>
            .
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.group} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">
                  <Link
                    href={`/areas/region/${regionSlug(group.group)}`}
                    className="transition-colors hover:text-primary"
                  >
                    {group.group}
                  </Link>
                </h2>
                <Link
                  href={`/areas/region/${regionSlug(group.group)}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View {group.group} region
                </Link>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.areas.map((area) => (
                  <li key={area.id}>
                    <Link
                      href={`/areas/${area.id}`}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                    >
                      <span className="font-medium">{area.label}</span>
                      <span className="text-muted-foreground">
                        {area.emergencyCount} emergency · {area.count} total
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
