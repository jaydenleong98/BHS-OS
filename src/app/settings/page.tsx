import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { loadSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

const COUNTED_TABLES = [
  "prospects",
  "deals",
  "projects",
  "daily_activity",
  "weekly_content",
  "monthly_spend",
  "referral_asks",
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();
  const settings = await loadSettings(supabase);

  // Counted by fetching keys rather than head:true counts, so the preview client
  // and the real one agree on the number.
  const counts = await Promise.all(
    COUNTED_TABLES.map(async (table) => {
      const { data } = await supabase.from(table).select("created_at");
      return (data ?? []).length;
    })
  );
  const recordCount = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          Targets and ceilings. Nothing here is a measurement — these are the numbers everything
          else is judged against.
        </p>
      </div>

      <SettingsForm settings={settings} todayISO={today()} recordCount={recordCount} />
    </div>
  );
}
