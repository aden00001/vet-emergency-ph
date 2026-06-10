"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetectedLocation } from "@/components/detected-location";
import { reverseGeocodeLabel, shortenGeocodeLabel } from "@/lib/geocode";
import {
  LOCATION_PRESETS,
  loadSavedLocation,
  PH_CENTER,
  requestUserGeolocation,
  saveLocation,
  type LocationSource,
  type SavedLocation,
} from "@/lib/location-presets";
import {
  AREA_GROUP_ORDER,
  type AreaGroup,
  type ClinicArea,
} from "@/lib/ph-regions";

interface AreaGroupResult {
  group: AreaGroup;
  areas: ClinicArea[];
}

/** Static fallback grouping used if the live area list can't be fetched. */
function fallbackAreaGroups(): AreaGroupResult[] {
  const ncr = LOCATION_PRESETS.filter((p) =>
    p.region.startsWith("Metro Manila")
  ).map((p) => ({
    id: p.id,
    label: p.label,
    group: "Metro Manila" as AreaGroup,
    count: 0,
    emergencyCount: 0,
    lat: p.latitude,
    lng: p.longitude,
  }));
  return ncr.length > 0 ? [{ group: "Metro Manila", areas: ncr }] : [];
}

export interface LocationPickerValue {
  lat: number;
  lng: number;
  label: string;
  source: LocationSource;
}

interface LocationPickerProps {
  value: LocationPickerValue;
  onChange: (value: LocationPickerValue) => void;
  onGpsError?: (message: string) => void;
  /** Called after saved location, auto-detect, or fallback is resolved. */
  onReady?: () => void;
}

