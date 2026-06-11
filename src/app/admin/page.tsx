"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/client";
import { STATUS_CONFIG } from "@/lib/status";
import type { ClinicStatusType } from "@/types/database";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

interface OwnedClinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string | null;
  services: string[];
  clinic_status: { current_status: ClinicStatusType }[] | null;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [clinics, setClinics] = useState<OwnedClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingLink, setSendingLink] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const { data } = await supabase
          .from("clinics")
          .select("id, name, address, phone, hours, services, clinic_status(current_status)")
          .eq("claimed_by", authUser.id);
        setClinics((data ?? []) as OwnedClinic[]);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setSendingLink(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    });
    if (error) {
      toast.error("Could not send magic link", { description: error.message });
    } else {
      toast.success("Check your email for the sign-in link");
    }
    setSendingLink(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setClinics([]);
  }

  async function updateStatus(clinicId: string, status: ClinicStatusType) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { error } = await supabase.from("clinic_status").upsert(
      {
        clinic_id: clinicId,
        current_status: status,
        updated_by: authUser.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" }
    );

    if (error) {
      toast.error("Could not update status", { description: error.message });
    } else {
      toast.success("Status updated");
      setClinics((prev) =>
        prev.map((c) =>
          c.id === clinicId
            ? { ...c, clinic_status: [{ current_status: status }] }
            : c
        )
      );
    }
  }

  async function updateClinic(
    clinicId: string,
    updates: Partial<Pick<OwnedClinic, "phone" | "hours" | "address">>
  ) {
    const { error } = await supabase
      .from("clinics")
      .update(updates)
      .eq("id", clinicId);

    if (error) {
      toast.error("Could not update clinic", { description: error.message });
    } else {
      toast.success("Clinic updated");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Clinic Admin</h1>
          <p className="text-muted-foreground text-sm">
            Owner tools (not linked in the public site).{" "}
            <Link href="/admin/merge" className="text-primary hover:underline">
              Merge clinic JSON
            </Link>
          </p>
        </div>

        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in with magic link</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={sendMagicLink} className="space-y-4">
                <div>
                  <Label htmlFor="email">Clinic email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourclinic.ph"
                  />
                </div>
                <Button type="submit" disabled={sendingLink}>
                  {sendingLink ? "Sending…" : "Send magic link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Signed in as <strong>{user.email}</strong>
              </p>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>

            {clinics.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  No clinics linked to this account. Assign <code>claimed_by</code> in
                  Supabase or use the merge import tools.
                </CardContent>
              </Card>
            ) : (
              clinics.map((clinic) => {
                const status =
                  clinic.clinic_status?.[0]?.current_status ?? "accepting";
                return (
                  <ClinicAdminCard
                    key={clinic.id}
                    clinic={clinic}
                    status={status}
                    onStatusChange={(s) => updateStatus(clinic.id, s)}
                    onUpdate={(u) => updateClinic(clinic.id, u)}
                  />
                );
              })
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ClinicAdminCard({
  clinic,
  status,
  onStatusChange,
  onUpdate,
}: {
  clinic: OwnedClinic;
  status: ClinicStatusType;
  onStatusChange: (s: ClinicStatusType) => void;
  onUpdate: (u: Partial<Pick<OwnedClinic, "phone" | "hours" | "address">>) => void;
}) {
  const [phone, setPhone] = useState(clinic.phone);
  const [hours, setHours] = useState(clinic.hours ?? "");
  const [address, setAddress] = useState(clinic.address);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{clinic.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Emergency status</Label>
          <Select
            value={status}
            onValueChange={(v) => onStatusChange(v as ClinicStatusType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_CONFIG) as ClinicStatusType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_CONFIG[key].emoji} {STATUS_CONFIG[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <Label>Hours</Label>
          <Input value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <Button
          onClick={() => onUpdate({ phone, hours, address })}
        >
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
