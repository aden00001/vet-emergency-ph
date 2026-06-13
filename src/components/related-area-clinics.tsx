import Link from "next/link";
import { fetchClinicsForArea } from "@/lib/clinic-areas";
import { clinicPath } from "@/lib/clinic-slug";
import { resolveClinicArea } from "@/lib/ph-regions";

interface RelatedAreaClinicsProps {
  clinicId: string;
  address: string;
}

export async function RelatedAreaClinics({
  clinicId,
  address,
}: RelatedAreaClinicsProps) {
  const area = resolveClinicArea(address);
  if (!area) return null;

  let related: Awaited<ReturnType<typeof fetchClinicsForArea>>["clinics"] = [];

  try {
    const result = await fetchClinicsForArea(area.id, {
      emergencyOnly: false,
      limit: 6,
    });
    related = result.clinics.filter((c) => c.id !== clinicId).slice(0, 5);
  } catch {
    return null;
  }

  if (related.length === 0) return null;

  return (
    <section className="glass rounded-2xl p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          More vets in {area.label}
        </h2>
        <Link
          href={`/areas/${area.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View all in {area.label}
        </Link>
      </div>
      <ul className="space-y-2">
        {related.map((clinic) => (
          <li key={clinic.id}>
            <Link
              href={clinicPath(clinic)}
              className="block rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
            >
              <span className="font-medium">{clinic.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                {clinic.address}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
