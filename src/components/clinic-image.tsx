import Image from "next/image";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClinicImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  priority?: boolean;
}

export function ClinicImage({
  name,
  imageUrl,
  className,
  priority = false,
}: ClinicImageProps) {
  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/60 text-muted-foreground",
          className
        )}
        aria-hidden
      >
        <Building2 className="size-7 opacity-50 sm:size-9" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={imageUrl}
        alt={`${name} listing photo`}
        fill
        sizes="(max-width: 768px) 100vw, 400px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
