"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FRESHNESS_STYLES,
  getFreshnessLabel,
  getFreshnessLevel,
} from "@/lib/freshness";
import { VERIFICATION_LABELS } from "@/lib/status";
import type { Verification, VerificationType } from "@/types/database";
import { toast } from "sonner";

const PULSE_OPTIONS: { type: VerificationType; label: string }[] = [
  { type: "confirmed_open", label: "Confirmed Open" },
  { type: "confirmed_closed", label: "Confirmed Closed" },
  { type: "accepting_emergencies", label: "Accepting Emergencies" },
  { type: "phone_not_working", label: "Phone Not Working" },
];

interface PulseFormProps {
  clinicId: string;
  initialVerifications: Verification[];
}

export function PulseForm({ clinicId, initialVerifications }: PulseFormProps) {
  const [verifications, setVerifications] =
    useState<Verification[]>(initialVerifications);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function submitPulse(type: VerificationType) {
    setSubmitting(type);

    const res = await fetch("/api/pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, verificationType: type }),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error("Could not submit verification", {
        description: json.error ?? "Please try again",
      });
    } else if (json.verification) {
      setVerifications((prev) => [json.verification as Verification, ...prev]);
      toast.success("Thank you — verification recorded");
    }
    setSubmitting(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Emergency Pulse</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Help other pet owners by reporting what you know about this clinic.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PULSE_OPTIONS.map((option) => (
            <Button
              key={option.type}
              variant="outline"
              disabled={submitting !== null}
              onClick={() => submitPulse(option.type)}
              className="h-auto py-3 text-sm"
            >
              {submitting === option.type ? "Submitting…" : option.label}
            </Button>
          ))}
        </div>
      </div>

      {verifications.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent verifications</h4>
          <ul className="space-y-2">
            {verifications.slice(0, 10).map((v) => {
              const freshness = getFreshnessLevel(v.created_at);
              return (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span>{VERIFICATION_LABELS[v.verification_type]}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={FRESHNESS_STYLES[freshness]}>
                      {getFreshnessLabel(freshness)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(v.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
