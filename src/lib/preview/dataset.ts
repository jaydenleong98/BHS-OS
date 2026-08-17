/**
 * PREVIEW MODE ONLY — never reached when NEXT_PUBLIC_PREVIEW_DATA is unset.
 *
 * The in-memory table set the preview client reads and writes.
 *
 * It starts EMPTY, deliberately. This app used to ship a generated dataset of
 * fake clients and fake MRR, and the numbers looked real enough to be read as
 * real. Nothing in here fabricates a client, a fee, or a funnel count any more:
 * preview mode gives you the app with no database behind it, and whatever you
 * type into it during the session is all it will ever show.
 *
 * Keep the shapes in sync with `supabase/schema.sql`. If the two drift, preview
 * stops being a preview of anything.
 */

import { DEFAULT_SETTINGS } from "@/lib/settings";

export type Row = Record<string, unknown>;

export type Dataset = {
  prospects: Row[];
  deals: Row[];
  projects: Row[];
  daily_activity: Row[];
  weekly_content: Row[];
  monthly_spend: Row[];
  referral_asks: Row[];
  onboarding_progress: Row[];
  app_settings: Row[];
};

export const TABLES = [
  "prospects",
  "deals",
  "projects",
  "daily_activity",
  "weekly_content",
  "monthly_spend",
  "referral_asks",
  "onboarding_progress",
] as const satisfies readonly (keyof Dataset)[];

export function buildDataset(): Dataset {
  return {
    prospects: [],
    deals: [],
    projects: [],
    daily_activity: [],
    weekly_content: [],
    monthly_spend: [],
    referral_asks: [],
    onboarding_progress: [],
    // Settings are configuration, not data: the one row exists from the start so
    // /settings has something to edit. Every figure in it is the documented
    // default, and target MRR is zero until it is set by hand.
    app_settings: [
      {
        id: "singleton",
        ...DEFAULT_SETTINGS,
        created_at: new Date(0).toISOString(),
      },
    ],
  };
}
