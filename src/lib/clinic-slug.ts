import { resolveClinicArea } from "@/lib/ph-regions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function slugifySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function buildClinicSlugBase(name: string, address: string | null): string {
  const namePart = slugifySegment(name);
  const area = resolveClinicArea(address);
  const areaPart = area ? slugifySegment(area.label) : "";

  if (!namePart) return areaPart || "clinic";
  if (areaPart && !namePart.includes(areaPart)) {
    return `${namePart}-${areaPart}`.slice(0, 100);
  }
  return namePart.slice(0, 100);
}

export function ensureUniqueSlug(base: string, used: Set<string>): string {
  let slug = base || "clinic";
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  slug = `${base}-${suffix}`;
  used.add(slug);
  return slug;
}

export function buildClinicSlug(
  name: string,
  address: string | null,
  used: Set<string>
): string {
  return ensureUniqueSlug(buildClinicSlugBase(name, address), used);
}

export function isClinicUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function clinicPath(clinic: { id: string; slug?: string | null }): string {
  return `/clinics/${clinic.slug || clinic.id}`;
}
