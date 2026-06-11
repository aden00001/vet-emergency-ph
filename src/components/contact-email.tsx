import { Mail } from "lucide-react";
import { SITE_CONTACT_EMAIL } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface ContactEmailProps {
  className?: string;
  showIcon?: boolean;
}

export function ContactEmail({ className, showIcon = true }: ContactEmailProps) {
  return (
    <a
      href={`mailto:${SITE_CONTACT_EMAIL}`}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline",
        className
      )}
    >
      {showIcon ? <Mail className="size-3.5 shrink-0" aria-hidden /> : null}
      {SITE_CONTACT_EMAIL}
    </a>
  );
}
