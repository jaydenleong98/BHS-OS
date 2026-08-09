import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/dates";
import { loggingStreak, recentLoggingActivity } from "@/lib/metrics";
import {
  normaliseDailyLead,
  normaliseDeal,
  type DailyLead,
  type Deal,
} from "@/lib/types";
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
  const requested = params.date;
  // Never let a malformed or future date through — you can't log tomorrow.
  const entryDate =
    requested && ISO_DATE.test(requested) && requested <= todayISO ? requested : todayISO;

  const supabase = await createClient();

  // 60 days is enough history for both the 7-day strip and any plausible streak.
  const streakWindowStart = addDays(todayISO, -59);

  const [dayRowsRes, noteRes, historyRes, dayDealsRes] = await Promise.all([
    supabase.from("daily_leads").select("*").eq("entry_date", entryDate),
    supabase.from("daily_notes").select("note").eq("entry_date", entryDate).maybeSingle(),
    supabase
      .from("daily_leads")
      .select("entry_date, source, leads_generated, calls_booked, calls_taken, spend_myr")
      .gte("entry_date", streakWindowStart)
      .lte("entry_date", todayISO),
    supabase.from("deals").select("*").eq("close_date", entryDate).order("created_at"),
  ]);

  const loadError =
    dayRowsRes.error?.message ??
    noteRes.error?.message ??
    historyRes.error?.message ??
    dayDealsRes.error?.message ??
    null;

  const dayRows: DailyLead[] = (dayRowsRes.data ?? []).map(normaliseDailyLead);
  const history: DailyLead[] = (historyRes.data ?? []).map((r) =>
    normaliseDailyLead(r as Record<string, unknown>)
  );
  const dayDeals: Deal[] = (dayDealsRes.data ?? []).map(normaliseDeal);

  return (
    <EntryForm
      // Remount on date change so typed values can't bleed across days.
      key={entryDate}
      entryDate={entryDate}
      maxDate={todayISO}
      initialRows={dayRows}
      initialNote={noteRes.data?.note ?? ""}
      dealsOnDate={dayDeals}
      last7Days={recentLoggingActivity(history, 7, todayISO)}
      streak={loggingStreak(history, todayISO)}
      loadError={loadError}
    />
  );
}
