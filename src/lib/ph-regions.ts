/**
 * Maps a clinic's free-text address to a geographic "area" (NCR city or
 * province) grouped by island region. Used to build a nationwide, data-driven
 * location picker from the clinics actually present in the database.
 *
 * Matching uses **comma-separated locality segments** (city / province near the
 * end of the address), not substring search over the full string. This avoids
 * false positives such as "Manila S Rd" (Laguna) or "Metro Manila" on a Makati
 * listing being bucketed under the City of Manila.
 */

export type AreaGroup = "Metro Manila" | "Luzon" | "Visayas" | "Mindanao";

export const AREA_GROUP_ORDER: AreaGroup[] = [
  "Metro Manila",
  "Luzon",
  "Visayas",
  "Mindanao",
];

export const REGION_SLUGS: Record<AreaGroup, string> = {
  "Metro Manila": "metro-manila",
  Luzon: "luzon",
  Visayas: "visayas",
  Mindanao: "mindanao",
};

export function regionSlug(group: AreaGroup): string {
  return REGION_SLUGS[group];
}

export function groupFromRegionSlug(slug: string): AreaGroup | null {
  const entry = Object.entries(REGION_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as AreaGroup) : null;
}

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

/** Comma-separated locality parts (city / province), not street/building lines. */
function parseLocalitySegments(address: string): string[] {
  const segments = normalize(address)
    .split(/[,;|]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const withoutCountry = segments.filter(
    (segment) => segment !== "philippines" && segment !== "ph"
  );

  if (withoutCountry.length === 0) return [];
  if (withoutCountry.length === 1) return withoutCountry;
  if (withoutCountry.length === 2) return withoutCountry;
  if (withoutCountry.length === 3) return withoutCountry.slice(1);
  return withoutCountry.slice(-3);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isManilaRoadOrDistrict(segment: string): boolean {
  return (
    /\bmetro\s+manila\b/.test(segment) ||
    /\b(new|east|north|south|west|eastern|northern|southern)\s+manila\b/.test(
      segment
    ) ||
    /\bmanila\s+(east|north|south|west|eastern|northern|southern|n|s|e|w)\b/.test(
      segment
    ) ||
    /\bmanila\s+(road|rd|hwy|highway|ave|avenue|blvd|boulevard|street|st|drive|dr|way)\b/.test(
      segment
    ) ||
    /\bmanila\s+(district|dist)\b/.test(segment)
  );
}

const MANILA_DISTRICTS = new Set([
  "tondo",
  "binondo",
  "intramuros",
  "ermita",
  "malate",
  "pandacan",
  "sampaloc",
  "quiapo",
  "san miguel",
  "san nicolas",
  "port area",
  "sta cruz",
  "santa cruz",
]);

function isManilaDistrictSegment(
  segment: string,
  localitySegments: string[]
): boolean {
  if (!MANILA_DISTRICTS.has(segment)) return false;
  return localitySegments.some((part) => /\bmetro\s+manila\b/.test(part));
}

function isManilaCitySegment(
  segment: string,
  localitySegments: string[]
): boolean {
  if (isManilaDistrictSegment(segment, localitySegments)) return true;
  if (isManilaRoadOrDistrict(segment)) return false;
  if (segment === "manila" || segment === "city of manila") return true;
  return /\bmanila\b/.test(segment) && /\bmanila(?:\s+\d{4})?(?:\s+metro)?\s*$/.test(segment);
}

function isHyphenatedRoadSegment(segment: string, place: string): boolean {
  const placeRe = escapeRegExp(place);
  return new RegExp(
    `\\b${placeRe}\\s*[-–]\\s*\\w+(?:\\s+\\w+)*\\s+(rd|road|hwy|highway|st|street|ave|avenue|way|drive|dr|blvd|boulevard)\\b`
  ).test(segment);
}

function isFalsePositivePlaceSegment(segment: string, match: string): boolean {
  if (match === "cagayan" && /\bcagayan\s+valley\b/.test(segment)) return true;
  return false;
}

function isExactLocalitySegment(segment: string, match: string): boolean {
  if (segment === match || segment === `city of ${match}` || segment === `${match} city`) {
    return true;
  }

  if (segment.startsWith(`${match} `)) {
    const rest = segment.slice(match.length + 1).trim();
    if (rest === "city") return true;
    return /^\d{4}(?:\s+metro(?:\s+manila)?)?$/.test(rest);
  }

  if (segment.endsWith(` ${match}`) || segment.endsWith(match)) {
    const prefix = segment.slice(0, segment.length - match.length).trim();
    if (/^\d{4}$/.test(prefix)) return true;
  }

  return false;
}

function isSanJuanCitySegment(
  segment: string,
  localitySegments: string[]
): boolean {
  if (segment === "san juan city") return true;
  if (segment !== "san juan") return false;
  if (isHyphenatedRoadSegment(segment, "san juan")) return false;
  if (isCityRoadSegment(segment, "san juan")) return false;
  return localitySegments.some((part) => /\bmetro\s+manila\b/.test(part));
}

function isCityRoadSegment(segment: string, city: string): boolean {
  const cityRe = escapeRegExp(city);
  return new RegExp(
    `\\b${cityRe}\\s+(ave|avenue|road|rd|st|street|blvd|boulevard|highway|hwy|drive|dr|way|ext|extension)\\b`
  ).test(segment);
}

function segmentMatchesDef(
  segment: string,
  def: AreaDef,
  localitySegments: string[]
): boolean {
  const match = def.match;

  if (match === "manila") {
    return isManilaCitySegment(segment, localitySegments);
  }

  if (match === "san juan") {
    return isSanJuanCitySegment(segment, localitySegments);
  }

  if (isExactLocalitySegment(segment, match)) return true;

  if (!segment.includes(match)) return false;

  if (match.includes(" ")) {
    if (isHyphenatedRoadSegment(segment, match)) return false;
    if (isCityRoadSegment(segment, match.split(" ")[0])) return false;
    return isExactLocalitySegment(segment, match);
  }

  if (isFalsePositivePlaceSegment(segment, match)) return false;
  if (isCityRoadSegment(segment, match)) return false;

  if (segment === match || segment === `city of ${match}`) return true;

  if (segment.startsWith(`${match} `)) {
    const rest = segment.slice(match.length + 1).trim();
    return /^\d{4}(?:\s+metro(?:\s+manila)?)?$/.test(rest);
  }

  return false;
}

function provinceSegmentIndexes(segments: string[]): number[] {
  const indexes: number[] = [];

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (/\bmetro\s+manila\b/.test(segment)) continue;
    if (/^\d{4}(\s+metro(?:\s+manila)?)?$/.test(segment)) continue;
    indexes.push(i);
    if (indexes.length >= 2) break;
  }

  return indexes;
}

function localityMatchesDef(segments: string[], def: AreaDef): boolean {
  return segments.some((segment) =>
    segmentMatchesDef(segment, def, segments)
  );
}

function localityMatchesProvinceDef(segments: string[], def: AreaDef): boolean {
  const indexes = provinceSegmentIndexes(segments);
  return indexes.some((index) =>
    segmentMatchesDef(segments[index], def, segments)
  );
}

/**
 * Resolves an address to its area (NCR city or province). Returns null when no
 * known locality is found — those clinics stay reachable via search / GPS.
 */
export function resolveClinicArea(
  address: string | null | undefined
): Pick<ClinicArea, "id" | "label" | "group"> | null {
  if (!address) return null;
  const localitySegments = parseLocalitySegments(address);
  if (localitySegments.length === 0) return null;

  for (const def of CITY_DEFS_SORTED) {
    if (localityMatchesDef(localitySegments, def)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  for (const def of PROVINCE_DEFS_SORTED) {
    if (localityMatchesProvinceDef(localitySegments, def)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  for (const def of GENERIC_DEFS) {
    if (localityMatchesDef(localitySegments, def)) {
      return { id: defId(def), label: def.label, group: def.group };
    }
  }
  return null;
}
