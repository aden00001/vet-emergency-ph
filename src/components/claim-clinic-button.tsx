"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ClaimClinicButtonProps {
  clinicId: string;
  clinicName: string;
}

export function ClaimClinicButton({
  clinicId,
  clinicName,
}: ClaimClinicButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleClaim() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      toast.error("Sign in first", {
        description: "Go to Admin to sign in with your clinic email.",
        action: {
          label: "Admin",
          onClick: () => (window.location.href = "/admin"),
        },
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("claim_requests").insert({
      clinic_id: clinicId,
      user_id: user.id,
      email: user.email,
      message: message || null,
    });

    if (error) {
      toast.error("Could not submit claim", { description: error.message });
    } else {
      toast.success("Claim submitted", {
        description: `We'll review your request for ${clinicName}.`,
      });
      setOpen(false);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Claim this clinic
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium">Claim {clinicName}</p>
      <Textarea
        placeholder="Tell us you're the clinic owner (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={handleClaim} disabled={loading}>
          {loading ? "Submitting…" : "Submit claim"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
