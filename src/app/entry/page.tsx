import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { loadSettings } from "@/lib/settings";
import { buildContentSummary, loggingStreak, recentLoggingActivity } from "@/lib/metrics";
import {
  normaliseDailyActivity,
  normaliseWeeklyContent,
  type DailyActivity,
  type WeeklyContent,
} from "@/lib/types";
import { cx } from "@/components/ui";
import { EntryForm } from "./entry-form";
import { WeeklyForm } from "./weekly-form";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const dynamic = "force-dynamic";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; week?: string; view?: string }>;
}) {
  const params = await searchParams;
  const todayISO = today();
  const view = params.view === "weekly" ? "weekly" : "daily";

  const supabase = await createClient();
  const settings = await loadSettings(supabase);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Entry</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          Effort only. Everything about a prospect or a client is logged on{" "}
          <Link href="/pipeline" className="text-accent-bright underline underline-offset-2">
            Pipeline
          </Link>
          .
        </p>
      </div>

      <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5">
        <Tab href="/entry" active={view === "daily"}>
          My day
        </Tab>
        <Tab href="/entry?view=weekly" active={view === "weekly"}>
          Vaneese · week
        </Tab>
      </div>

      {view === "weekly" ? (
        <WeeklyPanel week={params.week} todayISO={todayISO} settings={settings} />
      ) : (
        <DailyPanel date={params.date} todayISO={todayISO} settings={settings} />
      )}
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-accent/15 text-accent-bright" : "text-ink-muted hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

async function DailyPanel({
  date,
  todayISO,
  settings,
}: {
  date: string | undefined;
  todayISO: string;
  settings: Awaited<ReturnType<typeof loadSettings>>;
}) {
  // Never let a malformed or future date through — you can't log tomorrow.
  const entryDate = date && ISO_DATE.test(date) && date <= todayISO ? date : todayISO;

  const supabase = await createClient();
  // 60 days is enough history for both the 7-day strip and any plausible streak.
  const streakWindowStart = addDays(todayISO, -59);

  const [dayRes, historyRes] = await Promise.all([
    supabase.from("daily_activity").select("*").eq("entry_date", entryDate).maybeSingle(),
    supabase
      .from("daily_activity")
      .select("entry_date, outreach, conversations, sales_calls, deep_work_blocks")
      .gte("entry_date", streakWindowStart)
      .lte("entry_date", todayISO),
  ]);

  const loadError = dayRes.error?.message ?? historyRes.error?.message ?? null;

  const day: DailyActivity | null = dayRes.data
    ? normaliseDailyActivity(dayRes.data as Record<string, unknown>)
    : null;
  const history: DailyActivity[] = (historyRes.data ?? []).map((r) =>
    normaliseDailyActivity(r as Record<string, unknown>)
  );

  return (
    <EntryForm
      // Remount on date change so typed values can't bleed across days.
      key={entryDate}
      entryDate={entryDate}
      maxDate={todayISO}
      initialRow={day}
      settings={settings}
      last7Days={recentLoggingActivity(history, 7, todayISO)}
      streak={loggingStreak(history, todayISO)}
      loadError={loadError}
    />
  );
}

async function WeeklyPanel({
  week,
  todayISO,
  settings,
}: {
  week: string | undefined;
  todayISO: string;
  settings: Awaited<ReturnType<typeof loadSettings>>;
}) {
  const currentWeek = startOfWeek(todayISO);
  const weekStart =
    week && ISO_DATE.test(week) && week <= todayISO ? startOfWeek(week) : currentWeek;

  const supabase = await createClient();
  const historyStart = addDays(currentWeek, -7 * 7);

  const [weekRes, historyRes] = await Promise.all([
    supabase.from("weekly_content").select("*").eq("week_start", weekStart).maybeSingle(),
    supabase
      .from("weekly_content")
      .select("*")
      .gte("week_start", historyStart)
      .lte("week_start", currentWeek),
  ]);

  const loadError = weekRes.error?.message ?? historyRes.error?.message ?? null;

  const row: WeeklyContent | null = weekRes.data
    ? normaliseWeeklyContent(weekRes.data as Record<string, unknown>)
    : null;
  const history: WeeklyContent[] = (historyRes.data ?? []).map((r) =>
    normaliseWeeklyContent(r as Record<string, unknown>)
  );

  return (
    <WeeklyForm
      key={weekStart}
      weekStart={weekStart}
      maxWeek={currentWeek}
      initialRow={row}
      settings={settings}
      recentWeeks={buildContentSummary(history, settings, 8, todayISO).weeks}
      loadError={loadError}
    />
  );
}
