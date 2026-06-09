import type { ClinicStatusType } from "@/types/database";

export const STATUS_CONFIG: Record<
  ClinicStatusType,
  { label: string; emoji: string; className: string }
> = {
  accepting: {
    label: "Accepting Emergency Cases",
    emoji: "🟢",
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  limited: {
    label: "Limited Capacity",
    emoji: "🟡",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  not_accepting: {
    label: "Not Accepting Emergencies",
    emoji: "🔴",
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
  closed: {
    label: "Closed",
    emoji: "⚫",
    className: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30",
  },
};

export const VERIFICATION_LABELS: Record<string, string> = {
  confirmed_open: "Confirmed Open",
  confirmed_closed: "Confirmed Closed",
  accepting_emergencies: "Accepting Emergencies",
  phone_not_working: "Phone Number Not Working",
};
