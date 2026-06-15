import type { Metadata } from "next";
import {
  getSiteUrl,
  SITE_AUTHOR_URL,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/brand";

export const SITE_DESCRIPTION =
  "Find emergency veterinary clinics across the Philippines. Real-time directory of 24/7 and after-hours vet care in Metro Manila, Cebu, and nationwide.";

/** Homepage <title> — local-intent keywords, no template suffix. */
export const HOME_PAGE_TITLE =
  "Emergency Vet Locator Philippines | Find 24/7 Animal Clinics";

export function areaPageTitle(areaLabel: string): string {
  return `24/7 Emergency Vets in ${areaLabel}`;
}

export function clinicPageTitle(
  clinicName: string,
  areaLabel?: string | null
): string {
  if (areaLabel) {
    return `${clinicName} — 24/7 Emergency Vet in ${areaLabel}`;
  }
  return `${clinicName} — 24/7 Emergency Vet Philippines`;
}

export { getSiteUrl } from "@/lib/brand";

export function canonicalUrl(path = "/"): string {
  const base = getSiteUrl().replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image";

export function defaultOgImageUrl(): string {
  return canonicalUrl(DEFAULT_OG_IMAGE_PATH);
}

export function clinicOgImagePath(slug: string): string {
  return `/clinics/${slug}/opengraph-image`;
}

export function clinicOgImageUrl(slug: string): string {
  return canonicalUrl(clinicOgImagePath(slug));
}

/** Prefer self-hosted dynamic OG; external Google URLs often block social crawlers. */
export function resolveClinicOgImage(clinic: {
  slug?: string | null;
  image_url?: string | null;
}): string {
  if (clinic.slug) return clinicOgImageUrl(clinic.slug);
  if (clinic.image_url?.startsWith("https://")) return clinic.image_url;
  return defaultOgImageUrl();
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  noIndex,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  noIndex?: boolean;
  /** Bypass layout title template (use for homepage). */
  absoluteTitle?: boolean;
}): Metadata {
  const url = path ? canonicalUrl(path) : undefined;
  const ogTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const ogImage = image ?? defaultOgImageUrl();

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title: ogTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: "en_PH",
      type: "website",
      images: [{ url: ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImage],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export const rootMetadata: Metadata = {
  title: {
    default: HOME_PAGE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(getSiteUrl()),
  keywords: [
    "emergency vet Philippines",
    "24 hour vet Manila",
    "emergency veterinary clinic",
    "vet clinic near me Philippines",
    "after hours vet Metro Manila",
    "pet emergency Philippines",
    "Vet247PH",
  ],
  authors: [{ name: SITE_NAME, url: getSiteUrl() }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: getSiteUrl(),
    siteName: SITE_NAME,
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: defaultOgImageUrl(), alt: HOME_PAGE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
    images: [defaultOgImageUrl()],
  },
  alternates: {
    canonical: getSiteUrl(),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export function organizationJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    sameAs: [SITE_AUTHOR_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITE_CONTACT_EMAIL,
      areaServed: "PH",
      availableLanguage: ["en"],
    },
    areaServed: {
      "@type": "Country",
      name: "Philippines",
    },
    knowsAbout: [
      "Emergency veterinary care",
      "24-hour veterinary clinics",
      "After-hours pet emergency services",
      "Veterinary clinics in the Philippines",
    ],
  };
}

export function websiteJsonLd() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE_NAME,
    url: siteUrl,
    description: SITE_DESCRIPTION,
    inLanguage: "en-PH",
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function aboutPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SITE_NAME}`,
    url: canonicalUrl("/about"),
    description: `${SITE_NAME} is a free emergency veterinary clinic directory for the Philippines.`,
    inLanguage: "en-PH",
    mainEntity: { "@id": `${getSiteUrl()}/#organization` },
  };
}

export function itemListJsonLd(
  items: { name: string; url: string }[],
  listName: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function breadcrumbJsonLd(
  crumbs: { name: string; path: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}

export function faqPageJsonLd(
  faqs: { question: string; answer: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
