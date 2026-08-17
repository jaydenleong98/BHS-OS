/**
 * Every metric definition in BHS OS lives in this file. Nothing else computes a
 * rate, a cost, or an MRR figure — pages read from here so a definition can only
 * ever change in one place.
 *
 * Two invariants worth stating up front:
 *
 *  1. Any quantity with a denominator returns `number | null`, never NaN and
 *     never Infinity. `null` means "undefined for this data" and the formatters
 *     in lib/format.ts render it as an em-dash. A zero denominator is not a zero
 *     rate, and the dashboard must not pretend it is.
 *
 *  2. Every funnel count is derived from prospect records. Nothing in this file
 *     reads a typed-in funnel aggregate, because none exists any more.
 */

import {
  addDays,
  diffDays,
  eachDay,
  eachMonth,
  eachWeek,
  isWithin,
  monthKey,
  monthKeyToEnd,
  startOfMonth,
  startOfWeek,
  today as todayISO,
  weeksUntil,
  type DateRange,
} from "./dates";
import { resolveDeadline } from "./settings";
import {
  OPEN_STAGES,
  ONBOARDING_STEPS,
  SOURCES,
  STAGE_DATE_FIELD,
  STAGE_WEIGHTS,
  STALE_CONTACT_DAYS,
  type AppSettings,
  type Client,
  type DailyActivity,
  type MonthlySpend,
  type OnboardingProgress,
  type Project,
  type Prospect,
  type ReferralAsk,
  type Source,
  type Stage,
  type WeeklyContent,
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

const mean = (values: number[]): Ratio => safeDiv(sum(values), values.length);

/** Average days across a calendar month, for turning a day count into months. */
const DAYS_PER_MONTH = 30.44;

// ---------------------------------------------------------------------------
// Prospect filtering
// ---------------------------------------------------------------------------

/** The date stamped when this prospect first reached `stage`, or null. */
export function stageDate(prospect: Prospect, stage: Stage): string | null {
  return prospect[STAGE_DATE_FIELD[stage]] as string | null;
}

/** Prospects that reached `stage` inside the range. The basis of every funnel count. */
export function reachedStageInRange(
  prospects: Prospect[],
  stage: Stage,
  range: DateRange
): Prospect[] {
  return prospects.filter((p) => {
    const date = stageDate(p, stage);
    return date !== null && isWithin(date, range);
  });
}

/** Clients are attributed to a range by close_date — the day the deal was won. */
export function clientsWonInRange(clients: Client[], range: DateRange): Client[] {
  return clients.filter((c) => isWithin(c.close_date, range));
}

export function projectsCompletedInRange(projects: Project[], range: DateRange): Project[] {
  return projects.filter((p) => p.completed_date !== null && isWithin(p.completed_date, range));
}

// ---------------------------------------------------------------------------
// Funnel — counts only
//
// No conversion percentages live on this type. At three closes a period a ratio
// between stages is noise dressed up as a measurement, so the rates are computed
// separately (below) and rendered only on the Analysis tab.
// ---------------------------------------------------------------------------

export const FUNNEL_STAGES = [
  { key: "new", label: "Outreach" },
  { key: "conversation", label: "Conversations" },
  { key: "call_booked", label: "Booked" },
  { key: "call_taken", label: "Calls taken" },
  { key: "won", label: "Closed" },
] as const satisfies readonly { key: Stage; label: string }[];

export type FunnelStage = {
  key: Stage;
  label: string;
  count: number;
  previousCount: number | null;
};

export type Funnel = {
  stages: FunnelStage[];
  /** Convenience accessors for the counts, in funnel order. */
  totals: Record<"outreach" | "conversations" | "booked" | "taken" | "closed", number>;
};

export function buildFunnel(
  prospects: Prospect[],
  range: DateRange,
  previous: DateRange | null
): Funnel {
  const stages: FunnelStage[] = FUNNEL_STAGES.map(({ key, label }) => ({
    key,
    label,
    count: reachedStageInRange(prospects, key, range).length,
    previousCount: previous ? reachedStageInRange(prospects, key, previous).length : null,
  }));

  return {
    stages,
    totals: {
      outreach: stages[0].count,
      conversations: stages[1].count,
      booked: stages[2].count,
      taken: stages[3].count,
      closed: stages[4].count,
    },
  };
}

export type ConversionRates = {
  outreachToConversation: Ratio;
  conversationToBooked: Ratio;
  showRate: Ratio;
  closeRate: Ratio;
  outreachToClose: Ratio;
};

/** Analysis tab only. Kept off the dashboard on purpose — see buildFunnel. */
export function conversionRates(funnel: Funnel): ConversionRates {
  const t = funnel.totals;
  return {
    outreachToConversation: safeDiv(t.conversations, t.outreach),
    conversationToBooked: safeDiv(t.booked, t.conversations),
    showRate: safeDiv(t.taken, t.booked),
    closeRate: safeDiv(t.closed, t.taken),
    outreachToClose: safeDiv(t.closed, t.outreach),
  };
}

// ---------------------------------------------------------------------------
// Sales cycle
// ---------------------------------------------------------------------------

/**
 * Mean days from first contact to won, over every prospect ever won.
 *
 * Deliberately not range-scoped: with a two-week-to-two-month cycle and a handful
 * of closes a year, a 30-day window would usually contain nothing to average.
 */
export function averageCycleDays(prospects: Prospect[]): Ratio {
  const durations = prospects
    .filter((p) => p.won_on !== null)
    .map((p) => diffDays(p.new_on, p.won_on!))
    .filter((d) => d >= 0);
  return mean(durations);
}

/** Weighted value of everything still open, by stage probability. */
export type PipelineValue = { weightedMonthly: number; weightedSetup: number; openCount: number };

export function weightedPipeline(prospects: Prospect[]): PipelineValue {
  const open = prospects.filter((p) => (OPEN_STAGES as readonly Stage[]).includes(p.stage));
  return {
    weightedMonthly: sum(
      open.map((p) => p.est_monthly_fee_myr * STAGE_WEIGHTS[p.stage as keyof typeof STAGE_WEIGHTS])
    ),
    weightedSetup: sum(
      open.map((p) => p.est_setup_fee_myr * STAGE_WEIGHTS[p.stage as keyof typeof STAGE_WEIGHTS])
    ),
    openCount: open.length,
  };
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/**
 * MRR as at a given date: every client won on or before that date whose churn
 * has not yet happened.
 *
 * Note this keys off churn_date, not status. A client marked paused without a
 * churn_date still counts — set a churn_date to remove revenue.
 */
export function mrrAsAt(clients: Client[], asAtISO: string): number {
  return sum(
    clients
      .filter((c) => c.close_date <= asAtISO && (c.churn_date === null || c.churn_date > asAtISO))
      .map((c) => c.monthly_fee_myr)
  );
}

/** MRR for month M, measured at the last day of M. */
export function mrrForMonth(clients: Client[], month: string): number {
  return mrrAsAt(clients, monthKeyToEnd(month));
}

/** Σ monthly_fee for clients won inside month M. */
export function newMrrInMonth(clients: Client[], month: string): number {
  return sum(clients.filter((c) => monthKey(c.close_date) === month).map((c) => c.monthly_fee_myr));
}

/** Σ monthly_fee for clients whose churn_date falls inside month M. */
export function churnedMrrInMonth(clients: Client[], month: string): number {
  return sum(
    clients
      .filter((c) => c.churn_date !== null && monthKey(c.churn_date) === month)
      .map((c) => c.monthly_fee_myr)
  );
}

/** Σ setup_fee for clients won inside month M, plus MRR for M. */
export function cashCollectedInMonth(clients: Client[], month: string): number {
  const setupFees = sum(
    clients.filter((c) => monthKey(c.close_date) === month).map((c) => c.setup_fee_myr)
  );
  return setupFees + mrrForMonth(clients, month);
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

export function buildMonthlyRevenue(clients: Client[], range: DateRange): MonthlyRevenuePoint[] {
  return eachMonth(range.from, range.to).map((month) => {
    const newMrr = newMrrInMonth(clients, month);
    const churned = churnedMrrInMonth(clients, month);
    const setupFees = sum(
      clients.filter((c) => monthKey(c.close_date) === month).map((c) => c.setup_fee_myr)
    );
    return {
      month,
      label: month,
      mrr: mrrForMonth(clients, month),
      newMrr,
      churnedMrr: -churned,
      netMrrChange: newMrr - churned,
      setupFees,
      cashCollected: cashCollectedInMonth(clients, month),
    };
  });
}

/** Count of clients with status = 'active'. Derived state — never typed in. */
export function activeClientCount(clients: Client[]): number {
  return clients.filter((c) => c.status === "active").length;
}

export type RevenueSummary = {
  currentMrr: number;
  activeClients: number;
  /** Range-scoped: average across clients won in the selected range. */
  averageSetupFee: Ratio;
  averageMonthlyFee: Ratio;
  /** Average revenue per account, as at today. */
  arpa: Ratio;
  clientsWonInRange: number;
};

export function buildRevenueSummary(
  clients: Client[],
  range: DateRange,
  asAt: string = todayISO()
): RevenueSummary {
  const won = clientsWonInRange(clients, range);
  const currentMrr = mrrAsAt(clients, asAt);
  const active = activeClientCount(clients);

  return {
    currentMrr,
    activeClients: active,
    averageSetupFee: mean(won.map((c) => c.setup_fee_myr)),
    averageMonthlyFee: mean(won.map((c) => c.monthly_fee_myr)),
    arpa: safeDiv(currentMrr, active),
    clientsWonInRange: won.length,
  };
}

// ---------------------------------------------------------------------------
// The goal gap — the reason this app exists
// ---------------------------------------------------------------------------

export type GoalGap = {
  targetMrr: number;
  currentMrr: number;
  /** Never negative: at or past target the gap is zero, not a surplus to chase. */
  gapMyr: number;
  /** True once current MRR is at or above target. */
  reached: boolean;
  /** 0..1, clamped. Null when no target is set. */
  progress: Ratio;
  /** Mean monthly fee across billing clients — the divisor for "how many closes". */
  averageMonthlyFee: Ratio;
  /** Closes needed to shut the gap at the current average fee. */
  closesNeeded: number | null;
  deadline: string;
  weeksRemaining: number;
  /** Sales cycle in days, from prospect stage dates. */
  cycleDays: Ratio;
  /** The last day a prospect can enter and still close before the deadline. */
  pipelineDeadline: string;
  weeksToFeedPipeline: number;
  requiredClosesPerMonth: Ratio;
  /** Actual close rate per month, measured over the trailing 90 days. */
  actualClosesPerMonth: Ratio;
  pace: "on_track" | "behind" | "unknown";
};

export function buildGoalGap(
  clients: Client[],
  prospects: Prospect[],
  settings: AppSettings,
  asAt: string = todayISO()
): GoalGap {
  const targetMrr = settings.target_mrr_myr;
  const currentMrr = mrrAsAt(clients, asAt);
  const gapMyr = Math.max(0, targetMrr - currentMrr);

  // Billing clients only. Churned fees are not what the next close will look like.
  const billing = clients.filter(
    (c) => c.close_date <= asAt && (c.churn_date === null || c.churn_date > asAt)
  );
  const averageMonthlyFee = mean(billing.map((c) => c.monthly_fee_myr));

  const closesNeeded =
    targetMrr <= 0 || averageMonthlyFee === null || averageMonthlyFee <= 0
      ? null
      : Math.ceil(gapMyr / averageMonthlyFee);

  const deadline = resolveDeadline(settings, asAt);
  const weeksRemaining = weeksUntil(asAt, deadline);

  const cycleDays = averageCycleDays(prospects);
  const pipelineDeadline = addDays(deadline, -Math.round(cycleDays ?? 0));
  const weeksToFeedPipeline = weeksUntil(asAt, pipelineDeadline);

  const monthsRemaining = safeDiv(Math.max(0, diffDays(asAt, deadline)), DAYS_PER_MONTH);
  const requiredClosesPerMonth =
    closesNeeded === null || monthsRemaining === null || monthsRemaining <= 0
      ? null
      : closesNeeded / monthsRemaining;

  // Trailing 90 days rather than the dashboard's range: pace is a property of the
  // business, not of whichever window happens to be selected.
  const trailing: DateRange = { from: addDays(asAt, -89), to: asAt };
  const actualClosesPerMonth = safeDiv(clientsWonInRange(clients, trailing).length, 90 / DAYS_PER_MONTH);

  let pace: GoalGap["pace"] = "unknown";
  if (targetMrr > 0 && requiredClosesPerMonth !== null && actualClosesPerMonth !== null) {
    pace = actualClosesPerMonth >= requiredClosesPerMonth ? "on_track" : "behind";
  } else if (targetMrr > 0 && gapMyr === 0) {
    pace = "on_track";
  }

  return {
    targetMrr,
    currentMrr,
    gapMyr,
    reached: targetMrr > 0 && gapMyr === 0,
    progress: targetMrr > 0 ? Math.min(1, currentMrr / targetMrr) : null,
    averageMonthlyFee,
    closesNeeded,
    deadline,
    weeksRemaining,
    cycleDays,
    pipelineDeadline,
    weeksToFeedPipeline,
    requiredClosesPerMonth,
    actualClosesPerMonth,
    pace,
  };
}

// ---------------------------------------------------------------------------
// Fulfilment and capacity
// ---------------------------------------------------------------------------

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
  return mean(completed.map((p) => diffDays(p.start_date, p.completed_date!)));
}

/**
 * mean(go_live_date − close_date) over clients that went live in range.
 *
 * Distinct from average delivery time: this is measured from the day the deal was
 * won, so it includes every day spent waiting to start.
 */
export function averageCloseToLiveDays(clients: Client[], range: DateRange): Ratio {
  const live = clients.filter((c) => c.go_live_date !== null && isWithin(c.go_live_date, range));
  return mean(live.map((c) => diffDays(c.close_date, c.go_live_date!)));
}

export type CapacityTone = "ok" | "at" | "over";

export type Capacity = {
  activeBuilds: number;
  ceiling: number;
  tone: CapacityTone;
  closeToLiveDays: Ratio;
  closeToLiveTarget: number;
  /** True when the average is worse than target — used to tint, never alone. */
  closeToLiveBehind: boolean;
  /** Mean checklist completion across active clients, 0..1. */
  onboardingCompletion: Ratio;
};

export function buildCapacity(
  projects: Project[],
  clients: Client[],
  progress: OnboardingProgress[],
  settings: AppSettings,
  range: DateRange
): Capacity {
  const activeBuilds = activeProjects(projects).length;
  const ceiling = settings.active_build_ceiling;
  const closeToLiveDays = averageCloseToLiveDays(clients, range);

  const active = clients.filter((c) => c.status === "active");
  const completions = active.map((client) => onboardingCompletion(progress, client.id));

  return {
    activeBuilds,
    ceiling,
    tone: activeBuilds > ceiling ? "over" : activeBuilds === ceiling ? "at" : "ok",
    closeToLiveDays,
    closeToLiveTarget: settings.close_to_live_target_days,
    closeToLiveBehind:
      closeToLiveDays !== null && closeToLiveDays > settings.close_to_live_target_days,
    onboardingCompletion: mean(completions),
  };
}

/** Fraction of the checklist done for one client, 0..1. */
export function onboardingCompletion(progress: OnboardingProgress[], clientId: string): number {
  const keys = new Set(ONBOARDING_STEPS.map((s) => s.key as string));
  const done = new Set(
    progress.filter((p) => p.client_id === clientId && keys.has(p.step_key)).map((p) => p.step_key)
  );
  return done.size / ONBOARDING_STEPS.length;
}

export type FulfilmentSummary = {
  activeProjectCount: number;
  completedInRange: number;
  activeClients: number;
  averageDeliveryDays: Ratio;
  /** active projects ÷ active clients — how much delivery each client is carrying. */
  loadPerClient: Ratio;
  overdue: Project[];
};

export function buildFulfilmentSummary(
  projects: Project[],
  clients: Client[],
  range: DateRange,
  asAt: string = todayISO()
): FulfilmentSummary {
  const active = activeProjects(projects);
  const servicing = activeClientCount(clients);

  return {
    activeProjectCount: active.length,
    completedInRange: projectsCompletedInRange(projects, range).length,
    activeClients: servicing,
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

/** Clients not contacted in STALE_CONTACT_DAYS. Never contacted counts as stale. */
export function staleClients(clients: Client[], asAt: string = todayISO()): Client[] {
  return clients.filter(
    (c) =>
      c.status !== "churned" &&
      (c.last_contact_on === null || diffDays(c.last_contact_on, asAt) > STALE_CONTACT_DAYS)
  );
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export type ReferralReceived = {
  prospect: Prospect;
  referrerName: string | null;
  won: boolean;
};

export type ReferralSummary = {
  asksThisMonth: number;
  asksLastMonth: number;
  /** Every referral-sourced prospect, newest first. */
  received: ReferralReceived[];
  receivedThisMonth: number;
  wonFromReferral: number;
  /** MRR right now from clients whose source is referral. */
  referredMrr: number;
  /** Setup + monthly fees ever booked from referred clients. */
  referredContractValue: number;
  /** Clients never yet asked for a referral. */
  neverAsked: Client[];
};

export function buildReferralSummary(
  clients: Client[],
  prospects: Prospect[],
  asks: ReferralAsk[],
  asAt: string = todayISO()
): ReferralSummary {
  const thisMonth = monthKey(asAt);
  const lastMonth = monthKey(addDays(startOfMonth(asAt), -1));

  const nameById = new Map(clients.map((c) => [c.id, c.client_name]));

  const referralProspects = prospects
    .filter((p) => p.source === "referral")
    .sort((a, b) => b.new_on.localeCompare(a.new_on));

  const referredClients = clients.filter((c) => c.source === "referral");
  const billing = referredClients.filter(
    (c) => c.close_date <= asAt && (c.churn_date === null || c.churn_date > asAt)
  );

  return {
    asksThisMonth: asks.filter((a) => monthKey(a.asked_on) === thisMonth).length,
    asksLastMonth: asks.filter((a) => monthKey(a.asked_on) === lastMonth).length,
    received: referralProspects.map((prospect) => ({
      prospect,
      referrerName: prospect.referred_by_client_id
        ? (nameById.get(prospect.referred_by_client_id) ?? null)
        : null,
      won: prospect.stage === "won",
    })),
    receivedThisMonth: referralProspects.filter((p) => monthKey(p.new_on) === thisMonth).length,
    wonFromReferral: referredClients.length,
    referredMrr: sum(billing.map((c) => c.monthly_fee_myr)),
    referredContractValue: sum(referredClients.map((c) => c.setup_fee_myr + c.monthly_fee_myr)),
    neverAsked: clients.filter((c) => c.status === "active" && c.referral_asked_on === null),
  };
}

// ---------------------------------------------------------------------------
// Weekly content — Vaneese's output
// ---------------------------------------------------------------------------

export type ContentWeek = {
  weekStart: string;
  contentPosted: number;
  blogPosts: number;
  /** 0..1 against the weekly target, uncapped so overshoot is visible. */
  contentProgress: Ratio;
  blogProgress: Ratio;
  logged: boolean;
};

export type ContentSummary = {
  weeks: ContentWeek[];
  current: ContentWeek;
  contentTarget: number;
  blogTarget: number;
};

export function buildContentSummary(
  rows: WeeklyContent[],
  settings: AppSettings,
  weeks = 8,
  asAt: string = todayISO()
): ContentSummary {
  const contentTarget = settings.content_target_per_week;
  const blogTarget = settings.blog_target_per_week;

  const thisMonday = startOfWeek(asAt);
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1));
  const byWeek = new Map(rows.map((r) => [r.week_start, r]));

  const build = (weekStart: string): ContentWeek => {
    const row = byWeek.get(weekStart);
    const contentPosted = row?.content_posted ?? 0;
    const blogPosts = row?.blog_posts ?? 0;
    return {
      weekStart,
      contentPosted,
      blogPosts,
      contentProgress: safeDiv(contentPosted, contentTarget),
      blogProgress: safeDiv(blogPosts, blogTarget),
      logged: row !== undefined,
    };
  };

  return {
    weeks: eachWeek(firstMonday, thisMonday).map(build),
    current: build(thisMonday),
    contentTarget,
    blogTarget,
  };
}

// ---------------------------------------------------------------------------
// Daily activity — my four numbers
// ---------------------------------------------------------------------------

export type ActivityTotals = {
  outreach: number;
  conversations: number;
  salesCalls: number;
  deepWork: number;
  daysLogged: number;
  daysInRange: number;
};

export function activityTotals(rows: DailyActivity[], range: DateRange): ActivityTotals {
  const scoped = rows.filter((r) => isWithin(r.entry_date, range));
  return {
    outreach: sum(scoped.map((r) => r.outreach)),
    conversations: sum(scoped.map((r) => r.conversations)),
    salesCalls: sum(scoped.map((r) => r.sales_calls)),
    deepWork: sum(scoped.map((r) => r.deep_work_blocks)),
    daysLogged: scoped.length,
    daysInRange: diffDays(range.from, range.to) + 1,
  };
}

export type ActivityLine = {
  key: "outreach" | "conversations" | "salesCalls" | "deepWork";
  label: string;
  total: number;
  /** Mean per logged day. Null when nothing was logged in range. */
  perLoggedDay: Ratio;
  /** Daily target, or null where the spec says to log the actual and not judge it. */
  target: number | null;
  /** perLoggedDay ÷ target, or null. */
  attainment: Ratio;
};

export function buildActivityLines(
  rows: DailyActivity[],
  range: DateRange,
  settings: AppSettings
): ActivityLine[] {
  const t = activityTotals(rows, range);
  const per = (value: number) => safeDiv(value, t.daysLogged);

  const line = (
    key: ActivityLine["key"],
    label: string,
    total: number,
    target: number | null
  ): ActivityLine => {
    const perLoggedDay = per(total);
    return {
      key,
      label,
      total,
      perLoggedDay,
      target,
      attainment: target === null || perLoggedDay === null ? null : safeDiv(perLoggedDay, target),
    };
  };

  return [
    line("outreach", "Outreach", t.outreach, settings.outreach_target_per_day),
    line("conversations", "Conversations", t.conversations, settings.conversations_target_per_day),
    line("salesCalls", "Sales calls taken", t.salesCalls, null),
    line("deepWork", "Deep work blocks", t.deepWork, settings.deep_work_target_per_day),
  ];
}

export type LoggedDay = { date: string; logged: boolean; outreach: number };

/**
 * The last `days` days ending today, flagged for whether the day was logged.
 * Gaps are the point of this — they should be visible at a glance.
 *
 * A row existing is what counts as logged. An all-zero day is a completed day.
 */
export function recentLoggingActivity(
  rows: DailyActivity[],
  days = 7,
  asAt: string = todayISO()
): LoggedDay[] {
  const from = addDays(asAt, -(days - 1));
  const byDate = new Map(rows.map((r) => [r.entry_date, r]));
  return eachDay(from, asAt).map((date) => ({
    date,
    logged: byDate.has(date),
    outreach: byDate.get(date)?.outreach ?? 0,
  }));
}

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

// ---------------------------------------------------------------------------
// Analysis tab — source performance and volume
// ---------------------------------------------------------------------------

/**
 * Spend for a range.
 *
 * Spend is entered per month, so a range that covers part of a month still counts
 * that month whole. Stated rather than pro-rated: pro-rating would invent daily
 * precision the input never had.
 */
export function spendInRange(spend: MonthlySpend[], range: DateRange, source?: Source): number {
  const months = new Set(eachMonth(range.from, range.to));
  return sum(
    spend
      .filter((s) => months.has(s.month) && (source === undefined || s.source === source))
      .map((s) => s.spend_myr)
  );
}

export type SourceRow = {
  source: Source;
  prospects: number;
  conversations: number;
  booked: number;
  taken: number;
  closed: number;
  conversationRate: Ratio;
  showRate: Ratio;
  closeRate: Ratio;
  spend: number;
  costPerProspect: Ratio;
  costPerAcquisition: Ratio;
  /** Setup + monthly fees of clients won in range, attributed by source. */
  revenue: number;
};

export function buildSourcePerformance(
  prospects: Prospect[],
  clients: Client[],
  spend: MonthlySpend[],
  range: DateRange
): SourceRow[] {
  const won = clientsWonInRange(clients, range);

  return SOURCES.map((source) => {
    const ofSource = prospects.filter((p) => p.source === source);
    const count = (stage: Stage) => reachedStageInRange(ofSource, stage, range).length;

    const added = count("new");
    const conversations = count("conversation");
    const booked = count("call_booked");
    const taken = count("call_taken");
    const closed = count("won");

    const sourceClients = won.filter((c) => c.source === source);
    const sourceSpend = spendInRange(spend, range, source);

    return {
      source,
      prospects: added,
      conversations,
      booked,
      taken,
      closed,
      conversationRate: safeDiv(conversations, added),
      showRate: safeDiv(taken, booked),
      closeRate: safeDiv(closed, taken),
      spend: sourceSpend,
      costPerProspect: safeDiv(sourceSpend, added),
      costPerAcquisition: safeDiv(sourceSpend, closed),
      revenue: sum(sourceClients.map((c) => c.setup_fee_myr + c.monthly_fee_myr)),
    };
  });
}

/** A source with nothing against it in range is noise — hide it. */
export function hasActivity(row: SourceRow): boolean {
  return row.prospects > 0 || row.spend > 0 || row.closed > 0;
}

export function totalSourceRow(rows: SourceRow[]): SourceRow {
  const prospects = sum(rows.map((r) => r.prospects));
  const conversations = sum(rows.map((r) => r.conversations));
  const booked = sum(rows.map((r) => r.booked));
  const taken = sum(rows.map((r) => r.taken));
  const closed = sum(rows.map((r) => r.closed));
  const spend = sum(rows.map((r) => r.spend));

  return {
    source: "other",
    prospects,
    conversations,
    booked,
    taken,
    closed,
    conversationRate: safeDiv(conversations, prospects),
    showRate: safeDiv(taken, booked),
    closeRate: safeDiv(closed, taken),
    spend,
    costPerProspect: safeDiv(spend, prospects),
    costPerAcquisition: safeDiv(spend, closed),
    revenue: sum(rows.map((r) => r.revenue)),
  };
}

export type MonthlyProspectPoint = { month: string; added: number; won: number };

/** Prospects entering the pipeline per month, against closes in the same month. */
export function buildMonthlyProspects(
  prospects: Prospect[],
  range: DateRange
): MonthlyProspectPoint[] {
  const months = eachMonth(range.from, range.to);
  const added = new Map<string, number>(months.map((m) => [m, 0]));
  const won = new Map<string, number>(months.map((m) => [m, 0]));

  for (const p of prospects) {
    const addedKey = monthKey(p.new_on);
    if (added.has(addedKey)) added.set(addedKey, added.get(addedKey)! + 1);
    if (p.won_on) {
      const wonKey = monthKey(p.won_on);
      if (won.has(wonKey)) won.set(wonKey, won.get(wonKey)! + 1);
    }
  }

  return months.map((month) => ({
    month,
    added: added.get(month) ?? 0,
    won: won.get(month) ?? 0,
  }));
}
