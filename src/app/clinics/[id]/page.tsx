import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClinicImage } from "@/components/clinic-image";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionsButtons } from "@/components/directions-buttons";
import { PulseForm } from "@/components/pulse-form";
import { ReviewSection } from "@/components/review-section";
import { SiteHeader } from "@/components/site-header";
import { ClaimClinicButton } from "@/components/claim-clinic-button";
import { createClient } from "@/lib/supabase/server";
import { formatDistance } from "@/lib/geo";
import { CallButton } from "@/components/call-button";
import { SITE_NAME } from "@/lib/brand";
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
    .select("name, address")
    .eq("id", id)
    .single();

  if (!clinic) return { title: "Clinic Not Found" };

  return {
    title: `${clinic.name} | ${SITE_NAME}`,
    description: `Emergency veterinary clinic: ${clinic.address}`,
    openGraph: {
      title: clinic.name,
      description: clinic.address,
    },
  };
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "EmergencyService"],
    name: clinic.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address,
      addressCountry: "PH",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    },
    telephone: clinic.phone,
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
              <CardTitle className="font-display text-2xl font-extrabold">
                {clinic.name}
              </CardTitle>
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
              />
            </div>
            {!clinic.claimed_by && (
              <ClaimClinicButton clinicId={clinic.id} clinicName={clinic.name} />
            )}
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
