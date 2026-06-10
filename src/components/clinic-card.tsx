import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CallButton } from "@/components/call-button";
import { Card } from "@/components/ui/card";
import { ClinicImage } from "@/components/clinic-image";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionsButtons } from "@/components/directions-buttons";
import { StarRating } from "@/components/star-rating";
import { formatDistance } from "@/lib/geo";
import { formatAverageRating } from "@/lib/reviews";
import { STATUS_CONFIG } from "@/lib/status";
import type { NearbyClinic } from "@/types/database";
import { BadgeCheck, MapPin, Phone } from "lucide-react";

interface ClinicCardProps {
  clinic: NearbyClinic;
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  const status = STATUS_CONFIG[clinic.current_status];

  return (
    <Card className="glass card-hover flex-row items-stretch gap-0 overflow-hidden rounded-2xl p-0">
      <ClinicImage
        name={clinic.name}
        imageUrl={clinic.image_url}
        className="hidden w-24 shrink-0 self-stretch sm:block sm:w-32"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/clinics/${clinic.id}`}
            className="font-display text-base leading-snug font-bold transition-colors hover:text-primary"
          >
            {clinic.name}
          </Link>
          {clinic.owner_verified && (
            <Badge className="shrink-0 gap-1 border-transparent bg-primary/12 text-primary">
              <BadgeCheck className="size-3.5" />
              Verified
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ConfidenceBadge score={clinic.confidence_score} />
          {(clinic.review_count ?? 0) > 0 && clinic.average_rating != null && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <StarRating value={clinic.average_rating} size="sm" />
              <span>
                {formatAverageRating(clinic.average_rating)} ({clinic.review_count})
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" />
            {formatDistance(clinic.distance_meters)} away
          </span>
        </div>

        <p className="line-clamp-1 text-sm text-muted-foreground">
          {clinic.address}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-0.5">
          <Badge
            variant="outline"
            className={`gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
          >
            {status.emoji} {status.label}
          </Badge>
          <div className="flex w-full flex-wrap gap-2">
            <CallButton
              phone={clinic.phone}
              size="sm"
              className="h-9 flex-1 min-w-[110px] gap-1.5 shadow-soft"
            >
              <Phone className="size-4" />
              Call Now
            </CallButton>
            <DirectionsButtons
              lat={clinic.latitude}
              lng={clinic.longitude}
              compact
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
