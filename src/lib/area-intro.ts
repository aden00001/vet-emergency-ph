import type { AreaGroup, ClinicArea } from "@/lib/ph-regions";

type AreaIntroInput = Pick<
  ClinicArea,
  "id" | "label" | "group" | "emergencyCount" | "count"
>;

function formatClinicExamples(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const CITY_INTROS: Partial<
  Record<string, (area: AreaIntroInput, examples: string) => string>
> = {
  "ncr-quezon-city": (area, examples) =>
    `Quezon City is one of the largest cities in Metro Manila and has ${area.emergencyCount} emergency-capable veterinary clinics in the Vet247PH directory. Pet owners in Diliman, Fairview, Cubao, and nearby barangays can search by phone and hours before traveling — capacity changes quickly during weekends and holidays.${examples ? ` Listings include ${examples}.` : ""}`,

  "ncr-manila": (area, examples) =>
    `Manila covers dense districts from Ermita and Malate to Sampaloc and Santa Mesa. We list ${area.emergencyCount} emergency-capable clinics across the city — call ahead because after-hours availability varies by clinic and not every location handles surgery or critical trauma.${examples ? ` Examples include ${examples}.` : ""}`,

  "ncr-makati": (area, examples) =>
    `Makati and the surrounding CBD see steady demand for after-hours pet care from condominiums and offices. ${area.emergencyCount} emergency-capable clinics are listed here; confirm the clinic is open and accepting walk-ins before you drive, especially late at night.${examples ? ` Nearby listings include ${examples}.` : ""}`,

  "ncr-caloocan": (area, examples) =>
    `Caloocan spans North and South districts with growing residential pockets that rely on nearby emergency vets. This page lists ${area.emergencyCount} emergency-capable clinics — always phone first to check staffing and whether they can take trauma or toxicity cases.${examples ? ` Clinics such as ${examples} appear in this area.` : ""}`,

  "ph-cebu-city": (area, examples) =>
    `Cebu City is the main emergency vet hub for the Visayas. The directory lists ${area.emergencyCount} emergency-capable clinics serving Cebu City and nearby towns — hours and on-call coverage differ, so confirm by phone before traveling across the island.${examples ? ` Listings include ${examples}.` : ""}`,

  "ph-davao-city": (area, examples) =>
    `Davao City anchors emergency veterinary access across Mindanao. We track ${area.emergencyCount} emergency-capable clinics here; call before you leave, especially for late-night trauma or poisoning cases when only some clinics stay open 24/7.${examples ? ` Examples include ${examples}.` : ""}`,
};

const GROUP_INTROS: Record<
  AreaGroup,
  (area: AreaIntroInput, examples: string) => string
> = {
  "Metro Manila": (area, examples) =>
    `${area.label} is part of Metro Manila (NCR), where traffic and clinic hours make calling ahead essential. Vet247PH lists ${area.emergencyCount} emergency-capable clinics in ${area.label} out of ${area.count} total veterinary listings in this city.${examples ? ` Top listings include ${examples}.` : ""} Browse each clinic for phone numbers, hours, and directions.`,

  Luzon: (area, examples) =>
    `In ${area.label}, Luzon, pet owners can browse ${area.emergencyCount} emergency-capable veterinary clinics from ${area.count} total listings on Vet247PH. Outside Metro Manila, clinics may have shorter after-hours windows — call to confirm they are open and can handle your pet's emergency.${examples ? ` Listings include ${examples}.` : ""}`,

  Visayas: (area, examples) =>
    `${area.label} in the Visayas has ${area.emergencyCount} emergency-capable clinics listed on Vet247PH (${area.count} veterinary clinics total in this area). Island travel can add time in an emergency, so confirm hours and capacity by phone before departing.${examples ? ` Examples: ${examples}.` : ""}`,

  Mindanao: (area, examples) =>
    `For ${area.label}, Mindanao, Vet247PH lists ${area.emergencyCount} emergency-capable clinics among ${area.count} total veterinary listings. After-hours and 24/7 coverage varies — phone the clinic first and describe the emergency so they can prepare or refer you.${examples ? ` Listings include ${examples}.` : ""}`,
};

/** Unique, crawlable intro copy for area landing pages. */
export function getAreaIntro(
  area: AreaIntroInput,
  topClinicNames: string[] = []
): string {
  const examples = formatClinicExamples(topClinicNames.slice(0, 3));
  const cityIntro = CITY_INTROS[area.id];
  if (cityIntro) return cityIntro(area, examples);
  return GROUP_INTROS[area.group](area, examples);
}

/** Short region-level intro for /areas/region/* pages. */
export function getRegionIntro(
  group: AreaGroup,
  areaCount: number,
  emergencyTotal: number
): string {
  const intros: Record<AreaGroup, string> = {
    "Metro Manila":
      `Metro Manila (NCR) has ${areaCount} cities and municipalities in Vet247PH with ${emergencyTotal} emergency-capable clinics combined. Dense traffic makes calling ahead critical — use the city links below to find 24/7 and after-hours vets in Quezon City, Manila, Makati, and other NCR areas.`,
    Luzon: `Luzon provinces and cities outside NCR include ${areaCount} areas in our directory with ${emergencyTotal} emergency-capable clinics. Coverage spans CALABARZON, Central Luzon, Ilocos, Bicol, and more — always confirm clinic hours by phone before traveling.`,
    Visayas: `The Visayas region lists ${areaCount} cities and provinces on Vet247PH with ${emergencyTotal} emergency-capable clinics. Cebu City is the largest hub; smaller islands may have fewer after-hours options, so call ahead when possible.`,
    Mindanao: `Mindanao includes ${areaCount} areas in Vet247PH with ${emergencyTotal} emergency-capable clinics nationwide listings. Davao City and Cagayan de Oro are major hubs — verify that a clinic is open and equipped for your pet's emergency before you leave.`,
  };
  return intros[group];
}
