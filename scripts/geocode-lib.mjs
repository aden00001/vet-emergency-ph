/**
 * Geocode clinic addresses via Nominatim (OpenStreetMap). ~1 request/sec rate limit.
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function geocodeQueries(clinic) {
  const queries = [];
  const address = (clinic.address || "").trim();
  const name = (clinic.name || "").trim();

  if (address) queries.push(`${address}, Philippines`);
  if (name && address) queries.push(`${name}, ${address}, Philippines`);
  if (name) queries.push(`${name}, Philippines`);

  return [...new Set(queries.filter(Boolean))];
}

export async function geocodeQuery(query) {
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ph`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Vet247PH/1.0 (local dev; geocoding for vet directory)",
    },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = await res.json();
  if (!results.length) return null;
  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    display_name: results[0].display_name,
  };
}

export async function geocodeClinic(clinic) {
  const queries = geocodeQueries(clinic);
  for (let i = 0; i < queries.length; i++) {
    const result = await geocodeQuery(queries[i]);
    if (result) return result;
    if (i < queries.length - 1) await sleep(1100);
  }
  return null;
}

export async function geocodeClinics(clinics, { onProgress } = {}) {
  let geocoded = 0;
  let failed = 0;
  let skipped = 0;

  for (const clinic of clinics) {
    if (clinic.latitude != null && clinic.longitude != null) {
      skipped++;
      continue;
    }

    const label = clinic.name || "Unknown clinic";
    onProgress?.({ phase: "start", clinic, label });

    if (!clinic.address && !clinic.name) {
      onProgress?.({ phase: "fail", clinic, label, reason: "no address or name" });
      failed++;
      continue;
    }

    try {
      const result = await geocodeClinic(clinic);
      if (result) {
        clinic.latitude = result.latitude;
        clinic.longitude = result.longitude;
        clinic.geocoded_from = result.display_name;
        geocoded++;
        onProgress?.({ phase: "ok", clinic, label, result });
      } else {
        failed++;
        onProgress?.({ phase: "fail", clinic, label, reason: "not found" });
      }
    } catch (err) {
      failed++;
      onProgress?.({ phase: "fail", clinic, label, reason: err.message });
    }

    await sleep(1100);
  }

  return { geocoded, failed, skipped };
}
