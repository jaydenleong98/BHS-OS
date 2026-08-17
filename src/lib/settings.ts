/**
 * Targets and ceilings. One row in `app_settings`, read by every page that
 * compares an actual against a goal.
 *
 * The defaults here are the spec's defaults, not a guess at real numbers: the
 * only figure that would be a fabrication if invented — target MRR — starts at
 * zero, and the dashboard says "set a target" rather than showing a made-up gap.
 */

import { endOfYear, today } from "./dates";
import { num, type AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  target_mrr_myr: 0,
  goal_deadline: null,
  active_build_ceiling: 3,
  close_to_live_target_days: 14,
  content_target_per_week: 7,
  blog_target_per_week: 2,
  outreach_target_per_day: 10,
  conversations_target_per_day: 3,
  deep_work_target_per_day: 2,
};

const positiveInt = (value: unknown, fallback: number): number => {
  const n = Math.round(num(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function normaliseSettings(row: Record<string, unknown> | null | undefined): AppSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    target_mrr_myr: Math.max(0, num(row.target_mrr_myr)),
    goal_deadline: (row.goal_deadline as string) ?? null,
    active_build_ceiling: positiveInt(row.active_build_ceiling, DEFAULT_SETTINGS.active_build_ceiling),
    close_to_live_target_days: positiveInt(
      row.close_to_live_target_days,
      DEFAULT_SETTINGS.close_to_live_target_days
    ),
    content_target_per_week: positiveInt(
      row.content_target_per_week,
      DEFAULT_SETTINGS.content_target_per_week
    ),
    blog_target_per_week: positiveInt(row.blog_target_per_week, DEFAULT_SETTINGS.blog_target_per_week),
    outreach_target_per_day: positiveInt(
      row.outreach_target_per_day,
      DEFAULT_SETTINGS.outreach_target_per_day
    ),
    conversations_target_per_day: positiveInt(
      row.conversations_target_per_day,
      DEFAULT_SETTINGS.conversations_target_per_day
    ),
    deep_work_target_per_day: positiveInt(
      row.deep_work_target_per_day,
      DEFAULT_SETTINGS.deep_work_target_per_day
    ),
  };
}

/** The goal date: whatever is configured, else 31 Dec of the current year. */
export function resolveDeadline(settings: AppSettings, asAt: string = today()): string {
  return settings.goal_deadline ?? endOfYear(asAt);
}

/** Reads the single settings row. Falls back to defaults rather than throwing. */
export async function loadSettings(
  supabase: { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", "singleton").maybeSingle();
  return normaliseSettings(data as Record<string, unknown> | null);
}
