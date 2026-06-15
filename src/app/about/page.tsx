import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { ContactEmail } from "@/components/contact-email";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/brand";
import { aboutPageJsonLd, faqPageJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About",
  description: `${SITE_NAME} is a free emergency veterinary clinic directory for the Philippines — 2,400+ listings with hours, phone numbers, and area browse pages.`,
  path: "/about",
});

const DIRECTORY_FACTS = [
  {
    question: "What is Vet247PH?",
    answer: `${SITE_NAME} is a free public directory that helps pet owners in the Philippines find emergency-capable veterinary clinics. It lists clinic names, addresses, phone numbers, hours, and map links. It does not provide veterinary diagnosis or treatment.`,
  },
  {
    question: "Who should use Vet247PH?",
    answer:
      "Pet owners searching for a 24/7 or after-hours emergency vet in Metro Manila, Cebu, Davao, or other Philippine cities. Users should always call the clinic before traveling to confirm they are open and can accept emergencies.",
  },
  {
    question: "How are clinics listed?",
    answer:
      "Listings are compiled from public sources and community reports. Clinics can request corrections via email. The directory is free — no paywall and no clinic signup required to appear.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd
        data={[
          aboutPageJsonLd(),
          faqPageJsonLd(
            DIRECTORY_FACTS.map((fact) => ({
              question: fact.question,
              answer: fact.answer,
            }))
          ),
        ]}
      />
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

        <section className="space-y-4" aria-labelledby="directory-facts">
          <h2 id="directory-facts" className="font-display text-xl font-bold">
            Directory facts
          </h2>
          <dl className="space-y-4">
            {DIRECTORY_FACTS.map((fact) => (
              <div key={fact.question}>
                <dt className="font-semibold">{fact.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{fact.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

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
