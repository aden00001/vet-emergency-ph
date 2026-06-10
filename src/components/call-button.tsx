import { buttonVariants } from "@/components/ui/button";
import { isCallablePhone, telHref } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

interface CallButtonProps extends VariantProps<typeof buttonVariants> {
  phone: string;
  className?: string;
  children: React.ReactNode;
}

export function CallButton({ phone, size, className, children }: CallButtonProps) {
  const callable = isCallablePhone(phone);
  const classes = cn(
    buttonVariants({ size, className }),
    !callable && "pointer-events-none cursor-not-allowed opacity-50"
  );

  if (!callable) {
    return (
      <span className={classes} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <a href={telHref(phone)} className={classes}>
      {children}
    </a>
  );
}
