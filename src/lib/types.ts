/** Row shapes as they come back from Supabase. Dates are always 'YYYY-MM-DD' strings. */

export const SOURCES = [
  "xhs",
  "cold",
  "facebook",
  "instagram",
  "tiktok",
  "referral",
  "other",
] as const;

export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  xhs: "XHS",
  cold: "Cold",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  referral: "Referral",
  other: "Other",
};

export const TIERS = ["growth", "professional", "enterprise", "custom"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
  custom: "Custom",
};

export const DEAL_STATUSES = ["active", "paused", "churned"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PROJECT_STATUSES = ["not_started", "in_progress", "blocked", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
};

export type DailyLead = {
  id: string;
  entry_date: string;
  source: Source;
  leads_generated: number;
  calls_booked: number;
  calls_taken: number;
  spend_myr: number;
};

export type Deal = {
  id: string;
  client_name: string;
  close_date: string;
  source: Source;
  tier: Tier | null;
  setup_fee_myr: number;
  monthly_fee_myr: number;
  status: DealStatus;
  churn_date: string | null;
  notes: string | null;
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

export type DailyNote = {
  entry_date: string;
  note: string | null;
};

/**
 * Supabase returns numerics as strings in some client versions and numbers in
 * others. Normalise on read so no arithmetic ever silently concatenates.
 */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normaliseDailyLead(row: Record<string, unknown>): DailyLead {
  return {
    id: String(row.id ?? ""),
    entry_date: String(row.entry_date),
    source: row.source as Source,
    leads_generated: num(row.leads_generated),
    calls_booked: num(row.calls_booked),
    calls_taken: num(row.calls_taken),
    spend_myr: num(row.spend_myr),
  };
}

export function normaliseDeal(row: Record<string, unknown>): Deal {
  return {
    id: String(row.id ?? ""),
    client_name: String(row.client_name ?? ""),
    close_date: String(row.close_date),
    source: row.source as Source,
    tier: (row.tier as Tier) ?? null,
    setup_fee_myr: num(row.setup_fee_myr),
    monthly_fee_myr: num(row.monthly_fee_myr),
    status: row.status as DealStatus,
    churn_date: (row.churn_date as string) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

export function normaliseProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id ?? ""),
    deal_id: (row.deal_id as string) ?? null,
    project_name: String(row.project_name ?? ""),
    start_date: String(row.start_date),
    target_date: (row.target_date as string) ?? null,
    completed_date: (row.completed_date as string) ?? null,
    status: row.status as ProjectStatus,
    notes: (row.notes as string) ?? null,
  };
}
