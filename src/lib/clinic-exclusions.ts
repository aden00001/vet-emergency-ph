/**
 * Human anti-rabies / animal-bite treatment centers (PEP for people).
 * These are NOT veterinary emergency clinics — exclude from import and search.
 */

const VET_NAME_SAFE =
  /veterinary clinic|veterinarian|veterinary hospital|vet hospital|animal hospital|emergency veterinarian|vet 911|serbisyo beterinaryo|doc ferds|beterinaryo animal hospital/i;

const HUMAN_BITE_NAME =
  /animal bite clinic|animal bite center|anti.?rabies|rabies center|rabies clinic|post.?exposure|pep center|wecare animal bite|prime animal bite|dr animal bite/i;

export function isHumanBiteCenter(name?: string | null, category = ""): boolean {
  const n = (name || "").trim();
  const c = (category || "").trim().toLowerCase();

  if (!n) return false;
  if (VET_NAME_SAFE.test(n)) return false;

  if (HUMAN_BITE_NAME.test(n)) return true;

  if (/bite|rabies/.test(n.toLowerCase())) {
    if (c.includes("medical clinic")) return true;
    if (/^animal bite|^anti.?rabies|bite clinic|bite center/i.test(n)) return true;
  }

  return false;
}
