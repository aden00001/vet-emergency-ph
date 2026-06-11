import Link from "next/link";
import { ContactEmail } from "@/components/contact-email";
import { SITE_AUTHOR_NAME, SITE_AUTHOR_URL, SITE_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center text-xs text-muted-foreground">
        <p className="max-w-md text-balance leading-relaxed">
          {SITE_NAME} is a free informational directory. Always call a clinic before
          traveling.
        </p>

        <p className="text-balance">
          Questions, corrections, or listing updates?{" "}
          <ContactEmail showIcon={false} />
        </p>

        <p>
          Built by{" "}
          <a
            href={SITE_AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {SITE_AUTHOR_NAME}
          </a>
          .{" "}
          <Link
            href="/disclaimer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Disclaimer
          </Link>
        </p>
      </div>
    </footer>
  );
}
