/**
 * Every metric definition in the Sales Hub lives in this file: totals, the
 * trend series, and the logging streak. Pages read from here so a definition
 * can only ever change in one place.
 *
 * Any quantity with a denominator returns `number | null`, never NaN and never
 * Infinity. `null` means "undefined for this data" and the formatters in
 * lib/format.ts render it as an em-dash.
 */

import { addDays, diffDays, eachDay, eachWeek, isWithin, today as todayISO, type DateRange } from "./dates";
import type { DailyActivity } from "./types";

/** A quantity that may be undefined because its denominator was zero. */
export type Ratio = number | null;

/** The only division used to compute a metric anywhere in this app. */
export function safeDiv(numerator: number, denominator: number): Ratio {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export type ActivityTotals = {
  outreach: number;
  followUp: number;
  meetingsBooked: number;
  meetingsAttended: number;
  daysLogged: number;
  daysInRange: number;
};

export function activityTotals(rows: DailyActivity[], range: DateRange): ActivityTotals {
  const scoped = rows.filter((r) => isWithin(r.entry_date, range));
  return {
    outreach: sum(scoped.map((r) => r.outreach)),
    followUp: sum(scoped.map((r) => r.follow_up)),
    meetingsBooked: sum(scoped.map((r) => r.meetings_booked)),
    meetingsAttended: sum(scoped.map((r) => r.meetings_attended)),
    daysLogged: scoped.length,
    daysInRange: diffDays(range.from, range.to) + 1,
  };
}

// ---------------------------------------------------------------------------
// Trend series — daily for a range of a month or less, weekly beyond that so
// the chart doesn't drown in points.
// ---------------------------------------------------------------------------

export type ActivityPoint = {
  key: string; // a day (YYYY-MM-DD) or a week's Monday
  outreach: number;
  followUp: number;
  meetingsBooked: number;
  meetingsAttended: number;
};

export type ActivitySeries = { bucket: "day" | "week"; points: ActivityPoint[] };

export function buildActivitySeries(rows: DailyActivity[], range: DateRange): ActivitySeries {
  const byDate = new Map(rows.map((r) => [r.entry_date, r]));

  if (diffDays(range.from, range.to) + 1 <= 31) {
    const points = eachDay(range.from, range.to).map((date) => {
      const r = byDate.get(date);
      return {
        key: date,
        outreach: r?.outreach ?? 0,
        followUp: r?.follow_up ?? 0,
        meetingsBooked: r?.meetings_booked ?? 0,
        meetingsAttended: r?.meetings_attended ?? 0,
      };
    });
    return { bucket: "day", points };
  }

  const points = eachWeek(range.from, range.to).map((weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    const inWeek = rows.filter(
      (r) => r.entry_date >= weekStart && r.entry_date <= weekEnd && isWithin(r.entry_date, range)
    );
    return {
      key: weekStart,
      outreach: sum(inWeek.map((r) => r.outreach)),
      followUp: sum(inWeek.map((r) => r.follow_up)),
      meetingsBooked: sum(inWeek.map((r) => r.meetings_booked)),
      meetingsAttended: sum(inWeek.map((r) => r.meetings_attended)),
    };
  });
  return { bucket: "week", points };
}

// ---------------------------------------------------------------------------
// Logging streak
// ---------------------------------------------------------------------------

/** Consecutive logged days ending today (or yesterday, if today isn't logged yet). */
export function loggingStreak(rows: DailyActivity[], asAt: string = todayISO()): number {
  const logged = new Set(rows.map((r) => r.entry_date));
  let cursor = logged.has(asAt) ? asAt : addDays(asAt, -1);
  let streak = 0;
  // Bounded so a corrupt date can't spin forever.
  while (logged.has(cursor) && streak < 3650) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
