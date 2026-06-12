import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClinicImage } from "@/components/clinic-image";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionsButtons } from "@/components/directions-buttons";
import { PulseForm } from "@/components/pulse-form";
import { ReviewSection } from "@/components/review-section";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import { formatDistance, hasNavigableLocation } from "@/lib/geo";
import { CallButton } from "@/components/call-button";
import { canonicalUrl, getSiteUrl, pageMetadata } from "@/lib/seo";
import { STATUS_CONFIG } from "@/lib/status";
import type { ClinicReview, ReviewSummary, Verification } from "@/types/database";
import { ArrowLeft, BadgeCheck, Clock, MapPin, Phone } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, address, image_url")
    .eq("id", id)
    .single();

  if (!clinic) return { title: "Clinic Not Found" };

  const path = `/clinics/${id}`;
  const description = `Emergency vet clinic in the Philippines — ${clinic.address}. Call before traveling. Hours, reviews, and directions on Vet247PH.`;

  return pageMetadata({
    title: clinic.name,
    description,
    path,
    image: clinic.image_url,
  });
}

export default async function ClinicDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "*, clinic_status(current_status, updated_at)"
    )
    .eq("id", id)
    .single();

  if (!clinic) notFound();

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

  const clinicUrl = canonicalUrl(`/clinics/${id}`);
  const siteUrl = getSiteUrl();

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": ["VeterinaryCare", "LocalBusiness", "EmergencyService"],
    "@id": clinicUrl,
    name: clinic.name,
    url: clinicUrl,
    ...(clinic.image_url ? { image: clinic.image_url } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address,
      addressCountry: "PH",
    },
    areaServed: {
      "@type": "Country",
      name: "Philippines",
    },
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
    ...(clinic.hours ? { description: `Hours: ${clinic.hours}` } : {}),
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: clinic.name,
        item: clinicUrl,
      },
    ],
  };

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd data={[businessJsonLd, breadcrumbJsonLd]} />
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 space-y-6">
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2 -ml-2" })}
        >
          <ArrowLeft className="size-4" />
          Back to search
        </Link>

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
              {clinic.address}
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
      </main>
    </div>
  );
}
