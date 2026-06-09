export interface ConfidenceLabel {
  stars: number;
  label: string;
  description: string;
}

export function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) {
    return {
      stars: 5,
      label: "Highly Reliable",
      description: "Owner verified with recent community or status updates.",
    };
  }
  if (score >= 60) {
    return {
      stars: 4,
      label: "Reliable",
      description: "Recent verification activity supports this listing.",
    };
  }
  if (score >= 40) {
    return {
      stars: 3,
      label: "Moderate Confidence",
      description: "Some verification data available; confirm by phone.",
    };
  }
  if (score >= 20) {
    return {
      stars: 2,
      label: "Low Confidence",
      description: "Limited recent verification. Call before traveling.",
    };
  }
  return {
    stars: 1,
    label: "Information May Be Outdated",
    description: "No recent verifications. Always call the clinic first.",
  };
}

export function renderStars(count: number): string {
  return "★".repeat(count) + "☆".repeat(5 - count);
}
