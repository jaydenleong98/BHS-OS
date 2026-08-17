/** Row shapes as they come back from Supabase. Dates are always 'YYYY-MM-DD' strings. */

// ---------------------------------------------------------------------------
// Sources — an attribute of a prospect, never of a day
// ---------------------------------------------------------------------------

export const SOURCES = [
  "xhs",
  "facebook",
  "instagram",
  "tiktok",
  "blog",
  "website",
  "referral",
  "cold",
  "networking",
  "other",
] as const;

export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  xhs: "XHS",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  blog: "Blog",
  website: "Website",
  referral: "Referral",
  cold: "Cold",
  networking: "Networking",
  other: "Other",
};

export function isSource(value: unknown): value is Source {
  return SOURCES.includes(value as Source);
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export const STAGES = [
  "new",
  "conversation",
  "call_booked",
  "call_taken",
  "proposal",
  "won",
  "lost",
] as const;

export type Stage = (typeof STAGES)[number];

/** The stages a prospect can sit in while still live. Won and lost are terminal. */
export const OPEN_STAGES = [
  "new",
  "conversation",
  "call_booked",
  "call_taken",
  "proposal",
] as const satisfies readonly Stage[];

export type OpenStage = (typeof OPEN_STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: "New",
  conversation: "In conversation",
  call_booked: "Call booked",
  call_taken: "Call taken",
  proposal: "Proposal out",
  won: "Won",
  lost: "Lost",
};

/** Short form, for pipeline column headers and buttons. */
export const STAGE_SHORT: Record<Stage, string> = {
  new: "New",
  conversation: "Conversation",
  call_booked: "Booked",
  call_taken: "Taken",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

/**
 * The date column stamped when a prospect first reaches each stage.
 * Every funnel count in the app is "rows whose column here falls in range".
 */
export const STAGE_DATE_FIELD = {
  new: "new_on",
  conversation: "conversation_on",
  call_booked: "booked_on",
  call_taken: "taken_on",
  proposal: "proposal_on",
  won: "won_on",
  lost: "lost_on",
} as const satisfies Record<Stage, keyof Prospect>;

export type StageDateField = (typeof STAGE_DATE_FIELD)[Stage];

/**
 * Probability weights for the weighted pipeline figure.
 *
 * Deliberately coarse. At 6–8 closes a year there is no sample to fit these to,
 * so they are a stated assumption, not a measurement — the pipeline page says so.
 */
export const STAGE_WEIGHTS: Record<OpenStage, number> = {
  new: 0.05,
  conversation: 0.1,
  call_booked: 0.25,
  call_taken: 0.4,
  proposal: 0.6,
};

export function isStage(value: unknown): value is Stage {
  return STAGES.includes(value as Stage);
}

export function isOpenStage(stage: Stage): stage is OpenStage {
  return (OPEN_STAGES as readonly Stage[]).includes(stage);
}

/** The stage after this one, or null at the end of the open pipeline. */
export function nextStage(stage: Stage): Stage | null {
  const index = (OPEN_STAGES as readonly Stage[]).indexOf(stage);
  if (index === -1) return null;
  return index === OPEN_STAGES.length - 1 ? "won" : OPEN_STAGES[index + 1];
}

// ---------------------------------------------------------------------------
// Clients and projects
// ---------------------------------------------------------------------------

export const TIERS = ["growth", "professional", "enterprise", "custom"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
  custom: "Custom",
};

export const CLIENT_STATUSES = ["active", "paused", "churned"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const PROJECT_STATUSES = ["not_started", "in_progress", "blocked", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

/**
 * The onboarding checklist. Lives in code so adding a step needs no migration —
 * `onboarding_progress` only ever records which of these keys is done.
 */
export const ONBOARDING_STEPS = [
  { key: "kickoff", label: "Kickoff call held" },
  { key: "access", label: "Accounts & access granted" },
  { key: "crm", label: "CRM and pipeline built" },
  { key: "automations", label: "Automations live" },
  { key: "data", label: "Existing data migrated" },
  { key: "training", label: "Team training done" },
  { key: "handover", label: "Handover doc sent" },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

/** A client goes stale after this long without meaningful contact. */
export const STALE_CONTACT_DAYS = 30;

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type Prospect = {
  id: string;
  name: string;
  source: Source;
  referred_by_client_id: string | null;
  stage: Stage;
  new_on: string;
  conversation_on: string | null;
  booked_on: string | null;
  taken_on: string | null;
  proposal_on: string | null;
  won_on: string | null;
  lost_on: string | null;
  est_setup_fee_myr: number;
  est_monthly_fee_myr: number;
  lost_reason: string | null;
  notes: string | null;
  client_id: string | null;
};

/**
 * A won client. Stored in the `deals` table for history's sake — the row is the
 * client record, created automatically when a prospect is marked won.
 */
export type Client = {
  id: string;
  client_name: string;
  /** The day the deal was won. Every revenue figure is attributed by this. */
  close_date: string;
  source: Source;
  tier: Tier | null;
  setup_fee_myr: number;
  monthly_fee_myr: number;
  status: ClientStatus;
  churn_date: string | null;
  notes: string | null;
  go_live_date: string | null;
  delivery_pain: number | null;
  delivery_pain_updated_on: string | null;
  last_contact_on: string | null;
  referral_asked_on: string | null;
  billing_terms_confirmed: boolean;
  billing_terms_confirmed_on: string | null;
};

export type Project = {
  id: string;
  deal_id: string | null;
  project_name: string;
  start_date: string;
  target_date: string | null;
  completed_date: string | null;
  status: ProjectStatus;
  notes: string | null;
};

export type DailyActivity = {
  entry_date: string;
  outreach: number;
  conversations: number;
  sales_calls: number;
  deep_work_blocks: number;
  note: string | null;
};

export type WeeklyContent = {
  week_start: string;
  content_posted: number;
  blog_posts: number;
  note: string | null;
};

export type MonthlySpend = {
  month: string;
  source: Source;
  spend_myr: number;
};

export type ReferralAsk = {
  id: string;
  asked_on: string;
  client_id: string | null;
  notes: string | null;
};

export type OnboardingProgress = {
  client_id: string;
  step_key: string;
  done_on: string;
};

export type AppSettings = {
  target_mrr_myr: number;
  /** Null means "31 Dec of the current year", resolved at read time. */
  goal_deadline: string | null;
  active_build_ceiling: number;
  close_to_live_target_days: number;
  content_target_per_week: number;
  blog_target_per_week: number;
  outreach_target_per_day: number;
  conversations_target_per_day: number;
  deep_work_target_per_day: number;
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

export function normaliseProspect(row: Record<string, unknown>): Prospect {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    source: (isSource(row.source) ? row.source : "other") as Source,
    referred_by_client_id: str(row.referred_by_client_id),
    stage: (isStage(row.stage) ? row.stage : "new") as Stage,
    new_on: String(row.new_on),
    conversation_on: str(row.conversation_on),
    booked_on: str(row.booked_on),
    taken_on: str(row.taken_on),
    proposal_on: str(row.proposal_on),
    won_on: str(row.won_on),
    lost_on: str(row.lost_on),
    est_setup_fee_myr: num(row.est_setup_fee_myr),
    est_monthly_fee_myr: num(row.est_monthly_fee_myr),
    lost_reason: str(row.lost_reason),
    notes: str(row.notes),
    client_id: str(row.client_id),
  };
}

export function normaliseClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id ?? ""),
    client_name: String(row.client_name ?? ""),
    close_date: String(row.close_date),
    source: (isSource(row.source) ? row.source : "other") as Source,
    tier: (row.tier as Tier) ?? null,
    setup_fee_myr: num(row.setup_fee_myr),
    monthly_fee_myr: num(row.monthly_fee_myr),
    status: (row.status as ClientStatus) ?? "active",
    churn_date: str(row.churn_date),
    notes: str(row.notes),
    go_live_date: str(row.go_live_date),
    delivery_pain: row.delivery_pain === null || row.delivery_pain === undefined
      ? null
      : num(row.delivery_pain),
    delivery_pain_updated_on: str(row.delivery_pain_updated_on),
    last_contact_on: str(row.last_contact_on),
    referral_asked_on: str(row.referral_asked_on),
    billing_terms_confirmed: row.billing_terms_confirmed === true,
    billing_terms_confirmed_on: str(row.billing_terms_confirmed_on),
  };
}

export function normaliseProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id ?? ""),
    deal_id: str(row.deal_id),
    project_name: String(row.project_name ?? ""),
    start_date: String(row.start_date),
    target_date: str(row.target_date),
    completed_date: str(row.completed_date),
    status: (row.status as ProjectStatus) ?? "in_progress",
    notes: str(row.notes),
  };
}

