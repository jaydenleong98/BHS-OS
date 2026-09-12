import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { normaliseDailyActivity, type DailyActivity } from "@/lib/types";
import { EntryForm } from "./entry-form";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const todayISO = today();

  // Never let a malformed or future date through — you can't log tomorrow.
  const entryDate =
    params.date && ISO_DATE.test(params.date) && params.date <= todayISO ? params.date : todayISO;

  const supabase = await createClient();
  const dayRes = await supabase.from("daily_activity").select("*").eq("entry_date", entryDate).maybeSingle();

  const loadError = dayRes.error?.message ?? null;
  const day: DailyActivity | null = dayRes.data
    ? normaliseDailyActivity(dayRes.data as Record<string, unknown>)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Entry</h1>
        <p className="mt-0.5 text-xs text-ink-faint">Log today in under a minute.</p>
      </div>

      <EntryForm
        // Remount on date change so typed values can't bleed across days.
        key={entryDate}
        entryDate={entryDate}
        maxDate={todayISO}
        initialRow={day}
        loadError={loadError}
      />
    </div>
  );
}
