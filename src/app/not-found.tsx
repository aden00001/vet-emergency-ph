import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Page Not Found",
  description: "The page you requested could not be found on Vet247PH.",
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="app-backdrop flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="font-display text-4xl font-extrabold">404</h1>
        <p className="text-muted-foreground">
          This page could not be found. Try searching for emergency vets from the
          homepage or browse by area.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ className: "shadow-soft" })}>
            Find emergency care
          </Link>
          <Link href="/areas" className={buttonVariants({ variant: "outline" })}>
            Browse areas
          </Link>
          <Link href="/help" className={buttonVariants({ variant: "outline" })}>
            Emergency help
          </Link>
        </div>
      </main>
    </div>
  );
}
