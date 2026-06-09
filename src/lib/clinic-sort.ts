import type { ClinicStatusType, NearbyClinic } from "@/types/database";

export type ClinicSortOption =
  | "recommended"
  | "distance"
  | "rating"
  | "reviews"
  | "confidence"
  | "availability";

export const CLINIC_SORT_OPTIONS: {
  value: ClinicSortOption;
  label: string;
  description: string;
}[] = [
  {
    value: "recommended",
    label: "Recommended",
    description: "Best match for emergencies near you",
  },
  {
    value: "distance",
    label: "Nearest first",
    description: "Closest clinics first",
  },
  {
    value: "rating",
    label: "Highest rated",
    description: "Top community star ratings",
  },
  {
    value: "reviews",
    label: "Most reviewed",
    description: "Most community feedback",
  },
  {
    value: "confidence",
    label: "Most verified",
    description: "Highest data confidence score",
  },
  {
    value: "availability",
    label: "Most available",
    description: "Accepting emergencies first",
  },
];

const STATUS_PRIORITY: Record<ClinicStatusType, number> = {
  accepting: 0,
  limited: 1,
  not_accepting: 2,
  closed: 3,
};

export function sortClinics(
  clinics: NearbyClinic[],
  sortBy: ClinicSortOption
): NearbyClinic[] {
  const list = [...clinics];

  switch (sortBy) {
    case "distance":
      return list.sort((a, b) => a.distance_meters - b.distance_meters);

    case "rating":
      return list.sort((a, b) => {
        const aRating = a.average_rating ?? -1;
        const bRating = b.average_rating ?? -1;
        if (bRating !== aRating) return bRating - aRating;
        return (b.review_count ?? 0) - (a.review_count ?? 0);
      });

    case "reviews":
      return list.sort((a, b) => {
        const countDiff = (b.review_count ?? 0) - (a.review_count ?? 0);
        if (countDiff !== 0) return countDiff;
        return (b.average_rating ?? 0) - (a.average_rating ?? 0);
      });

    case "confidence":
      return list.sort((a, b) => {
        const scoreDiff = b.confidence_score - a.confidence_score;
        if (scoreDiff !== 0) return scoreDiff;
        if (a.owner_verified !== b.owner_verified) {
          return a.owner_verified ? -1 : 1;
        }
        return a.distance_meters - b.distance_meters;
      });

    case "availability":
      return list.sort((a, b) => {
        const statusDiff =
          STATUS_PRIORITY[a.current_status] - STATUS_PRIORITY[b.current_status];
        if (statusDiff !== 0) return statusDiff;
        return a.distance_meters - b.distance_meters;
      });

    case "recommended":
    default:
      return list.sort((a, b) => {
        const rankDiff = a.rank_score - b.rank_score;
        if (rankDiff !== 0) return rankDiff;
        return a.distance_meters - b.distance_meters;
      });
  }
}

export function getSortLabel(sortBy: ClinicSortOption): string {
  return CLINIC_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Recommended";
}
