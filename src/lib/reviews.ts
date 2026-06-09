export const EXPERIENCE_TAGS = [
  { id: "quick_response", label: "Quick response" },
  { id: "accepted_emergency", label: "Accepted emergency" },
  { id: "compassionate_staff", label: "Compassionate staff" },
  { id: "would_recommend", label: "Would recommend" },
  { id: "long_wait", label: "Long wait" },
  { id: "hard_to_reach", label: "Hard to reach by phone" },
] as const;

export type ExperienceTagId = (typeof EXPERIENCE_TAGS)[number]["id"];

const TAG_LABELS = Object.fromEntries(
  EXPERIENCE_TAGS.map((t) => [t.id, t.label])
) as Record<ExperienceTagId, string>;

export function getExperienceTagLabel(tag: string): string {
  return TAG_LABELS[tag as ExperienceTagId] ?? tag.replace(/_/g, " ");
}

export function formatAverageRating(rating: number | null | undefined): string {
  if (rating == null) return "—";
  return Number(rating).toFixed(1);
}

export function ratingLabel(count: number): string {
  return count === 1 ? "1 review" : `${count} reviews`;
}
