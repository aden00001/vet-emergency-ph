import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { SiteBreadcrumbs } from "@/components/site-breadcrumbs";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getHelpTopic, HELP_TOPICS } from "@/lib/help-content";
import { breadcrumbJsonLd, faqPageJsonLd, howToJsonLd, pageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return HELP_TOPICS.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = getHelpTopic(slug);
  if (!topic) return { title: "Help Not Found", robots: { index: false } };

  return pageMetadata({
    title: topic.title,
    description: topic.description,
    path: `/help/${slug}`,
  });
}

export default async function HelpTopicPage({ params }: PageProps) {
  const { slug } = await params;
  const topic = getHelpTopic(slug);
  if (!topic) notFound();

  const path = `/help/${slug}`;

  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Help", path: "/help" },
            { name: topic.title, path },
          ]),
          howToJsonLd({
            name: topic.title,
            description: topic.description,
            steps: topic.steps,
          }),
          faqPageJsonLd(topic.faqs),
        ]}
      />
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-10">
        <SiteBreadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Help", href: "/help" },
            { name: topic.title },
          ]}
        />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {topic.title}
          </h1>
          <p className="text-muted-foreground">{topic.intro}</p>
        </div>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">What to do now</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            {topic.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Common questions</h2>
          <dl className="space-y-4">
            {topic.faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="font-semibold">{faq.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/" className={buttonVariants({ className: "shadow-soft" })}>
            Find emergency vets near me
          </Link>
          <Link
            href="/areas"
            className={buttonVariants({ variant: "outline" })}
          >
            Browse by area
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          This page is for general information only and does not replace
          professional veterinary care. See our{" "}
          <Link href="/disclaimer" className="text-primary hover:underline">
            disclaimer
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
