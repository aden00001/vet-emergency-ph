"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClinicCard } from "@/components/clinic-card";
import { ClinicSortSelect } from "@/components/clinic-sort-select";
import {
  ResultsCountSelect,
  type ResultsCountOption,
} from "@/components/results-count-select";
import { EmergencyTriage } from "@/components/emergency-triage";
import { LocationPicker, type LocationPickerValue } from "@/components/location-picker";
import type { ClinicSortOption } from "@/lib/clinic-sort";
import { PH_CENTER } from "@/lib/location-presets";
import type { NearbyClinic, TriageCategory } from "@/types/database";

interface HomeSearchProps {
  initialClinics: NearbyClinic[];
  initialTotal: number;
  initialLocationLabel: string;
}

export function HomeSearch({
  initialClinics,
  initialTotal,
  initialLocationLabel,
}: HomeSearchProps) {
  const [clinics, setClinics] = useState<NearbyClinic[]>(initialClinics);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationPickerValue>({
    lat: PH_CENTER.lat,
    lng: PH_CENTER.lng,
    label: "Philippines",
    source: "unset",
  });
  const [triage, setTriage] = useState<TriageCategory | null>(null);
  const [emergencyOnly, setEmergencyOnly] = useState(true);
  const [sortBy, setSortBy] = useState<ClinicSortOption>("recommended");
  const [limit, setLimit] = useState<ResultsCountOption>(20);
  const [locationReady, setLocationReady] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const searchClinics = useCallback(
    async (searchLat: number, searchLng: number) => {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        const params = new URLSearchParams({
          lat: String(searchLat),
          lng: String(searchLng),
          radius: "25",
          emergencyOnly: String(emergencyOnly),
          limit: String(limit),
          sort: sortBy,
        });
        if (triage) params.set("triage", triage);

        const res = await fetch(`/api/clinics/nearby?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Search failed");
        setClinics(json.clinics ?? []);
        setTotalCount(json.total ?? json.clinics?.length ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setClinics([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [triage, emergencyOnly, limit, sortBy]
  );

  const handleLocationChange = useCallback(
    (next: LocationPickerValue) => {
      setLocation(next);
      if (next.source !== "unset") {
        void searchClinics(next.lat, next.lng);
      }
    },
    [searchClinics]
  );

  const awaitingArea = location.source === "unset";

  useEffect(() => {
    if (!locationReady || awaitingArea || !hasSearched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when filters change
    void searchClinics(location.lat, location.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triage, emergencyOnly, limit, sortBy]);

  const shownCount = clinics.length;
  const displayLabel = hasSearched ? location.label : initialLocationLabel;
  const showResults =
    (locationReady && !awaitingArea && !loading && !error && totalCount > 0) ||
    (!hasSearched && !awaitingArea && initialClinics.length > 0);

  return (
    <>
      <section className="glass shadow-soft min-w-0 space-y-5 overflow-hidden rounded-2xl p-5">
        <EmergencyTriage onSelect={setTriage} selected={triage} />

        <div className="h-px bg-border/70" />

        <LocationPicker
          value={location}
          onChange={handleLocationChange}
          onGpsError={setError}
          onReady={() => setLocationReady(true)}
        />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground">Show:</span>
          <Button
            size="sm"
            variant={emergencyOnly ? "default" : "outline"}
            onClick={() => setEmergencyOnly(true)}
            className="rounded-full"
          >
            Emergency only
          </Button>
          <Button
            size="sm"
            variant={!emergencyOnly ? "default" : "outline"}
            onClick={() => setEmergencyOnly(false)}
            className="rounded-full"
          >
            All clinics
          </Button>
        </div>
      </section>

      {showResults && (
        <div className="flex min-w-0 flex-col gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <h2 className="font-display text-sm font-semibold text-muted-foreground">
              {shownCount < totalCount
                ? `Showing ${shownCount} of ${totalCount} clinics`
                : `${totalCount} ${totalCount === 1 ? "clinic" : "clinics"} near you`}
            </h2>
            <p className="text-xs text-muted-foreground">
              Near <span className="font-medium text-foreground">{displayLabel}</span>
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ClinicSortSelect
              value={sortBy}
              onChange={setSortBy}
              disabled={loading}
            />
            <ResultsCountSelect
              value={limit}
              onChange={setLimit}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {(!locationReady || (loading && !awaitingArea)) && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {!locationReady ? "Detecting your location…" : "Finding nearest clinics…"}
        </div>
      )}

      {locationReady && awaitingArea && (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] py-12 text-center">
          <p className="font-display font-semibold text-foreground">
            Choose your area to see nearby clinics
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Use GPS, pick your city or province, or search an address above — we
            cover clinics across the Philippines.
          </p>
        </div>
      )}

      {error && !awaitingArea && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {locationReady &&
        !awaitingArea &&
        !loading &&
        !error &&
        clinics.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <p className="font-medium">No clinics found nearby</p>
            <p className="mt-1 text-sm">
              Try a different area or turn off the emergency-only filter.
            </p>
          </div>
        )}

      <div className="space-y-3">
        {locationReady &&
          !awaitingArea &&
          !loading &&
          clinics.map((clinic, index) => (
            <div
              key={clinic.id}
              className="animate-card-enter"
              style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}
            >
              <ClinicCard clinic={clinic} />
            </div>
          ))}
      </div>
    </>
  );
}
