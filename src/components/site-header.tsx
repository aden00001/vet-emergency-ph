import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  showUtilityLinks?: boolean;
}

export function SiteHeader({ showUtilityLinks = true }: SiteHeaderProps) {
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
        <nav className="flex items-center gap-0.5 text-sm font-medium">
          {showUtilityLinks && (
            <>
              <Link
                href="/for-clinics"
                className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                For Clinics
              </Link>
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Admin
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
