import { buttonVariants } from "@/components/ui/button";
import { buildGoogleMapsDirectionsUrl, buildWazeUrl } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { MapPin, Navigation } from "lucide-react";

interface DirectionsButtonsProps {
  lat: number;
  lng: number;
  compact?: boolean;
}

export function DirectionsButtons({
  lat,
  lng,
  compact = false,
}: DirectionsButtonsProps) {
  const size = compact ? "sm" : "lg";
  const extra = compact ? "" : "h-11";

  return (
    <>
      <a
        href={buildGoogleMapsDirectionsUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size }), "gap-1.5", extra)}
      >
        <MapPin className="size-4" />
        Maps
      </a>
      <a
        href={buildWazeUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size }), "gap-1.5", extra)}
      >
        <Navigation className="size-4" />
        Waze
      </a>
    </>
  );
}
