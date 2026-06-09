import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | VetEmergency.ph",
  description: "About VetEmergency.ph — trusted emergency veterinary discovery in the Philippines.",
};

export default function AboutPage() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <h1 className="font-display text-3xl font-extrabold">
          About <span className="text-gradient-brand">VetEmergency.ph</span>
        </h1>
        <p className="text-muted-foreground">
          We help Filipino pet owners find emergency veterinary care within
          seconds — combining clinic-supplied updates, community verification,
          and automated monitoring for the most reliable emergency vet directory
          in the Philippines.
        </p>
        <p className="text-muted-foreground">
          Our north star is the Emergency Match Success Rate: the percentage of
          users who successfully connect with a clinic capable of handling their
          emergency.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "shadow-soft" })}>
          Find emergency care
        </Link>
      </main>
    </div>
  );
}
