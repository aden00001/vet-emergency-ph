import Link from "next/link";
import { ContactEmail } from "@/components/contact-email";
import { SITE_AUTHOR_NAME, SITE_AUTHOR_URL, SITE_NAME } from "@/lib/brand";
import { fetchAreaGroups, getTopAreas } from "@/lib/clinic-areas";

export async function SiteFooter() {
  let topAreas: { id: string; label: string }[] = [];

  try {
    const groups = await fetchAreaGroups();
    topAreas = getTopAreas(groups, 8).map((a) => ({
      id: a.id,
      label: a.label,
    }));
  } catch {
    // Footer still renders without area links
  }

  return (
    <footer className="mt-auto border-t border-border/60 bg-background/50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center text-xs text-muted-foreground">
        <p className="max-w-md text-balance leading-relaxed">
          {SITE_NAME} is a free informational directory. Always call a clinic before
          traveling.
        </p>

        {topAreas.length > 0 && (
          <nav aria-label="Popular areas" className="w-full max-w-lg">
            <p className="mb-2 font-semibold text-foreground">Popular areas</p>
            <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              {topAreas.map((area) => (
                <li key={area.id}>
                  <Link
                    href={`/areas/${area.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {area.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/areas"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  All areas
                </Link>
              </li>
            </ul>
          </nav>
        )}

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
            href="/about"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            About
          </Link>
          {" · "}
          <Link
            href="/help"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Help
          </Link>
          {" · "}
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
