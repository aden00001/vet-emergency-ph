export interface OpeningHoursSpec {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DAY_ALIASES: Record<string, (typeof DAYS)[number]> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function normalizeHoursText(hours: string): string {
  return hours
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimeTo24h(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (text === "midnight" || text === "12 am") return "00:00";
  if (text === "noon" || text === "12 pm") return "12:00";

  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toLowerCase();

  if (hour === 12) hour = 0;
  if (meridiem === "pm") hour += 12;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(value: string): { opens: string; closes: string } | null {
  const text = value.trim();
  if (/^closed$/i.test(text)) return null;
  if (/open\s*24\s*hours?|24\s*\/?\s*7|24\s*hours?/i.test(text)) {
    return { opens: "00:00", closes: "23:59" };
  }

  const rangeMatch = text.match(/^(.+?)\s+(?:to|-)\s+(.+)$/i);
  if (!rangeMatch) return null;

  let openPart = rangeMatch[1].trim();
  const closePart = rangeMatch[2].trim();
  const closeMeridiem = closePart.match(/(am|pm)/i)?.[1];
  if (closeMeridiem && !/(am|pm)/i.test(openPart)) {
    openPart = `${openPart} ${closeMeridiem}`;
  }

  const opens = parseTimeTo24h(openPart);
  const closes = parseTimeTo24h(closePart);
  if (!opens || !closes) return null;

  return { opens, closes };
}

function parseDaySegments(hours: string): Map<string, { opens: string; closes: string }> {
  const result = new Map<string, { opens: string; closes: string }>();

  if (/open\s*24\s*hours?|24\s*\/?\s*7|^24\s*hours?$/i.test(hours)) {
    for (const day of DAYS) {
      result.set(day, { opens: "00:00", closes: "23:59" });
    }
    return result;
  }

  const segments = hours.split(";").map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const colon = segment.indexOf(":");
    if (colon === -1) continue;

    const dayKey = segment.slice(0, colon).trim().toLowerCase();
    const day = DAY_ALIASES[dayKey];
    if (!day) continue;

    const value = segment.slice(colon + 1).trim();
    const firstRange = value.split(",")[0]?.trim() ?? value;
    const range = parseTimeRange(firstRange);
    if (range) result.set(day, range);
  }

  return result;
}

function groupByHours(
  dayHours: Map<string, { opens: string; closes: string }>
): OpeningHoursSpec[] {
  const groups = new Map<string, string[]>();

  for (const day of DAYS) {
    const range = dayHours.get(day);
    if (!range) continue;
    const key = `${range.opens}-${range.closes}`;
    const existing = groups.get(key) ?? [];
    existing.push(day);
    groups.set(key, existing);
  }

  return [...groups.entries()].map(([key, dayOfWeek]) => {
    const [opens, closes] = key.split("-");
    return {
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek,
      opens,
      closes,
    };
  });
}

/** Best-effort parser for Google-style hours strings into schema.org specs. */
export function parseOpeningHours(
  hours: string | null | undefined
): OpeningHoursSpec[] | null {
  if (!hours?.trim()) return null;

  const normalized = normalizeHoursText(hours);
  const dayHours = parseDaySegments(normalized);
  if (dayHours.size === 0) return null;

  const specs = groupByHours(dayHours);
  return specs.length > 0 ? specs : null;
}

export function is24HourHours(hours: string | null | undefined): boolean {
  if (!hours) return false;
  const normalized = normalizeHoursText(hours);
  if (/open\s*24\s*hours?|24\s*\/?\s*7|^24\s*hours?$/i.test(normalized)) {
    return true;
  }
  const dayHours = parseDaySegments(normalized);
  return (
    dayHours.size === 7 &&
    [...dayHours.values()].every(
      (r) => r.opens === "00:00" && r.closes === "23:59"
    )
  );
}
