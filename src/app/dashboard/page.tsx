import { createClient } from "@/lib/supabase/server";
import { previousRange, resolveRange, today, RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { activityTotals, buildActivitySeries, loggingStreak } from "@/lib/metrics";
import { normaliseDailyActivity, type DailyActivity } from "@/lib/types";
import { deltaDirection, formatNumber, formatRelativeDelta } from "@/lib/format";
import { Delta, RowHeading, Stat } from "@/components/ui";
import { RangeSelector } from "./range-selector";
import { ActivityTrendChart } from "./activity-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const todayISO = today();

  const preset: RangePreset = RANGE_PRESETS.includes(params.range as RangePreset)
    ? (params.range as RangePreset)
    : "30d";
  const range = resolveRange(preset, { from: params.from, to: params.to }, todayISO);
  const previous = previousRange(range);

  const supabase = await createClient();

  // Fetched across both windows in one query so the delta cards and the chart
  // read off the same rows.
  const { data, error } = await supabase
    .from("daily_activity")
    .select("*")
    .gte("entry_date", previous.from)
    .lte("entry_date", range.to);

  const rows: DailyActivity[] = (data ?? []).map((r) => normaliseDailyActivity(r as Record<string, unknown>));

  const current = activityTotals(rows, range);
  const prior = activityTotals(rows, previous);
  const series = buildActivitySeries(rows, range);
  const streak = loggingStreak(rows, todayISO);

  const empty = !error && rows.length === 0;

  const cards = [
    { label: "Outreach", value: current.outreach, previous: prior.outreach },
    { label: "Follow-up", value: current.followUp, previous: prior.followUp },
    { label: "Meetings booked", value: current.meetingsBooked, previous: prior.meetingsBooked },
    { label: "Meetings attended", value: current.meetingsAttended, previous: prior.meetingsAttended },
  ];

  return (
    <div className="pb-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
      </div>

      <RangeSelector preset={preset} range={range} previous={previous} maxDate={todayISO} />

      {error ? (
        <p role="alert" className="mb-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load dashboard data: {error.message}
        </p>
      ) : null}

      {empty ? (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-sm font-medium text-ink">Nothing logged yet.</p>
          <p className="mt-1 text-xs text-ink-muted">Log today on Entry and it shows up here.</p>
        </div>
      ) : null}

      <div className="space-y-6">
        <section>
          <RowHeading hint={`${current.daysLogged} of ${current.daysInRange} days logged in range`}>
            Activity
          </RowHeading>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {cards.map((card) => (
              <Stat
                key={card.label}
                label={card.label}
                value={formatNumber(card.value)}
                delta={
                  <Delta
                    text={formatRelativeDelta(card.value, card.previous)}
                    direction={deltaDirection(card.value, card.previous)}
                  />
                }
                hint="vs previous period"
              />
            ))}
            <Stat
              label="Logging streak"
              value={`${streak} ${streak === 1 ? "day" : "days"}`}
              hint="consecutive, ending today"
            />
          </div>
        </section>

        <section>
          <ActivityTrendChart series={series} />
        </section>
      </div>
    </div>
  );
}
