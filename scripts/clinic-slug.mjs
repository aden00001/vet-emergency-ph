/**
 * Shared slug helpers for import/backfill scripts.
 * Keep in sync with src/lib/clinic-slug.ts.
 */

const CITY_DEFS = [
  { match: "quezon city", label: "Quezon City" },
  { match: "manila", label: "Manila" },
  { match: "makati", label: "Makati" },
  { match: "pasig", label: "Pasig" },
  { match: "taguig", label: "Taguig / BGC" },
  { match: "mandaluyong", label: "Mandaluyong" },
  { match: "pasay", label: "Pasay" },
  { match: "paranaque", label: "Parañaque" },
  { match: "las pinas", label: "Las Piñas" },
  { match: "muntinlupa", label: "Muntinlupa / Alabang" },
  { match: "caloocan", label: "Caloocan" },
  { match: "marikina", label: "Marikina" },
  { match: "cebu city", label: "Cebu City" },
  { match: "davao city", label: "Davao City" },
  { match: "cavite", label: "Cavite" },
  { match: "laguna", label: "Laguna" },
  { match: "rizal", label: "Rizal" },
  { match: "bulacan", label: "Bulacan" },
  { match: "batangas", label: "Batangas" },
  { match: "pampanga", label: "Pampanga" },
];

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveAreaLabel(address) {
  if (!address) return null;
  const text = normalize(address);
  for (const def of CITY_DEFS.sort((a, b) => b.match.length - a.match.length)) {
    if (text.includes(def.match)) return def.label;
  }
  return null;
}

export function slugifySegment(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function buildClinicSlugBase(name, address) {
  const namePart = slugifySegment(name);
  const areaPart = slugifySegment(resolveAreaLabel(address) ?? "");
  if (!namePart) return areaPart || "clinic";
  if (areaPart && !namePart.includes(areaPart)) {
    return `${namePart}-${areaPart}`.slice(0, 100);
  }
  return namePart.slice(0, 100);
}

export function ensureUniqueSlug(base, used) {
  let slug = base || "clinic";
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  slug = `${base}-${suffix}`;
  used.add(slug);
  return slug;
}

export function buildClinicSlug(name, address, used) {
  return ensureUniqueSlug(buildClinicSlugBase(name, address), used);
}
