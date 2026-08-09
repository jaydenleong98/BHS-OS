/**
 * Every metric definition in BHS OS lives in this file. Nothing else computes a
 * rate, a cost, or an MRR figure — pages read from here so a definition can only
 * ever change in one place.
 *
 * The one invariant worth stating up front: any quantity with a denominator
 * returns `number | null`, never NaN and never Infinity. `null` means "undefined
 * for this data" and the formatters in lib/format.ts render it as an em-dash.
 * A zero denominator is not a zero rate, and the dashboard must not pretend it is.
 */

import {
  addDays,
  diffDays,
  eachDay,
  eachMonth,
  isWithin,
  monthKey,
  monthKeyToEnd,
  today as todayISO,
  type DateRange,
} from "./dates";
import {
  SOURCES,
  type DailyLead,
  type Deal,
  type Project,
  type Source,
} from "./types";

/** A quantity that may be undefined because its denominator was zero. */
export type Ratio = number | null;

/**
 * The only division used to compute a metric anywhere in this app.
 * Guards zero, NaN and non-finite inputs, so no metric can produce Infinity.
 * (Layout and display maths — bar widths, axis scaling, rounding — divide by
 * their own constants elsewhere, guarded at the call site.)
 */
export function safeDiv(numerator: number, denominator: number): Ratio {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export function leadsInRange(rows: DailyLead[], range: DateRange): DailyLead[] {
  return rows.filter((r) => isWithin(r.entry_date, range));
}

/** Deals are attributed to the range by close_date — the date the conversion happened. */
export function dealsClosedInRange(deals: Deal[], range: DateRange): Deal[] {
  return deals.filter((d) => isWithin(d.close_date, range));
}

export function projectsCompletedInRange(projects: Project[], range: DateRange): Project[] {
  return projects.filter((p) => p.completed_date !== null && isWithin(p.completed_date, range));
}

// ---------------------------------------------------------------------------
// Row A — Funnel
// ---------------------------------------------------------------------------

export type FunnelTotals = {
  leads: number;
  callsBooked: number;
  callsTaken: number;
  dealsClosed: number;
  spend: number;
};

export function funnelTotals(
  rows: DailyLead[],
  deals: Deal[],
  range: DateRange
): FunnelTotals {
  const scoped = leadsInRange(rows, range);
  return {
    leads: sum(scoped.map((r) => r.leads_generated)),
    callsBooked: sum(scoped.map((r) => r.calls_booked)),
    callsTaken: sum(scoped.map((r) => r.calls_taken)),
    dealsClosed: dealsClosedInRange(deals, range).length,
    spend: sum(scoped.map((r) => r.spend_myr)),
  };
}

export type ConversionRates = {
  /** calls_booked ÷ leads_generated */
  leadToBooked: Ratio;
  /** calls_taken ÷ calls_booked */
  showRate: Ratio;
  /** deals closed ÷ calls_taken */
  closeRate: Ratio;
  /** deals closed ÷ leads_generated */
  leadToClose: Ratio;
  /** spend ÷ leads_generated */
  costPerLead: Ratio;
  /** spend ÷ deals closed */
  costPerAcquisition: Ratio;
};

export function conversionRates(t: FunnelTotals): ConversionRates {
  return {
    leadToBooked: safeDiv(t.callsBooked, t.leads),
    showRate: safeDiv(t.callsTaken, t.callsBooked),
    closeRate: safeDiv(t.dealsClosed, t.callsTaken),
    leadToClose: safeDiv(t.dealsClosed, t.leads),
    costPerLead: safeDiv(t.spend, t.leads),
    costPerAcquisition: safeDiv(t.spend, t.dealsClosed),
  };
}

export type FunnelStageKey = "leads" | "booked" | "taken" | "closed";

export type FunnelStage = {
  key: FunnelStageKey;
  label: string;
  count: number;
  previousCount: number | null;
  /** Conversion from the preceding stage. Null on the first stage and on zero denominators. */
  conversion: Ratio;
  previousConversion: Ratio;
  /** Name of the transition, e.g. "Lead → Booked". Null on the first stage. */
  conversionLabel: string | null;
  /** True for the weakest transition in the funnel — the bottleneck. */
  isBottleneck: boolean;
};

export type Funnel = {
  stages: FunnelStage[];
  totals: FunnelTotals;
  previousTotals: FunnelTotals | null;
  rates: ConversionRates;
  previousRates: ConversionRates | null;
  /** Which stage transition converts worst. Null when nothing is computable yet. */
  bottleneck: FunnelStageKey | null;
};

/**
 * Builds the headline funnel.
 *
 * Bottleneck rule: the transition with the lowest conversion rate, comparing
 * lead→booked, booked→taken and taken→closed directly as the spec defines it.
 * Transitions with an undefined rate are skipped rather than treated as zero.
 */
export function buildFunnel(
  rows: DailyLead[],
  deals: Deal[],
  range: DateRange,
  previous: DateRange | null
): Funnel {
  const totals = funnelTotals(rows, deals, range);
  const rates = conversionRates(totals);
  const previousTotals = previous ? funnelTotals(rows, deals, previous) : null;
  const previousRates = previousTotals ? conversionRates(previousTotals) : null;

  const transitions: { key: FunnelStageKey; rate: Ratio }[] = [
    { key: "booked", rate: rates.leadToBooked },
    { key: "taken", rate: rates.showRate },
    { key: "closed", rate: rates.closeRate },
  ];

  let bottleneck: FunnelStageKey | null = null;
  let worst = Infinity;
  for (const t of transitions) {
    if (t.rate !== null && t.rate < worst) {
      worst = t.rate;
      bottleneck = t.key;
    }
  }

  const stages: FunnelStage[] = [
    {
      key: "leads",
      label: "Leads",
      count: totals.leads,
      previousCount: previousTotals?.leads ?? null,
      conversion: null,
      previousConversion: null,
      conversionLabel: null,
      isBottleneck: false,
    },
    {
      key: "booked",
      label: "Calls Booked",
      count: totals.callsBooked,
      previousCount: previousTotals?.callsBooked ?? null,
      conversion: rates.leadToBooked,
      previousConversion: previousRates?.leadToBooked ?? null,
      conversionLabel: "Lead → Booked",
      isBottleneck: bottleneck === "booked",
    },
    {
      key: "taken",
      label: "Calls Taken",
      count: totals.callsTaken,
      previousCount: previousTotals?.callsTaken ?? null,
      conversion: rates.showRate,
      previousConversion: previousRates?.showRate ?? null,
      conversionLabel: "Show rate",
      isBottleneck: bottleneck === "taken",
    },
    {
      key: "closed",
      label: "Closed",
      count: totals.dealsClosed,
      previousCount: previousTotals?.dealsClosed ?? null,
      conversion: rates.closeRate,
      previousConversion: previousRates?.closeRate ?? null,
      conversionLabel: "Close rate",
      isBottleneck: bottleneck === "closed",
    },
  ];

  return { stages, totals, previousTotals, rates, previousRates, bottleneck };
}

// ---------------------------------------------------------------------------
// Row B — Daily volume
// ---------------------------------------------------------------------------

export type DailyPoint = {
  date: string;
  total: number;
  rollingAverage: number | null;
} & Record<Source, number>;

/**
 * Trailing average over `window` points. Returns null until the window is full —
 * a partial average at the left edge is not a 7-day average and shouldn't be
 * drawn as one. Callers supply lead-in days so the visible line starts complete.
 */
export function rollingAverage(values: number[], window: number): (number | null)[] {
  if (window <= 0) return values.map(() => null);
  const out: (number | null)[] = [];
  let running = 0;
  for (let i = 0; i < values.length; i++) {
    running += values[i];
    if (i >= window) running -= values[i - window];
    out.push(i >= window - 1 ? running / window : null);
  }
  return out;
}

/**
 * One point per day across the full range, zero-filled — a day with no entry is
 * a real zero on the volume chart, not a gap.
 *
 * Pass `leadInRows` covering the `window - 1` days before `range.from` so the
 * rolling average is defined from the very first visible point.
 */
export function buildDailyVolume(
  rows: DailyLead[],
  range: DateRange,
  window = 7
): DailyPoint[] {
  const seriesStart = addDays(range.from, -(window - 1));
  const days = eachDay(seriesStart, range.to);

  const byDate = new Map<string, Partial<Record<Source, number>> & { total: number }>();
  for (const day of days) byDate.set(day, { total: 0 });

  for (const row of rows) {
    const bucket = byDate.get(row.entry_date);
    if (!bucket) continue;
    bucket[row.source] = (bucket[row.source] ?? 0) + row.leads_generated;
    bucket.total += row.leads_generated;
  }

  const totals = days.map((d) => byDate.get(d)?.total ?? 0);
  const averages = rollingAverage(totals, window);

  const points = days.map((date, i) => {
    const bucket = byDate.get(date)!;
    const point = { date, total: bucket.total, rollingAverage: averages[i] } as DailyPoint;
    for (const source of SOURCES) point[source] = bucket[source] ?? 0;
    return point;
  });

  // Drop the lead-in; it existed only to prime the average.
  return points.filter((p) => p.date >= range.from);
}

// ---------------------------------------------------------------------------
// Row C — Source performance
// ---------------------------------------------------------------------------

export type SourceRow = {
  source: Source;
  leads: number;
  callsBooked: number;
  callsTaken: number;
  dealsClosed: number;
  leadToBooked: Ratio;
  bookedToTaken: Ratio;
  takenToClosed: Ratio;
  spend: number;
  costPerLead: Ratio;
  costPerDeal: Ratio;
  /**
   * Contract value booked from this source in range: setup fees plus monthly
   * fees of deals closed in range. Range-scoped so it lines up with the spend
   * column sitting next to it.
   */
  revenue: number;
};

export function buildSourcePerformance(
  rows: DailyLead[],
  deals: Deal[],
  range: DateRange
): SourceRow[] {
  const scoped = leadsInRange(rows, range);
  const closed = dealsClosedInRange(deals, range);

  return SOURCES.map((source) => {
    const sourceRows = scoped.filter((r) => r.source === source);
    const sourceDeals = closed.filter((d) => d.source === source);

    const leads = sum(sourceRows.map((r) => r.leads_generated));
    const callsBooked = sum(sourceRows.map((r) => r.calls_booked));
    const callsTaken = sum(sourceRows.map((r) => r.calls_taken));
    const spend = sum(sourceRows.map((r) => r.spend_myr));
    const dealsClosed = sourceDeals.length;

    return {
      source,
      leads,
      callsBooked,
      callsTaken,
      dealsClosed,
      leadToBooked: safeDiv(callsBooked, leads),
      bookedToTaken: safeDiv(callsTaken, callsBooked),
      takenToClosed: safeDiv(dealsClosed, callsTaken),
      spend,
      costPerLead: safeDiv(spend, leads),
      costPerDeal: safeDiv(spend, dealsClosed),
      revenue: sum(sourceDeals.map((d) => d.setup_fee_myr + d.monthly_fee_myr)),
    };
  });
}

/** A source with no leads, no spend and no deals in range is noise — hide it. */
export function hasActivity(row: SourceRow): boolean {
  return row.leads > 0 || row.spend > 0 || row.dealsClosed > 0;
}

export function totalSourceRow(rows: SourceRow[]): SourceRow {
  const leads = sum(rows.map((r) => r.leads));
  const callsBooked = sum(rows.map((r) => r.callsBooked));
  const callsTaken = sum(rows.map((r) => r.callsTaken));
  const dealsClosed = sum(rows.map((r) => r.dealsClosed));
  const spend = sum(rows.map((r) => r.spend));

  return {
    source: "other",
    leads,
    callsBooked,
    callsTaken,
    dealsClosed,
    leadToBooked: safeDiv(callsBooked, leads),
    bookedToTaken: safeDiv(callsTaken, callsBooked),
    takenToClosed: safeDiv(dealsClosed, callsTaken),
    spend,
    costPerLead: safeDiv(spend, leads),
    costPerDeal: safeDiv(spend, dealsClosed),
    revenue: sum(rows.map((r) => r.revenue)),
  };
}

// ---------------------------------------------------------------------------
// Row D — Revenue
// ---------------------------------------------------------------------------

/**
 * MRR as at a given date: every deal closed on or before that date whose churn
 * has not yet happened.
 *
 * Note this keys off churn_date, not status, exactly as specified. A deal marked
 * paused without a churn_date still counts — set a churn_date to remove revenue.
 */
export function mrrAsAt(deals: Deal[], asAtISO: string): number {
  return sum(
    deals
      .filter((d) => d.close_date <= asAtISO && (d.churn_date === null || d.churn_date > asAtISO))
      .map((d) => d.monthly_fee_myr)
  );
}

/** MRR for month M, measured at the last day of M. */
export function mrrForMonth(deals: Deal[], month: string): number {
  return mrrAsAt(deals, monthKeyToEnd(month));
}

/** Σ monthly_fee for deals that closed inside month M. */
export function newMrrInMonth(deals: Deal[], month: string): number {
  return sum(deals.filter((d) => monthKey(d.close_date) === month).map((d) => d.monthly_fee_myr));
}

/** Σ monthly_fee for deals whose churn_date falls inside month M. */
export function churnedMrrInMonth(deals: Deal[], month: string): number {
  return sum(
    deals
      .filter((d) => d.churn_date !== null && monthKey(d.churn_date) === month)
      .map((d) => d.monthly_fee_myr)
  );
}

/** Σ setup_fee for deals that closed inside month M, plus MRR for M. */
export function cashCollectedInMonth(deals: Deal[], month: string): number {
  const setupFees = sum(
    deals.filter((d) => monthKey(d.close_date) === month).map((d) => d.setup_fee_myr)
  );
  return setupFees + mrrForMonth(deals, month);
}

export type MonthlyRevenuePoint = {
  month: string;
  label: string;
  mrr: number;
  newMrr: number;
  /** Stored negative so it renders below the axis on the bar chart. */
  churnedMrr: number;
  netMrrChange: number;
  setupFees: number;
  cashCollected: number;
};

export function buildMonthlyRevenue(deals: Deal[], range: DateRange): MonthlyRevenuePoint[] {
  return eachMonth(range.from, range.to).map((month) => {
    const newMrr = newMrrInMonth(deals, month);
    const churned = churnedMrrInMonth(deals, month);
    const setupFees = sum(
      deals.filter((d) => monthKey(d.close_date) === month).map((d) => d.setup_fee_myr)
    );
    return {
      month,
      label: month,
      mrr: mrrForMonth(deals, month),
      newMrr,
      churnedMrr: -churned,
      netMrrChange: newMrr - churned,
      setupFees,
      cashCollected: cashCollectedInMonth(deals, month),
    };
  });
}

export type RevenueSummary = {
  currentMrr: number;
  activeClients: number;
  /** Range-scoped: average across deals closed in the selected range. */
  averageSetupFee: Ratio;
  averageMonthlyFee: Ratio;
  /** Average revenue per account, as at today. */
  arpa: Ratio;
  dealsClosedInRange: number;
};

export function buildRevenueSummary(
  deals: Deal[],
  range: DateRange,
  asAt: string = todayISO()
): RevenueSummary {
  const closed = dealsClosedInRange(deals, range);
  const currentMrr = mrrAsAt(deals, asAt);
  const active = clientsUnderServicing(deals);

  return {
    currentMrr,
    activeClients: active,
    averageSetupFee: safeDiv(sum(closed.map((d) => d.setup_fee_myr)), closed.length),
    averageMonthlyFee: safeDiv(sum(closed.map((d) => d.monthly_fee_myr)), closed.length),
    arpa: safeDiv(currentMrr, active),
    dealsClosedInRange: closed.length,
  };
}

// ---------------------------------------------------------------------------
// Row E — Fulfilment
// ---------------------------------------------------------------------------

/** Count of deals with status = 'active'. Derived state — never typed in. */
export function clientsUnderServicing(deals: Deal[]): number {
  return deals.filter((d) => d.status === "active").length;
}

/** In flight right now: being worked on, or stuck. Not-started and completed are neither. */
export function activeProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.status === "in_progress" || p.status === "blocked");
}

