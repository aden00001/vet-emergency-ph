import Link from "next/link";
import { ContactEmail } from "@/components/contact-email";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "For Clinics — Listing Updates",
  description:
    "Report listing corrections, updated hours, or missing emergency vet clinics on Vet247PH. Free directory maintained for pet owners across the Philippines.",
  path: "/for-clinics",
});

export default function ForClinicsPage() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl flex-1 space-y-6 px-4 py-12">
        <h1 className="font-display text-3xl font-extrabold">
          For veterinary clinics
        </h1>
        <p className="text-muted-foreground">
          {SITE_NAME} is a free public directory helping pet owners find
          emergency veterinary care across the Philippines. We maintain listings
          from public sources and community reports — no paywall and no signup
          required for clinics to appear.
        </p>
        <h2 className="font-display text-xl font-bold">Listing corrections</h2>
        <p className="text-muted-foreground">
          Spotted wrong hours, an incorrect phone number, a bad map pin, or a
          missing clinic? Email us with the clinic name, address, and what should
          be updated. We review corrections regularly.
        </p>
        <p className="text-muted-foreground">
          Contact: <ContactEmail />
        </p>
        <h2 className="font-display text-xl font-bold">Verified partners</h2>
        <p className="text-muted-foreground">
          Some clinics may be marked as verified partners when we have confirmed
          listing details directly. If you represent a clinic and want to verify
          your listing, reach out via email with your clinic details.
        </p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "shadow-soft" })}>
          Back to directory
        </Link>
      </main>
    </div>
  );
}
