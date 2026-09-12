/** Row shapes as they come back from Supabase. Dates are always 'YYYY-MM-DD' strings. */

// ---------------------------------------------------------------------------
// Daily activity — the whole daily typing surface
// ---------------------------------------------------------------------------

export type DailyActivity = {
  entry_date: string;
  outreach: number;
  follow_up: number;
  meetings_booked: number;
  meetings_attended: number;
  note: string | null;
};

// ---------------------------------------------------------------------------
// Scripts — the sales script and objection-handling library
// ---------------------------------------------------------------------------

export const SCRIPT_CATEGORIES = ["script", "objection"] as const;
export type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number];

export const SCRIPT_CATEGORY_LABELS: Record<ScriptCategory, string> = {
  script: "Script",
  objection: "Objection",
};

export function isScriptCategory(value: unknown): value is ScriptCategory {
  return SCRIPT_CATEGORIES.includes(value as ScriptCategory);
}

export type ScriptEntry = {
  id: string;
  category: ScriptCategory;
  title: string;
  body: string;
  updated_at: string | null;
};

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

/**
 * Supabase returns numerics as strings in some client versions and numbers in
 * others. Normalise on read so no arithmetic ever silently concatenates.
 */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function normaliseDailyActivity(row: Record<string, unknown>): DailyActivity {
  return {
    entry_date: String(row.entry_date),
    outreach: num(row.outreach),
    follow_up: num(row.follow_up),
    meetings_booked: num(row.meetings_booked),
    meetings_attended: num(row.meetings_attended),
    note: str(row.note),
  };
}

export function normaliseScriptEntry(row: Record<string, unknown>): ScriptEntry {
  return {
    id: String(row.id ?? ""),
    category: isScriptCategory(row.category) ? row.category : "script",
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    updated_at: str(row.updated_at),
  };
}
