import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { GENERAL_HELP_FAQS, HELP_TOPICS } from "@/lib/help-content";
import { faqPageJsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pet Emergency Help & FAQ",
  description:
    "Emergency pet care guidance for the Philippines — what to do for trauma, poisoning, and breathing emergencies, plus how to find a 24/7 vet near you.",
  path: "/help",
});

export default function HelpIndexPage() {
  const faqJsonLd = faqPageJsonLd(GENERAL_HELP_FAQS);

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd data={faqJsonLd} />
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-10">
        <SiteBreadcrumbs
          items={[{ name: "Home", href: "/" }, { name: "Help" }]}
        />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Pet emergency help
          </h1>
          <p className="text-muted-foreground">
            Quick guidance for common pet emergencies in the Philippines. This is
            not veterinary advice — always call a licensed vet for diagnosis and
            treatment.
          </p>
          <Link href="/" className={buttonVariants({ className: "shadow-soft" })}>
            Find emergency vets near me
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">Emergency guides</h2>
          <ul className="space-y-3">
            {HELP_TOPICS.map((topic) => (
              <li key={topic.slug}>
                <Link
                  href={`/help/${topic.slug}`}
                  className="block rounded-xl border border-border/70 bg-background/50 p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                >
                  <span className="font-display font-bold">{topic.title}</span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topic.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">Frequently asked questions</h2>
          <dl className="space-y-4">
            {GENERAL_HELP_FAQS.map((faq) => (
              <div key={faq.question}>
                <dt className="font-semibold">{faq.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-sm text-muted-foreground">
          Browse clinics by location on our{" "}
          <Link href="/areas" className="font-medium text-primary hover:underline">
            area pages
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
