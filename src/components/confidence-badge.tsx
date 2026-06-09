import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getConfidenceLabel, renderStars } from "@/lib/confidence";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  score,
  showLabel = true,
  className,
}: ConfidenceBadgeProps) {
  const { stars, label, description } = getConfidenceLabel(score);

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex items-center gap-1.5 text-sm cursor-default border-0 bg-transparent p-0",
          className
        )}
      >
        <span className="text-amber-500 tracking-tight" aria-hidden>
          {renderStars(stars)}
        </span>
        {showLabel && (
          <span className="text-muted-foreground text-xs">{label}</span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
        <p className="text-muted-foreground text-xs mt-1">
          Score: {score}/100
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
