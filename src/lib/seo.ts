import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

export const SITE_DESCRIPTION =
  "Find emergency veterinary clinics across the Philippines. Real-time directory of 24/7 and after-hours vet care in Metro Manila, Cebu, and nationwide.";

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
}: {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  noIndex?: boolean;
}): Metadata {
  const url = path ? canonicalUrl(path) : undefined;
  const ogTitle = `${title} | ${SITE_NAME}`;
  const ogImage = image ?? defaultOgImageUrl();

  return {
    title,
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
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
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
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: defaultOgImageUrl(), alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
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
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: SITE_DESCRIPTION,
    areaServed: {
      "@type": "Country",
      name: "Philippines",
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: SITE_DESCRIPTION,
    inLanguage: "en-PH",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
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
