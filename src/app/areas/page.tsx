import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { fetchAreaGroups } from "@/lib/clinic-areas";
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
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Emergency vets by area
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Find emergency-capable veterinary clinics in your city or province.
            Always call the clinic before traveling — hours and capacity can
            change without notice.
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
              <h2 className="font-display text-xl font-bold">{group.group}</h2>
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
