/**
 * Maps a clinic's free-text address to a geographic "area" (NCR city or
 * province) grouped by island region. Used to build a nationwide, data-driven
 * location picker from the clinics actually present in the database.
 *
 * We rely on the province / city name being present in the address string
 * (Philippine addresses almost always end with "..., City, Province"). The pin
 * we navigate to is computed from real clinic coordinates, so even an
 * approximate match still drops the user into the actual cluster.
 */

export type AreaGroup = "Metro Manila" | "Luzon" | "Visayas" | "Mindanao";

export const AREA_GROUP_ORDER: AreaGroup[] = [
  "Metro Manila",
  "Luzon",
  "Visayas",
  "Mindanao",
];

export interface ClinicArea {
  id: string;
  label: string;
  group: AreaGroup;
  count: number;
  emergencyCount: number;
  lat: number;
  lng: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface AreaDef {
  /** Normalized match string searched for inside the address. */
  match: string;
  label: string;
  group: AreaGroup;
}

/**
 * Cities commonly written without a province (NCR + highly urbanized cities).
 * Checked before provinces so e.g. "Quezon City" maps to NCR, not Quezon
 * province, and "Cebu City" gets its own bucket separate from the rest of Cebu.
 */
const CITY_DEFS: AreaDef[] = [
  // Metro Manila (NCR)
  { match: "quezon city", label: "Quezon City", group: "Metro Manila" },
  { match: "manila", label: "Manila", group: "Metro Manila" },
  { match: "makati", label: "Makati", group: "Metro Manila" },
  { match: "pasig", label: "Pasig", group: "Metro Manila" },
  { match: "taguig", label: "Taguig / BGC", group: "Metro Manila" },
  { match: "bgc", label: "Taguig / BGC", group: "Metro Manila" },
  { match: "mandaluyong", label: "Mandaluyong", group: "Metro Manila" },
  { match: "pasay", label: "Pasay", group: "Metro Manila" },
  { match: "paranaque", label: "Parañaque", group: "Metro Manila" },
  { match: "las pinas", label: "Las Piñas", group: "Metro Manila" },
  { match: "muntinlupa", label: "Muntinlupa / Alabang", group: "Metro Manila" },
  { match: "alabang", label: "Muntinlupa / Alabang", group: "Metro Manila" },
  { match: "caloocan", label: "Caloocan", group: "Metro Manila" },
  { match: "marikina", label: "Marikina", group: "Metro Manila" },
  { match: "san juan", label: "San Juan", group: "Metro Manila" },
  { match: "valenzuela", label: "Valenzuela", group: "Metro Manila" },
  { match: "malabon", label: "Malabon", group: "Metro Manila" },
  { match: "navotas", label: "Navotas", group: "Metro Manila" },
  { match: "pateros", label: "Pateros", group: "Metro Manila" },
  // Highly urbanized / independent cities often written without a province
  { match: "cebu city", label: "Cebu City", group: "Visayas" },
  { match: "iloilo city", label: "Iloilo City", group: "Visayas" },
  { match: "bacolod", label: "Bacolod", group: "Visayas" },
  { match: "tacloban", label: "Tacloban", group: "Visayas" },
  { match: "davao city", label: "Davao City", group: "Mindanao" },
  { match: "cagayan de oro", label: "Cagayan de Oro", group: "Mindanao" },
  { match: "zamboanga city", label: "Zamboanga City", group: "Mindanao" },
  { match: "general santos", label: "General Santos", group: "Mindanao" },
  { match: "butuan", label: "Butuan", group: "Mindanao" },
  { match: "iligan", label: "Iligan", group: "Mindanao" },
  { match: "cotabato city", label: "Cotabato City", group: "Mindanao" },
  { match: "baguio", label: "Baguio", group: "Luzon" },
  { match: "puerto princesa", label: "Puerto Princesa", group: "Luzon" },
];

/** Provinces with their island-group. Matched after city defs, longest-first. */
const PROVINCE_DEFS: AreaDef[] = [
  // Luzon — Ilocos / Cagayan Valley / CAR
  { match: "ilocos norte", label: "Ilocos Norte", group: "Luzon" },
  { match: "ilocos sur", label: "Ilocos Sur", group: "Luzon" },
  { match: "la union", label: "La Union", group: "Luzon" },
  { match: "pangasinan", label: "Pangasinan", group: "Luzon" },
  { match: "batanes", label: "Batanes", group: "Luzon" },
  { match: "cagayan", label: "Cagayan", group: "Luzon" },
  { match: "isabela", label: "Isabela", group: "Luzon" },
  { match: "nueva vizcaya", label: "Nueva Vizcaya", group: "Luzon" },
  { match: "quirino", label: "Quirino", group: "Luzon" },
  { match: "abra", label: "Abra", group: "Luzon" },
  { match: "apayao", label: "Apayao", group: "Luzon" },
  { match: "benguet", label: "Benguet", group: "Luzon" },
  { match: "ifugao", label: "Ifugao", group: "Luzon" },
  { match: "kalinga", label: "Kalinga", group: "Luzon" },
  { match: "mountain province", label: "Mountain Province", group: "Luzon" },
  // Luzon — Central Luzon
  { match: "aurora", label: "Aurora", group: "Luzon" },
  { match: "bataan", label: "Bataan", group: "Luzon" },
  { match: "bulacan", label: "Bulacan", group: "Luzon" },
  { match: "nueva ecija", label: "Nueva Ecija", group: "Luzon" },
  { match: "pampanga", label: "Pampanga", group: "Luzon" },
  { match: "tarlac", label: "Tarlac", group: "Luzon" },
  { match: "zambales", label: "Zambales", group: "Luzon" },
  // Luzon — CALABARZON
  { match: "batangas", label: "Batangas", group: "Luzon" },
  { match: "cavite", label: "Cavite", group: "Luzon" },
  { match: "laguna", label: "Laguna", group: "Luzon" },
  { match: "quezon", label: "Quezon", group: "Luzon" },
  { match: "rizal", label: "Rizal", group: "Luzon" },
  // Luzon — MIMAROPA
  { match: "marinduque", label: "Marinduque", group: "Luzon" },
  { match: "occidental mindoro", label: "Occidental Mindoro", group: "Luzon" },
  { match: "oriental mindoro", label: "Oriental Mindoro", group: "Luzon" },
  { match: "palawan", label: "Palawan", group: "Luzon" },
  { match: "romblon", label: "Romblon", group: "Luzon" },
  // Luzon — Bicol
  { match: "albay", label: "Albay", group: "Luzon" },
  { match: "camarines norte", label: "Camarines Norte", group: "Luzon" },
  { match: "camarines sur", label: "Camarines Sur", group: "Luzon" },
  { match: "catanduanes", label: "Catanduanes", group: "Luzon" },
  { match: "masbate", label: "Masbate", group: "Luzon" },
  { match: "sorsogon", label: "Sorsogon", group: "Luzon" },
  // Visayas — Western
  { match: "aklan", label: "Aklan", group: "Visayas" },
  { match: "antique", label: "Antique", group: "Visayas" },
  { match: "capiz", label: "Capiz", group: "Visayas" },
  { match: "guimaras", label: "Guimaras", group: "Visayas" },
  { match: "iloilo", label: "Iloilo", group: "Visayas" },
  { match: "negros occidental", label: "Negros Occidental", group: "Visayas" },
  // Visayas — Central
  { match: "bohol", label: "Bohol", group: "Visayas" },
  { match: "cebu", label: "Cebu", group: "Visayas" },
  { match: "negros oriental", label: "Negros Oriental", group: "Visayas" },
  { match: "siquijor", label: "Siquijor", group: "Visayas" },
  // Visayas — Eastern
  { match: "biliran", label: "Biliran", group: "Visayas" },
  { match: "eastern samar", label: "Eastern Samar", group: "Visayas" },
  { match: "northern samar", label: "Northern Samar", group: "Visayas" },
  { match: "southern leyte", label: "Southern Leyte", group: "Visayas" },
  { match: "leyte", label: "Leyte", group: "Visayas" },
  { match: "western samar", label: "Samar", group: "Visayas" },
  { match: "samar", label: "Samar", group: "Visayas" },
  // Mindanao — Zamboanga Peninsula
  { match: "zamboanga del norte", label: "Zamboanga del Norte", group: "Mindanao" },
  { match: "zamboanga del sur", label: "Zamboanga del Sur", group: "Mindanao" },
  { match: "zamboanga sibugay", label: "Zamboanga Sibugay", group: "Mindanao" },
  // Mindanao — Northern Mindanao
  { match: "bukidnon", label: "Bukidnon", group: "Mindanao" },
  { match: "camiguin", label: "Camiguin", group: "Mindanao" },
  { match: "lanao del norte", label: "Lanao del Norte", group: "Mindanao" },
  { match: "misamis occidental", label: "Misamis Occidental", group: "Mindanao" },
  { match: "misamis oriental", label: "Misamis Oriental", group: "Mindanao" },
  // Mindanao — Davao
  { match: "davao de oro", label: "Davao de Oro", group: "Mindanao" },
  { match: "compostela valley", label: "Davao de Oro", group: "Mindanao" },
  { match: "davao del norte", label: "Davao del Norte", group: "Mindanao" },
  { match: "davao del sur", label: "Davao del Sur", group: "Mindanao" },
  { match: "davao occidental", label: "Davao Occidental", group: "Mindanao" },
  { match: "davao oriental", label: "Davao Oriental", group: "Mindanao" },
  // Mindanao — SOCCSKSARGEN
  { match: "south cotabato", label: "South Cotabato", group: "Mindanao" },
  { match: "sultan kudarat", label: "Sultan Kudarat", group: "Mindanao" },
  { match: "sarangani", label: "Sarangani", group: "Mindanao" },
  { match: "cotabato", label: "Cotabato", group: "Mindanao" },
  // Mindanao — Caraga
  { match: "agusan del norte", label: "Agusan del Norte", group: "Mindanao" },
  { match: "agusan del sur", label: "Agusan del Sur", group: "Mindanao" },
  { match: "dinagat islands", label: "Dinagat Islands", group: "Mindanao" },
  { match: "surigao del norte", label: "Surigao del Norte", group: "Mindanao" },
  { match: "surigao del sur", label: "Surigao del Sur", group: "Mindanao" },
  // Mindanao — BARMM
  { match: "basilan", label: "Basilan", group: "Mindanao" },
  { match: "lanao del sur", label: "Lanao del Sur", group: "Mindanao" },
  { match: "maguindanao del norte", label: "Maguindanao del Norte", group: "Mindanao" },
  { match: "maguindanao del sur", label: "Maguindanao del Sur", group: "Mindanao" },
  { match: "maguindanao", label: "Maguindanao", group: "Mindanao" },
  { match: "tawi-tawi", label: "Tawi-Tawi", group: "Mindanao" },
  { match: "sulu", label: "Sulu", group: "Mindanao" },
];

/**
 * Generic region catch-alls. Lowest priority — only used when no specific city
 * or province matched, so e.g. "Quezon City, Metro Manila" buckets under
 * Quezon City rather than a giant generic "Metro Manila" pile.
 */
const GENERIC_DEFS: AreaDef[] = [
  { match: "metro manila", label: "Metro Manila", group: "Metro Manila" },
  { match: "national capital region", label: "Metro Manila", group: "Metro Manila" },
];

// Longest match first so multi-word names win over their substrings
// (e.g. "South Cotabato" before "Cotabato", "Negros Oriental" before none).
const CITY_DEFS_SORTED = [...CITY_DEFS].sort(
  (a, b) => b.match.length - a.match.length
);
const PROVINCE_DEFS_SORTED = [...PROVINCE_DEFS].sort(
  (a, b) => b.match.length - a.match.length
);

function defId(def: AreaDef): string {
  return `${def.group === "Metro Manila" ? "ncr" : "ph"}-${def.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

/**
 * Resolves an address to its area (NCR city or province). Returns null when no
 * known locality is found — those clinics stay reachable via search / GPS.
 */
export function resolveClinicArea(
  address: string | null | undefined
): Pick<ClinicArea, "id" | "label" | "group"> | null {
  if (!address) return null;
  const text = normalize(address);

  for (const def of CITY_DEFS_SORTED) {
    if (text.includes(def.match)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  for (const def of PROVINCE_DEFS_SORTED) {
    if (text.includes(def.match)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  for (const def of GENERIC_DEFS) {
    if (text.includes(def.match)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  return null;
}