/** Past target_date and still not delivered. These are the red rows. */
export function overdueProjects(projects: Project[], asAt: string = todayISO()): Project[] {
  return projects
    .filter(
      (p) =>
        p.status !== "completed" &&
        p.completed_date === null &&
        p.target_date !== null &&
        p.target_date < asAt
    )
    .sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? ""));
}

export function daysOverdue(project: Project, asAt: string = todayISO()): number | null {
  if (!project.target_date) return null;
  return diffDays(project.target_date, asAt);
}

/** mean(completed_date − start_date) over projects completed in range. */
export function averageDeliveryDays(projects: Project[], range: DateRange): Ratio {
  const completed = projectsCompletedInRange(projects, range);
  if (completed.length === 0) return null;
  const durations = completed.map((p) => diffDays(p.start_date, p.completed_date!));
  return safeDiv(sum(durations), durations.length);
}

export type FulfilmentSummary = {
  activeProjectCount: number;
  completedInRange: number;
  clientsUnderServicing: number;
  averageDeliveryDays: Ratio;
  /** active projects ÷ active clients — how much delivery each client is carrying. */
  loadPerClient: Ratio;
  overdue: Project[];
};

export function buildFulfilmentSummary(
  projects: Project[],
  deals: Deal[],
  range: DateRange,
  asAt: string = todayISO()
): FulfilmentSummary {
  const active = activeProjects(projects);
  const servicing = clientsUnderServicing(deals);

  return {
    activeProjectCount: active.length,
    completedInRange: projectsCompletedInRange(projects, range).length,
    clientsUnderServicing: servicing,
    averageDeliveryDays: averageDeliveryDays(projects, range),
    loadPerClient: safeDiv(active.length, servicing),
    overdue: overdueProjects(projects, asAt),
  };
}

