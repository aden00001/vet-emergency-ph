/** Shorten a Nominatim display name for UI labels. */
export function shortenGeocodeLabel(label: string): string {
  return label.split(",").slice(0, 3).join(", ").trim();
}

export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string> {
  const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not resolve location");
  const label = json.label as string | undefined;
  if (!label) throw new Error("Could not resolve location");
  return shortenGeocodeLabel(label);
}