export function normaliseDailyActivity(row: Record<string, unknown>): DailyActivity {
  return {
    entry_date: String(row.entry_date),
    outreach: num(row.outreach),
    conversations: num(row.conversations),
    sales_calls: num(row.sales_calls),
    deep_work_blocks: num(row.deep_work_blocks),
    note: str(row.note),
  };
}

export function normaliseWeeklyContent(row: Record<string, unknown>): WeeklyContent {
  return {
    week_start: String(row.week_start),
    content_posted: num(row.content_posted),
    blog_posts: num(row.blog_posts),
    note: str(row.note),
  };
}

export function normaliseMonthlySpend(row: Record<string, unknown>): MonthlySpend {
  return {
    month: String(row.month),
    source: (isSource(row.source) ? row.source : "other") as Source,
    spend_myr: num(row.spend_myr),
  };
}

export function normaliseReferralAsk(row: Record<string, unknown>): ReferralAsk {
  return {
    id: String(row.id ?? ""),
    asked_on: String(row.asked_on),
    client_id: str(row.client_id),
    notes: str(row.notes),
  };
}

export function normaliseOnboardingProgress(row: Record<string, unknown>): OnboardingProgress {
  return {
    client_id: String(row.client_id ?? ""),
    step_key: String(row.step_key ?? ""),
    done_on: String(row.done_on),
  };
}
