import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const NOMINATIM_HEADERS = {
  "User-Agent": "Vet247PH/1.0 (geocode for emergency vet search)",
};

const forwardSchema = z.object({
  q: z.string().min(3).max(200),
});

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const reverseParsed = reverseSchema.safeParse(params);

  if (reverseParsed.success) {
    const { lat, lng } = reverseParsed.data;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    try {
      const res = await fetch(url, {
        headers: NOMINATIM_HEADERS,
        next: { revalidate: 86400 },
      });

      if (!res.ok) {
        return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
      }

      const result = (await res.json()) as { display_name?: string };
      if (!result.display_name) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }

      return NextResponse.json({
        latitude: lat,
        longitude: lng,
        label: result.display_name,
      });
    } catch {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
    }
  }

  const parsed = forwardSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter at least 3 characters to search, or provide lat and lng" },
      { status: 400 }
    );
  }

  const search = encodeURIComponent(`${parsed.data.q}, Philippines`);
  const url = `https://nominatim.openstreetmap.org/search?q=${search}&format=json&limit=5&countrycodes=ph`;

  try {
    const res = await fetch(url, {
      headers: NOMINATIM_HEADERS,
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding service unavailable" }, { status: 502 });
    }

    const results = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    return NextResponse.json({
      results: results.map((r) => ({
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
        label: r.display_name,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
