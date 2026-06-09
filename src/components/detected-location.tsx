import { Crosshair, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocationSource } from "@/lib/location-presets";

interface DetectedLocationProps {
  label: string;
  lat: number;
  lng: number;
  source: LocationSource;
  resolving?: boolean;
  onUseGps?: () => void;
  gpsBusy?: boolean;
}

const SOURCE_META: Record<
  LocationSource,
  { badge: string; icon: typeof MapPin }
> = {
  gps: { badge: "Detected via GPS", icon: Navigation },
  preset: { badge: "Selected area", icon: MapPin },
  search: { badge: "Searched address", icon: Search },
  custom: { badge: "Custom pin", icon: Crosshair },
  default: { badge: "Default area", icon: MapPin },
};

export function DetectedLocation({
  label,
  lat,
  lng,
  source,
  resolving = false,
  onUseGps,
  gpsBusy = false,
}: DetectedLocationProps) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-4 shadow-soft">
      <div className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative flex items-start gap-3.5">
        <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {meta.badge}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Searching clinics here
            </span>
          </div>

          {resolving ? (
            <div className="space-y-2 pt-1">
              <div className="h-4 w-44 max-w-full animate-pulse rounded bg-primary/15" />
              <div className="h-3 w-28 max-w-full animate-pulse rounded bg-muted-foreground/20" />
            </div>
          ) : (
            <>
              <p className="font-display text-base font-bold leading-snug text-foreground">
                {label}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            </>
          )}
        </div>

        {onUseGps && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUseGps}
            disabled={gpsBusy}
            className="shrink-0 gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            {gpsBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Navigation className="size-4" />
            )}
            <span className="hidden sm:inline">
              {source === "gps" ? "Recenter" : "Use GPS"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
