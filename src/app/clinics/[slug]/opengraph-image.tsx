import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/brand";
import { fetchClinicBySlugOrId } from "@/lib/clinics";
import { is24HourHours } from "@/lib/opening-hours";
import { resolveClinicArea } from "@/lib/ph-regions";

export const alt = "Emergency vet clinic on Vet247PH";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface ImageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClinicOpenGraphImage({ params }: ImageProps) {
  const { slug } = await params;
  const { data: clinic } = await fetchClinicBySlugOrId(slug);

  const name = clinic?.name ?? "Emergency Vet Clinic";
  const area = clinic?.address ? resolveClinicArea(clinic.address)?.label : null;
  const subtitle = area
    ? `Emergency vet in ${area}, Philippines`
    : "Emergency veterinary clinic · Philippines";
  const hoursLabel = clinic?.hours && is24HourHours(clinic.hours)
    ? "Open 24 hours"
    : clinic?.emergency_capable
      ? "Emergency-capable clinic"
      : "Call before traveling";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(145deg, #0f766e 0%, #134e4a 45%, #164e63 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            🐾
          </div>
          <span style={{ fontSize: "32px", fontWeight: 800 }}>{SITE_NAME}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <p
            style={{
              fontSize: "52px",
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              maxWidth: "1000px",
            }}
          >
            {name.length > 60 ? `${name.slice(0, 57)}…` : name}
          </p>
          <p style={{ fontSize: "28px", opacity: 0.92, margin: 0 }}>{subtitle}</p>
        </div>

        <p style={{ fontSize: "24px", opacity: 0.85, margin: 0 }}>{hoursLabel}</p>
      </div>
    ),
    { ...size }
  );
}
