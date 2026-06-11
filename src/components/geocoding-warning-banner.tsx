import { TriangleAlert } from "lucide-react";

const MESSAGE =
  "We found geocoding issues for some locations — Google Maps and Waze directions may be incorrect. We are working to resolve this.";

export function GeocodingWarningBanner() {
  return (
    <div
      role="status"
      aria-label={MESSAGE}
      className="border-b border-chart-4/30 bg-chart-4/12 text-foreground"
    >
      <div className="flex h-9 items-center overflow-hidden sm:h-10">
        <TriangleAlert
          className="mx-3 size-4 shrink-0 text-chart-4"
          aria-hidden
        />
        <div className="geocoding-marquee min-w-0 flex-1 overflow-hidden">
          <div className="geocoding-marquee-track flex w-max gap-16 whitespace-nowrap pr-16 text-xs font-semibold sm:text-sm">
            <span>{MESSAGE}</span>
            <span aria-hidden>{MESSAGE}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
