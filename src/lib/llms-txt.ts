import {
  getSiteUrl,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/brand";
import { fetchAreaGroups, getTopAreas } from "@/lib/clinic-areas";
import { HELP_TOPICS } from "@/lib/help-content";
import { canonicalUrl } from "@/lib/seo";

function link(path: string, title: string, description: string): string {
  return `- [${title}](${canonicalUrl(path)}): ${description}`;
}

/** Agent-facing site index for generative search crawlers (llms.txt spec). */
export async function buildLlmsTxt(): Promise<string> {
  const base = getSiteUrl();
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} (${base}) is a free emergency veterinary clinic directory for the Philippines. ${SITE_TAGLINE}. Listings include clinic names, addresses, phone numbers, hours, and maps. Always call a clinic before traveling — this site is informational only, not veterinary advice.`,
    "",
    "## Emergency directory",
    link(
      "/",
      "Emergency vet locator",
      "Search emergency-capable clinics by location across the Philippines."
    ),
    link(
      "/areas",
      "Browse by city and province",
      "Area index grouped by Metro Manila, Luzon, Visayas, and Mindanao."
    ),
  ];

  try {
    const groups = await fetchAreaGroups();
    const topAreas = getTopAreas(groups, 15);
    if (topAreas.length > 0) {
      lines.push("", "## Popular areas");
      for (const area of topAreas) {
        lines.push(
          link(
            `/areas/${area.id}`,
            `24/7 emergency vets in ${area.label}`,
            `${area.emergencyCount} emergency-capable clinics listed.`
          )
        );
      }
    }
  } catch {
    // Core links above are enough when area data is unavailable
  }

  lines.push(
    "",
    "## Pet emergency guides",
    ...HELP_TOPICS.map((topic) =>
      link(`/help/${topic.slug}`, topic.title, topic.description)
    ),
    link(
      "/help",
      "Emergency help & FAQ",
      "How to find a 24/7 vet in the Philippines and what to do before you travel."
    ),
    "",
    "## Site information",
    link("/about", "About Vet247PH", "What the directory is and how listings are maintained."),
    link("/disclaimer", "Disclaimer", "Medical and listing accuracy disclaimer."),
    link("/for-clinics", "For clinics", "Report listing corrections or request updates."),
    "",
    "## Full index",
    `- [Sitemap](${canonicalUrl("/sitemap.xml")}): All indexable area, clinic, and help URLs.`,
    "",
    "## Contact",
    `- Listing corrections and feedback: ${SITE_CONTACT_EMAIL}`,
    "",
    "## Optional",
    "- Clinic pages use LocalBusiness and VeterinaryCare structured data with address, phone, and hours when available.",
    "- API routes under /api/ are for the live search UI and are not intended for citation."
  );

  return `${lines.join("\n")}\n`;
}
