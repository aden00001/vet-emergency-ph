import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ContactEmail } from "@/components/contact-email";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `About | ${SITE_NAME}`,
  description: `About ${SITE_NAME} — trusted emergency veterinary discovery in the Philippines.`,
};

export default function AboutPage() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <h1 className="font-display text-3xl font-extrabold">
          About <span className="text-gradient-brand">{SITE_NAME}</span>
        </h1>
        <p className="text-muted-foreground">
          We help Filipino pet owners find emergency veterinary care within
          seconds — combining clinic-supplied updates, community verification,
          and automated monitoring for the most reliable emergency vet directory
          in the Philippines.
        </p>
        <p className="text-muted-foreground">
          This directory is free to use — no paywall, no clinic signup required.
          Listings are maintained and updated based on public sources and community
          reports.
        </p>
        <p className="text-muted-foreground">
          Spotted wrong hours, a bad pin, or a missing clinic? Email us at{" "}
          <ContactEmail />.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "shadow-soft" })}>
          Find emergency care
        </Link>
      </main>
    </div>
  );
}
