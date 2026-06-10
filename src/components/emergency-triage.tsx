"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TriageCategory } from "@/types/database";
import { AlertTriangle, Droplets, Wind } from "lucide-react";

const TRIAGE_OPTIONS: {
  id: TriageCategory;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
}[] = [
  {
    id: "trauma",
    label: "Trauma",
    description: "Accidents, wounds, broken bones",
    icon: AlertTriangle,
  },
  {
    id: "poisoning",
    label: "Poisoning",
    description: "Toxic foods, meds, chemicals",
    icon: Droplets,
  },
  {
    id: "respiratory",
    label: "Respiratory",
    description: "Breathing difficulty, choking",
    icon: Wind,
  },
];

const STORAGE_KEY = "vet247ph_triage";

interface EmergencyTriageProps {
  onSelect: (category: TriageCategory | null) => void;
  selected: TriageCategory | null;
}

export function EmergencyTriage({ onSelect, selected }: EmergencyTriageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) as TriageCategory | null;
    if (stored && !selected) {
      onSelect(stored);
    } else if (!stored && !selected) {
      setOpen(true);
    }
  }, [onSelect, selected]);

  function handleSelect(category: TriageCategory) {
    sessionStorage.setItem(STORAGE_KEY, category);
    onSelect(category);
    setOpen(false);
  }

  function handleSkip() {
    setOpen(false);
  }

  function handleClear() {
    sessionStorage.removeItem(STORAGE_KEY);
    onSelect(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {selected ? (
          <>
            <span className="text-sm font-medium">
              Emergency:{" "}
              {TRIAGE_OPTIONS.find((o) => o.id === selected)?.label}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              Change
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </>
        ) : (
          <Button onClick={() => setOpen(true)} variant="secondary">
            What type of emergency?
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Emergency Triage</DialogTitle>
            <DialogDescription>
              Select your emergency type so we can prioritize relevant clinics.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {TRIAGE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-4 text-left"
                  onClick={() => handleSelect(option.id)}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className="size-5 text-destructive" />
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-sm font-normal">
                    {option.description}
                  </span>
                </Button>
              );
            })}
            <Button variant="ghost" onClick={handleSkip}>
              Skip — show all emergency clinics
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
