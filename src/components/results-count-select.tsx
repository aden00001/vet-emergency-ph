"use client";

import { ListFilter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const RESULTS_COUNT_OPTIONS = [10, 20, 50] as const;

export type ResultsCountOption = (typeof RESULTS_COUNT_OPTIONS)[number];

interface ResultsCountSelectProps {
  value: ResultsCountOption;
  onChange: (value: ResultsCountOption) => void;
  disabled?: boolean;
}

export function ResultsCountSelect({
  value,
  onChange,
  disabled,
}: ResultsCountSelectProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v) as ResultsCountOption)}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="h-8 w-full min-w-0 max-w-full rounded-full text-xs sm:w-fit sm:min-w-[110px]">
          <SelectValue placeholder="Show" />
        </SelectTrigger>
        <SelectContent align="end">
          {RESULTS_COUNT_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              Show {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
