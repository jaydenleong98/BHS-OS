/**
 * PREVIEW MODE ONLY — never reached when NEXT_PUBLIC_PREVIEW_DATA is unset.
 *
 * The in-memory table set the preview client reads and writes. It starts
 * EMPTY: whatever you type into it during the session is all it will ever show.
 *
 * Keep the shapes in sync with `supabase/schema.sql`. If the two drift, preview
 * stops being a preview of anything.
 */

export type Row = Record<string, unknown>;

export type Dataset = {
  daily_activity: Row[];
  scripts: Row[];
};

export const TABLES = ["daily_activity", "scripts"] as const satisfies readonly (keyof Dataset)[];

export function buildDataset(): Dataset {
  return {
    daily_activity: [],
    scripts: [],
  };
}
