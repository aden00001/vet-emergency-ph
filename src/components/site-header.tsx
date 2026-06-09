import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground shadow-soft transition-transform group-hover:scale-105">
            <HeartPulse className="size-5" />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">
            VetEmergency
            <span className="text-primary">.ph</span>
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm font-medium">
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
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
