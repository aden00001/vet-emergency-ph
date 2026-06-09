import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Clinics | VetEmergency.ph",
  description: "Join the Vet-Anchor Program and manage your emergency clinic profile.",
};

export default function ForClinicsPage() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <h1 className="font-display text-3xl font-extrabold">
          For Veterinary Clinics
        </h1>
        <p className="text-muted-foreground">
          Keep your emergency availability accurate, reduce unnecessary phone
          inquiries, and gain visibility with pet owners when it matters most.
        </p>

        <Card className="glass shadow-soft rounded-2xl">
          <CardHeader>
            <CardTitle>Vet-Anchor Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Partner clinics receive:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Verified Partner badge on your listing</li>
              <li>Priority visibility in search results</li>
              <li>Passwordless admin dashboard via magic link</li>
              <li>Certified Emergency Partner badge for your website</li>
            </ul>
            <Link href="/admin" className={buttonVariants({ size: "lg", className: "shadow-soft" })}>
              Manage your clinic
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