export function LocationPicker({ value, onChange, onGpsError, onReady }: LocationPickerProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [addressQuery, setAddressQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOptions, setShowOptions] = useState(value.source === "unset");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [advLat, setAdvLat] = useState(String(value.lat));
  const [advLng, setAdvLng] = useState(String(value.lng));
  const [resolvingLabel, setResolvingLabel] = useState(false);
  const [areaGroups, setAreaGroups] = useState<AreaGroupResult[] | null>(null);

  // Load the nationwide area list derived from clinics actually in the DB.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clinics/areas");
        const json = await res.json();
        if (cancelled) return;
        const groups = (json.groups ?? []) as AreaGroupResult[];
        setAreaGroups(groups.length > 0 ? groups : fallbackAreaGroups());
      } catch {
        if (!cancelled) setAreaGroups(fallbackAreaGroups());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const renderedGroups = useMemo<AreaGroupResult[]>(() => {
    const groups = areaGroups ?? [];
    return AREA_GROUP_ORDER.map((group) => ({
      group,
      areas: groups.find((g) => g.group === group)?.areas ?? [],
    })).filter((g) => g.areas.length > 0);
  }, [areaGroups]);

  const areaById = useMemo(() => {
    const map = new Map<string, ClinicArea>();
    for (const g of areaGroups ?? []) {
      for (const a of g.areas) map.set(a.id, a);
    }
    return map;
  }, [areaGroups]);

  useEffect(() => {
    let cancelled = false;

    async function initLocation() {
      const saved = loadSavedLocation();
      if (saved) {
        onChange({
          lat: saved.lat,
          lng: saved.lng,
          label: saved.label,
          source: saved.source ?? (saved.presetId ? "preset" : "gps"),
        });
        if (saved.presetId) setSelectedAreaId(saved.presetId);
        setAdvLat(String(saved.lat));
        setAdvLng(String(saved.lng));
        onReady?.();
        return;
      }

      try {
        const coords = await requestUserGeolocation();
        if (cancelled) return;
        await applyGpsLocation(coords);
        setSelectedAreaId("");
      } catch {
        // No GPS and no saved area — ask the user to choose an area instead of
        // silently defaulting to one city (data is now nationwide).
        onChange({
          lat: PH_CENTER.lat,
          lng: PH_CENTER.lng,
          label: "Philippines",
          source: "unset",
        });
        setShowOptions(true);
      } finally {
        if (!cancelled) onReady?.();
      }
    }

    void initLocation();

    return () => {
      cancelled = true;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyLocation(loc: SavedLocation) {
    saveLocation(loc);
    onChange({
      lat: loc.lat,
      lng: loc.lng,
      label: loc.label,
      source: loc.source ?? "preset",
    });
    setAdvLat(String(loc.lat));
    setAdvLng(String(loc.lng));
  }

  async function applyGpsLocation(coords: { lat: number; lng: number }) {
    applyLocation({
      lat: coords.lat,
      lng: coords.lng,
      label: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      source: "gps",
    });

    setResolvingLabel(true);
    try {
      const label = await reverseGeocodeLabel(coords.lat, coords.lng);
      applyLocation({
        lat: coords.lat,
        lng: coords.lng,
        label,
        source: "gps",
      });
    } catch {
      // Coordinates are already shown as the label.
    } finally {
      setResolvingLabel(false);
    }
  }

  function handleAreaChange(id: string | null) {
    if (!id) return;
    setSelectedAreaId(id);
    const area = areaById.get(id);
    if (!area) return;
    applyLocation({
      lat: area.lat,
      lng: area.lng,
      label: area.label,
      presetId: id,
      source: "preset",
    });
    setShowOptions(false);
  }

  async function useMyLocation() {
    setGpsBusy(true);
    try {
      const coords = await requestUserGeolocation();
      await applyGpsLocation(coords);
      setSelectedAreaId("");
    } catch {
      setShowOptions(true);
      onGpsError?.(
        "Could not access GPS. Allow location permission, or pick your city / barangay below."
      );
    } finally {
      setGpsBusy(false);
    }
  }

  async function searchAddress(e: React.FormEvent) {
    e.preventDefault();
    if (addressQuery.trim().length < 3) return;
    setGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(addressQuery.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Address not found");
      const first = json.results?.[0];
      if (!first) {
        onGpsError?.("No match found. Try a nearby barangay, street, or city name.");
        return;
      }
      applyLocation({
        lat: first.latitude,
        lng: first.longitude,
        label: shortenGeocodeLabel(first.label),
        source: "search",
      });
      setSelectedAreaId("");
      setAddressQuery("");
      setShowOptions(false);
    } catch (err) {
      onGpsError?.(err instanceof Error ? err.message : "Could not find that address");
    } finally {
      setGeocoding(false);
    }
  }

  function applyAdvancedPin(e: React.FormEvent) {
    e.preventDefault();
    const lat = Number(advLat);
    const lng = Number(advLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    applyLocation({ lat, lng, label: "Custom pin", source: "custom" });
    setSelectedAreaId("");
  }

  return (
    <div className="space-y-3">
      <DetectedLocation
        label={value.label}
        lat={value.lat}
        lng={value.lng}
        source={value.source}
        resolving={resolvingLabel}
        onUseGps={useMyLocation}
        gpsBusy={gpsBusy}
      />

      <div
        className={`rounded-xl border ${
          value.source === "unset"
            ? "border-primary/40 bg-primary/[0.03]"
            : "border-border/70"
        }`}
      >
        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          aria-expanded={showOptions}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            {value.source === "unset"
              ? "Choose your area to find nearby clinics"
              : "Not right? Change your location"}
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${
              showOptions ? "rotate-180" : ""
            }`}
          />
        </button>

        {showOptions && (
          <div className="space-y-4 border-t border-border/70 p-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="area-preset" className="text-xs text-muted-foreground">
                Pick your city or province
              </Label>
              <Select
                value={selectedAreaId || undefined}
                onValueChange={handleAreaChange}
                disabled={!areaGroups}
              >
                <SelectTrigger id="area-preset" className="w-full">
                  <SelectValue
                    placeholder={
                      areaGroups ? "Choose city or province…" : "Loading areas…"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {renderedGroups.map((g) => (
                    <SelectGroup key={g.group}>
                      <SelectLabel>{g.group}</SelectLabel>
                      {g.areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.label}
                          {area.count > 0 ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {area.count}
                            </span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <form onSubmit={searchAddress} className="space-y-1.5">
              <Label htmlFor="address-search" className="text-xs text-muted-foreground">
                Or search any barangay, street, or landmark
              </Label>
              <div className="flex gap-2">
                <Input
                  id="address-search"
                  placeholder="e.g. Cebu City, Timog Ave, Davao"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={geocoding}
                  className="shrink-0 gap-1"
                >
                  <Search className="size-4" />
                  {geocoding ? "…" : "Find"}
                </Button>
              </div>
            </form>

            <div>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide exact coordinates" : "Set exact coordinates (advanced)"}
              </button>

              {showAdvanced && (
                <form onSubmit={applyAdvancedPin} className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="adv-lat" className="text-xs text-muted-foreground">
                      Latitude
                    </Label>
                    <Input
                      id="adv-lat"
                      type="number"
                      step="any"
                      value={advLat}
                      onChange={(e) => setAdvLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="adv-lng" className="text-xs text-muted-foreground">
                      Longitude
                    </Label>
                    <Input
                      id="adv-lng"
                      type="number"
                      step="any"
                      value={advLng}
                      onChange={(e) => setAdvLng(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline" className="w-full gap-2">
                      <MapPin className="size-4" />
                      Set pin
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
