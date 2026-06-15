import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { JsonLd } from "@/components/json-ld";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClinicImage } from "@/components/clinic-image";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionsButtons } from "@/components/directions-buttons";
import { PulseForm } from "@/components/pulse-form";
import { ReviewSection } from "@/components/review-section";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { RelatedAreaClinics } from "@/components/related-area-clinics";
import { clinicPath, isClinicUuid } from "@/lib/clinic-slug";
import { fetchClinicBySlugOrId, fetchTopClinicSlugs } from "@/lib/clinics";
import { hasNavigableLocation } from "@/lib/geo";
import { parseOpeningHours } from "@/lib/opening-hours";
import { CallButton } from "@/components/call-button";
import {
  breadcrumbJsonLd,
  canonicalUrl,
  clinicPageTitle,
  pageMetadata,
  resolveClinicOgImage,
} from "@/lib/seo";
import { resolveClinicArea, regionSlug } from "@/lib/ph-regions";
import { STATUS_CONFIG } from "@/lib/status";
import type { ClinicReview, ReviewSummary, Verification } from "@/types/database";
import { BadgeCheck, Clock, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await fetchTopClinicSlugs(100);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: param } = await params;
  const { data: clinic } = await fetchClinicBySlugOrId(param);

  if (!clinic) return { title: "Clinic Not Found", robots: { index: false } };

  const path = clinicPath(clinic);
  const area = resolveClinicArea(clinic.address);
  const description = `24/7 emergency vet clinic in ${area?.label ?? "the Philippines"} — ${clinic.address}. Call before traveling. Hours, reviews, and directions on Vet247PH.`;

  return pageMetadata({
    title: clinicPageTitle(clinic.name, area?.label),
    description,
    path,
    image: resolveClinicOgImage(clinic),
  });
}

export default async function ClinicDetailPage({ params }: PageProps) {
  const { slug: param } = await params;
  const { data: clinic } = await fetchClinicBySlugOrId(param);

  if (!clinic) notFound();

  if (isClinicUuid(param) && clinic.slug) {
    permanentRedirect(clinicPath(clinic));
  }

  const id = clinic.id;
  const supabase = await createClient();

  const statusRow = Array.isArray(clinic.clinic_status)
    ? clinic.clinic_status[0]
    : clinic.clinic_status;
  const currentStatus = statusRow?.current_status ?? "accepting";
  const status = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG];

  const { data: verifications } = await supabase
    .from("verifications")
    .select("*")
    .eq("clinic_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: reviewRatings } = await supabase
    .from("clinic_reviews")
    .select("rating")
    .eq("clinic_id", id)
    .eq("status", "published");

  const ratings = reviewRatings ?? [];
  const ratingDistribution = [0, 0, 0, 0, 0];
  for (const row of ratings) {
    ratingDistribution[row.rating - 1] += 1;
  }

  const reviewSummary: ReviewSummary = {
    review_count: ratings.length,
    average_rating:
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10
          ) / 10
        : null,
  };

  const { data: reviews } = await supabase
    .from("clinic_reviews")
    .select("*")
    .eq("clinic_id", id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  const publishedReviews = (reviews ?? []) as ClinicReview[];

  const clinicUrl = canonicalUrl(clinicPath(clinic));
  const area = resolveClinicArea(clinic.address);
  const openingHours = parseOpeningHours(clinic.hours);

  const breadcrumbCrumbs = area
    ? [
        { name: "Home", path: "/" },
        { name: "Areas", path: "/areas" },
        { name: area.group, path: `/areas/region/${regionSlug(area.group)}` },
        { name: area.label, path: `/areas/${area.id}` },
        { name: clinic.name, path: clinicPath(clinic) },
      ]
    : [
        { name: "Home", path: "/" },
        { name: clinic.name, path: clinicPath(clinic) },
      ];

  const breadcrumbNav = area
    ? [
        { name: "Home", href: "/" },
        { name: "Areas", href: "/areas" },
        { name: area.group, href: `/areas/region/${regionSlug(area.group)}` },
        { name: area.label, href: `/areas/${area.id}` },
        { name: clinic.name },
      ]
    : [{ name: "Home", href: "/" }, { name: clinic.name }];

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": ["VeterinaryCare", "LocalBusiness", "EmergencyService"],
    "@id": clinicUrl,
    name: clinic.name,
    url: clinicUrl,
    image: resolveClinicOgImage(clinic),
    ...(clinic.image_url ? { photo: clinic.image_url } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address,
      addressCountry: "PH",
      ...(area ? { addressLocality: area.label } : {}),
    },
    areaServed: area
      ? { "@type": "City", name: area.label }
      : { "@type": "Country", name: "Philippines" },
    ...(hasNavigableLocation(
      clinic.latitude,
      clinic.longitude,
      clinic.location_verified ?? true
    )
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: clinic.latitude,
            longitude: clinic.longitude,
          },
        }
      : {}),
    ...(clinic.phone ? { telephone: clinic.phone } : {}),
    ...(openingHours ? { openingHoursSpecification: openingHours } : {}),
    ...(reviewSummary.review_count > 0 && reviewSummary.average_rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.average_rating,
            reviewCount: reviewSummary.review_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd data={[businessJsonLd, breadcrumbJsonLd(breadcrumbCrumbs)]} />
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 space-y-6">
        <SiteBreadcrumbs items={breadcrumbNav} />

        <Card className="glass shadow-soft overflow-hidden rounded-2xl pt-0">
          <ClinicImage
            name={clinic.name}
            imageUrl={clinic.image_url}
            className="h-40 w-full sm:h-52"
            priority
          />
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="font-display text-2xl font-extrabold">
                {clinic.name}
              </h1>
              {clinic.owner_verified && (
                <Badge className="gap-1 border-transparent bg-primary/12 text-primary">
                  <BadgeCheck className="size-3.5" />
                  Verified Partner
                </Badge>
              )}
            </div>
            <ConfidenceBadge score={clinic.confidence_score} />
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                {clinic.address}
                {area ? (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/areas/${area.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      More emergency vets in {area.label}
                    </Link>
                  </>
                ) : null}
              </span>
            </p>
            {clinic.hours && (
              <p className="flex items-center gap-2 text-sm">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{clinic.hours}</span>
              </p>
            )}
            <Badge
              variant="outline"
              className={`gap-1.5 rounded-full px-3 py-1 font-medium ${status.className}`}
            >
              {status.emoji} {status.label}
            </Badge>
            {clinic.services?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clinic.services.map((s: string) => (
                  <Badge key={s} variant="secondary" className="capitalize">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <CallButton
                phone={clinic.phone}
                size="lg"
                className="h-11 gap-2 shadow-soft"
              >
                <Phone className="size-4" />
                {clinic.phone || "No phone number"}
              </CallButton>
              <DirectionsButtons
                lat={clinic.latitude}
                lng={clinic.longitude}
                locationVerified={clinic.location_verified ?? true}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl">
          <CardContent className="pt-6">
            <PulseForm
              clinicId={id}
              initialVerifications={(verifications ?? []) as Verification[]}
            />
          </CardContent>
        </Card>

        <Card className="glass rounded-2xl">
          <CardContent className="pt-6">
            <ReviewSection
              clinicId={id}
              initialReviews={publishedReviews}
              initialSummary={reviewSummary}
              initialDistribution={ratingDistribution}
            />
          </CardContent>
        </Card>

        <RelatedAreaClinics clinicId={id} address={clinic.address} />
      </main>
    </div>
  );
}
