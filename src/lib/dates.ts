/**
 * Date helpers. Two rules hold everywhere in this app:
 *
 *  1. A date is a 'YYYY-MM-DD' string. Arithmetic happens on UTC-midnight Date
 *     objects so a timezone offset can never shift a day boundary.
 *  2. "Today" means today in Kuala Lumpur, not on the server. Vercel runs UTC;
 *     without this, anything logged after 8am MYT would land on the wrong date.
 */

export const TIMEZONE = "Asia/Kuala_Lumpur";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Kuala Lumpur, as 'YYYY-MM-DD'. */
export function today(): string {
  return isoFormatter.format(new Date());
}

/** 'YYYY-MM-DD' -> Date at UTC midnight. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISO(d);
}

/** Inclusive day count between two dates: diffDays('2026-01-01','2026-01-01') === 0. */
export function diffDays(fromISO: string, toISOStr: string): number {
  return Math.round((parseISO(toISOStr).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}

/** Week starts Monday. */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0 ... Sun = 6
  return addDays(iso, -dow);
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

export function endOfMonth(iso: string): string {
  const d = parseISO(startOfMonth(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISO(d);
}

export function startOfQuarter(iso: string): string {
  const d = parseISO(iso);
  const q = Math.floor(d.getUTCMonth() / 3);
  return `${d.getUTCFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`;
}

export function startOfYear(iso: string): string {
  return iso.slice(0, 4) + "-01-01";
}

export function endOfYear(iso: string): string {
  return iso.slice(0, 4) + "-12-31";
}

/**
 * Whole weeks from one date to another, floored and never negative.
 * A deadline four days out is "0 weeks left", which is the honest read.
 */
export function weeksUntil(fromISO: string, toISOStr: string): number {
  return Math.max(0, Math.floor(diffDays(fromISO, toISOStr) / 7));
}

/** Every Monday from the week containing `from` to the week containing `to`. */
export function eachWeek(fromISO: string, toISOStr: string): string[] {
  const out: string[] = [];
  let cursor = startOfWeek(fromISO);
  const last = startOfWeek(toISOStr);
  // Hard stop guards against an inverted range producing an unbounded loop.
  while (cursor <= last && out.length < 520) {
    out.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return out;
}

/** 'YYYY-MM' bucket key, used for every monthly rollup. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthKeyToEnd(key: string): string {
  return endOfMonth(key + "-01");
}

export function monthKeyToStart(key: string): string {
  return key + "-01";
}

/** Every date from -> to inclusive. */
export function eachDay(fromISO: string, toISOStr: string): string[] {
  const out: string[] = [];
  const total = diffDays(fromISO, toISOStr);
  for (let i = 0; i <= total; i++) out.push(addDays(fromISO, i));
  return out;
}

/** Every 'YYYY-MM' month key touched by the range, inclusive. */
export function eachMonth(fromISO: string, toISOStr: string): string[] {
  const out: string[] = [];
  let cursor = startOfMonth(fromISO);
  const last = startOfMonth(toISOStr);
  // Hard stop guards against an inverted range producing an unbounded loop.
  while (cursor <= last && out.length < 600) {
    out.push(monthKey(cursor));
    cursor = addMonths(cursor, 1);
  }
  return out;
}

// --- display ---------------------------------------------------------------

/** DD/MM/YYYY — the only date format shown in this app. */
export function formatDMY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Compact axis label: "09/08". */
export function formatDM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 2026" from a 'YYYY-MM' key. */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

/** "Aug '26" — for crowded chart axes. */
export function formatMonthKeyShort(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} '${y.slice(2)}`;
}

/** "w/c 18/08" — a week identified by its Monday. */
export function formatWeekOf(mondayISO: string): string {
  return `w/c ${formatDM(mondayISO)}`;
}

// --- ranges ----------------------------------------------------------------

export const RANGE_PRESETS = ["7d", "30d", "90d", "qtd", "ytd", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  qtd: "QTD",
  ytd: "YTD",
  custom: "Custom",
};

export type DateRange = { from: string; to: string };

/** Resolve a preset into concrete dates. `to` is always today unless custom. */
export function resolveRange(
  preset: RangePreset,
  custom?: Partial<DateRange>,
  anchor: string = today()
): DateRange {
  switch (preset) {
    case "7d":
      return { from: addDays(anchor, -6), to: anchor };
    case "30d":
      return { from: addDays(anchor, -29), to: anchor };
    case "90d":
      return { from: addDays(anchor, -89), to: anchor };
    case "qtd":
      return { from: startOfQuarter(anchor), to: anchor };
    case "ytd":
      return { from: startOfYear(anchor), to: anchor };
    case "custom": {
      const from = custom?.from || addDays(anchor, -29);
      const to = custom?.to || anchor;
      // Tolerate a backwards custom range rather than rendering an empty dashboard.
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/**
 * The equivalent window immediately before `range`, same length.
 * Used for every "vs previous period" delta.
 */
export function previousRange(range: DateRange): DateRange {
  const span = diffDays(range.from, range.to); // 0-indexed length
  const prevTo = addDays(range.from, -1);
  return { from: addDays(prevTo, -span), to: prevTo };
}

export function isWithin(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to;
}

export function describeRange(range: DateRange): string {
  return `${formatDMY(range.from)} – ${formatDMY(range.to)}`;
}
