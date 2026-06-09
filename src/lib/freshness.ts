import { differenceInHours, differenceInDays } from "date-fns";

export type FreshnessLevel = "fresh" | "aging" | "stale";

export function getFreshnessLevel(date: string | Date): FreshnessLevel {
  const d = typeof date === "string" ? new Date(date) : date;
  const hours = differenceInHours(new Date(), d);
  if (hours < 24) return "fresh";
  const days = differenceInDays(new Date(), d);
  if (days <= 7) return "aging";
  return "stale";
}

export function getFreshnessLabel(level: FreshnessLevel): string {
  switch (level) {
    case "fresh":
      return "Fresh";
    case "aging":
      return "Aging";
    case "stale":
      return "Stale";
  }
}

export const FRESHNESS_STYLES: Record<FreshnessLevel, string> = {
  fresh: "bg-emerald-500/15 text-emerald-700",
  aging: "bg-amber-500/15 text-amber-700",
  stale: "bg-zinc-500/15 text-zinc-600",
};
