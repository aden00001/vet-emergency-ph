import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  { href: "/areas", label: "Areas" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 overflow-x-clip border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 min-w-0 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-soft transition-transform group-hover:scale-105">
            <HeartPulse className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            Vet247
            <span className="text-primary">PH</span>
          </span>
        </Link>
        <nav
          aria-label="Main"
          className="flex items-center gap-1 text-sm font-medium"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:inline-flex"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
