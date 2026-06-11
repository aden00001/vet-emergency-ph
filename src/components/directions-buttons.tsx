import { buttonVariants } from "@/components/ui/button";
import {
  buildGoogleMapsDirectionsUrl,
  buildWazeUrl,
  hasNavigableLocation,
} from "@/lib/geo";
import { cn } from "@/lib/utils";
import { MapPin, Navigation } from "lucide-react";

interface DirectionsButtonsProps {
  lat: number | null;
  lng: number | null;
  locationVerified?: boolean;
  compact?: boolean;
}

export function DirectionsButtons({
  lat,
  lng,
  locationVerified = true,
  compact = false,
}: DirectionsButtonsProps) {
  if (!hasNavigableLocation(lat, lng, locationVerified)) {
    return (
      <p
        className={cn(
          "text-muted-foreground",
          compact
            ? "col-span-2 text-center text-xs sm:col-span-2"
            : "w-full text-sm"
        )}
      >
        Directions unavailable — address only. Call the clinic to confirm location.
      </p>
    );
  }

  const size = compact ? "sm" : "lg";

  return (
    <>
      <a
        href={buildGoogleMapsDirectionsUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "outline", size }),
          "gap-1.5",
          compact ? "w-full justify-center sm:w-auto" : "h-11"
        )}
      >
        <MapPin className="size-4" />
        Maps
      </a>
      <a
        href={buildWazeUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "outline", size }),
          "gap-1.5",
          compact ? "w-full justify-center sm:w-auto" : "h-11"
        )}
      >
        <Navigation className="size-4" />
        Waze
      </a>
    </>
  );
}
