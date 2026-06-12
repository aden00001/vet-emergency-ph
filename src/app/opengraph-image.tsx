import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(145deg, #0f766e 0%, #134e4a 45%, #164e63 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "40px",
            }}
          >
            🐾
          </div>
          <span style={{ fontSize: "52px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {SITE_NAME}
          </span>
        </div>
        <p
          style={{
            fontSize: "44px",
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: "900px",
            margin: 0,
          }}
        >
          {SITE_TAGLINE}
        </p>
        <p
          style={{
            fontSize: "26px",
            opacity: 0.9,
            marginTop: "28px",
            maxWidth: "820px",
            lineHeight: 1.4,
          }}
        >
          Emergency veterinary clinic directory for the Philippines
        </p>
      </div>
    ),
    { ...size }
  );
}
