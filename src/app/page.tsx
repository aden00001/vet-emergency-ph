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
import { HeroIllustration } from "@/components/hero-illustration";
import { SiteHeader } from "@/components/site-header";
import type { ClinicSortOption } from "@/lib/clinic-sort";
import {
  DEFAULT_PRESET_ID,
  getPresetById,
} from "@/lib/location-presets";
import { SITE_NAME } from "@/lib/brand";
import type { NearbyClinic, TriageCategory } from "@/types/database";

const defaultPreset = getPresetById(DEFAULT_PRESET_ID)!;

export default function HomePage() {
  const [clinics, setClinics] = useState<NearbyClinic[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationPickerValue>({
    lat: defaultPreset.latitude,
    lng: defaultPreset.longitude,
    label: defaultPreset.label,
    source: "default",
  });
  const [triage, setTriage] = useState<TriageCategory | null>(null);
  const [emergencyOnly, setEmergencyOnly] = useState(true);
  const [sortBy, setSortBy] = useState<ClinicSortOption>("recommended");
  const [limit, setLimit] = useState<ResultsCountOption>(20);
  const [locationReady, setLocationReady] = useState(false);

  const searchClinics = useCallback(
    async (searchLat: number, searchLng: number) => {
      setLoading(true);
      setError(null);
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

  useEffect(() => {
    if (!locationReady) return;
    searchClinics(location.lat, location.lng);
  }, [location.lat, location.lng, locationReady, searchClinics]);

  const shownCount = clinics.length;

  return (
    <div className="app-backdrop flex min-h-full flex-col overflow-x-clip">
      <SiteHeader showUtilityLinks={false} />
      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 py-8 space-y-7">
        <section className="grid items-center gap-8 overflow-hidden sm:grid-cols-[1fr_minmax(200px,240px)] sm:gap-6">
          <div className="min-w-0 space-y-3 text-center sm:text-left">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex size-2 shrink-0 overflow-hidden rounded-full">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Live emergency directory · Philippines
            </span>
            <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
              Find emergency vet care{" "}
              <span className="text-gradient-brand">in seconds</span>
            </h1>
            <p className="mx-auto max-w-xl text-balance text-muted-foreground sm:mx-0">
              Locate, verify, and call emergency-capable veterinary clinics near
              you. Always phone the clinic before traveling.
            </p>
          </div>
          <HeroIllustration />
        </section>

        <section className="glass shadow-soft min-w-0 space-y-5 overflow-hidden rounded-2xl p-5">
          <EmergencyTriage onSelect={setTriage} selected={triage} />

          <div className="h-px bg-border/70" />

          <LocationPicker
            value={location}
            onChange={setLocation}
            onGpsError={setError}
            onReady={() => setLocationReady(true)}
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground">
              Show:
            </span>
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

        {locationReady && !loading && !error && totalCount > 0 && (
          <div className="flex min-w-0 flex-col gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="font-display text-sm font-semibold text-muted-foreground">
                {shownCount < totalCount
                  ? `Showing ${shownCount} of ${totalCount} clinics`
                  : `${totalCount} ${totalCount === 1 ? "clinic" : "clinics"} near you`}
              </h2>
              <p className="text-xs text-muted-foreground">
                Near <span className="font-medium text-foreground">{location.label}</span>
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

        {(!locationReady || loading) && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {!locationReady ? "Detecting your location…" : "Finding nearest clinics…"}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {locationReady && !loading && !error && clinics.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <p className="font-medium">No clinics found nearby</p>
            <p className="mt-1 text-sm">
              Try a different area or turn off the emergency-only filter.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {locationReady &&
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

        <p className="pb-6 text-center text-xs text-muted-foreground">
          {SITE_NAME} is an informational directory. Powered by{" "}
          <a
            href="https://kennzchoice.online"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Kennz Choice
          </a>
          .{" "}
          <a href="/disclaimer" className="font-medium text-primary underline-offset-2 hover:underline">
            Read disclaimer
          </a>
        </p>
      </main>
    </div>
  );
}
