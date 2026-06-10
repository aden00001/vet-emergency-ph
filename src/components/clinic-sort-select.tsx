"use client";

import { ArrowDownUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLINIC_SORT_OPTIONS,
  type ClinicSortOption,
} from "@/lib/clinic-sort";

interface ClinicSortSelectProps {
  value: ClinicSortOption;
  onChange: (value: ClinicSortOption) => void;
  disabled?: boolean;
}

export function ClinicSortSelect({
  value,
  onChange,
  disabled,
}: ClinicSortSelectProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ClinicSortOption)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="h-8 w-full min-w-0 max-w-full rounded-full text-xs sm:w-fit sm:min-w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent align="end">
          {CLINIC_SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