export type MonthlyCompletionPoint = { month: string; completed: number };

export function buildMonthlyCompletions(
  projects: Project[],
  range: DateRange
): MonthlyCompletionPoint[] {
  const months = eachMonth(range.from, range.to);
  const counts = new Map<string, number>(months.map((m) => [m, 0]));
  for (const p of projects) {
    if (!p.completed_date) continue;
    const key = monthKey(p.completed_date);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return months.map((month) => ({ month, completed: counts.get(month) ?? 0 }));
}

// ---------------------------------------------------------------------------
// /entry — logging streak
// ---------------------------------------------------------------------------

export type LoggedDay = { date: string; logged: boolean; leads: number };

/**
 * The last `days` days ending today, flagged for whether anything was logged.
 * Gaps are the point of this — they should be visible at a glance.
 */
export function recentLoggingActivity(
  rows: DailyLead[],
  days = 7,
  asAt: string = todayISO()
): LoggedDay[] {
  const from = addDays(asAt, -(days - 1));
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.entry_date < from || row.entry_date > asAt) continue;
    const current = totals.get(row.entry_date) ?? 0;
    totals.set(
      row.entry_date,
      current + row.leads_generated + row.calls_booked + row.calls_taken + row.spend_myr
    );
  }
  return eachDay(from, asAt).map((date) => ({
    date,
    logged: totals.has(date),
    leads: totals.get(date) ?? 0,
  }));
}

/** Consecutive logged days ending today (or yesterday, if today isn't logged yet). */
export function loggingStreak(rows: DailyLead[], asAt: string = todayISO()): number {
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
