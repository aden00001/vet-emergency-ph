import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const CLINICS_PER_PAGE = 50;

interface AreaPaginationProps {
  areaId: string;
  page: number;
  total: number;
}

export function AreaPagination({ areaId, page, total }: AreaPaginationProps) {
  const totalPages = Math.ceil(total / CLINICS_PER_PAGE);
  if (totalPages <= 1) return null;

  const pageUrl = (nextPage: number) =>
    nextPage <= 1 ? `/areas/${areaId}` : `/areas/${areaId}?page=${nextPage}`;

  return (
    <nav
      aria-label="Clinic list pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} clinics
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={pageUrl(page - 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Previous
          </Link>
        ) : (
          <span
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "pointer-events-none opacity-50",
            })}
          >
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={pageUrl(page + 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Next
          </Link>
        ) : (
          <span
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "pointer-events-none opacity-50",
            })}
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export { CLINICS_PER_PAGE };
