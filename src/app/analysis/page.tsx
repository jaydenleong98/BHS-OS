import { createClient } from "@/lib/supabase/server";
import {
  monthKey,
  previousRange,
  resolveRange,
  today,
  RANGE_PRESETS,
  type RangePreset,
} from "@/lib/dates";
import { loadSettings } from "@/lib/settings";
import {
  buildActivityLines,
  buildFunnel,
  buildMonthlyProspects,
  buildSourcePerformance,
  conversionRates,
  hasActivity,
  spendInRange,
  totalSourceRow,
} from "@/lib/metrics";
import {
  normaliseClient,
  normaliseDailyActivity,
  normaliseMonthlySpend,
  normaliseProspect,
  type Client,
  type DailyActivity,
  type MonthlySpend,
  type Prospect,
} from "@/lib/types";
import { formatMYR, formatNumber, formatPct } from "@/lib/format";
import { Card, RowHeading, Stat, cx } from "@/components/ui";
import { RangeSelector } from "../dashboard/range-selector";
import { SourceTable } from "./source-table";
import { ProspectVolumeChart, SourceBars } from "./charts";
import { SpendForm } from "./spend-form";

const MONTH_KEY = /^\d{4}-\d{2}$/;

export const dynamic = "force-dynamic";

/**
 * Everything that is a ratio, a cost, or a per-source breakdown lives here and
 * nowhere else. The dashboard answers "how far off the goal am I"; this page is
 * for the occasional half hour of actually looking into why.
 */
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; month?: string }>;
}) {
  const params = await searchParams;
  const todayISO = today();
  const thisMonth = monthKey(todayISO);
  const spendMonth = params.month && MONTH_KEY.test(params.month) ? params.month : thisMonth;

  const preset: RangePreset = RANGE_PRESETS.includes(params.range as RangePreset)
    ? (params.range as RangePreset)
    : "90d";
  const range = resolveRange(preset, { from: params.from, to: params.to }, todayISO);
  const previous = previousRange(range);

  const supabase = await createClient();

  const [prospectsRes, clientsRes, spendRes, activityRes, settings] = await Promise.all([
    supabase.from("prospects").select("*"),
    supabase.from("deals").select("*"),
    supabase.from("monthly_spend").select("*"),
    supabase
      .from("daily_activity")
      .select("*")
      .gte("entry_date", range.from)
      .lte("entry_date", range.to),
    loadSettings(supabase),
  ]);

  const loadError =
    prospectsRes.error?.message ??
    clientsRes.error?.message ??
    spendRes.error?.message ??
    activityRes.error?.message ??
    null;

  const map = <T,>(res: { data: unknown[] | null }, fn: (row: Record<string, unknown>) => T): T[] =>
    (res.data ?? []).map((row) => fn(row as Record<string, unknown>));

  const prospects: Prospect[] = map(prospectsRes, normaliseProspect);
  const clients: Client[] = map(clientsRes, normaliseClient);
  const spend: MonthlySpend[] = map(spendRes, normaliseMonthlySpend);
  const activity: DailyActivity[] = map(activityRes, normaliseDailyActivity);

  const funnel = buildFunnel(prospects, range, previous);
  const rates = conversionRates(funnel);
  const sourceRows = buildSourcePerformance(prospects, clients, spend, range).filter(hasActivity);
  const sourceTotals = totalSourceRow(sourceRows);
  const volume = buildMonthlyProspects(prospects, range);
  const activityLines = buildActivityLines(activity, range, settings);

  const rangeSpend = spendInRange(spend, range);
  const costPerProspect = sourceTotals.costPerProspect;
  const costPerAcquisition = sourceTotals.costPerAcquisition;

  return (
    <div className="pb-6">
      <div className="mb-1">
        <h1 className="text-lg font-semibold tracking-tight">Analysis</h1>
      </div>

      <RangeSelector
        preset={preset}
        range={range}
        previous={previous}
        maxDate={todayISO}
        basePath="/analysis"
        keep={{ month: spendMonth === thisMonth ? undefined : spendMonth }}
      />

      {loadError ? (
        <p role="alert" className="mb-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load analysis data: {loadError}
        </p>
      ) : null}

      <div className="space-y-6">
        <section>
          <RowHeading hint="read these over 90 days or more, never over a week">
            Conversion
          </RowHeading>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              label="Outreach → convo"
              value={formatPct(rates.outreachToConversation)}
              hint={`${funnel.totals.conversations} of ${funnel.totals.outreach}`}
            />
            <Stat
              label="Convo → booked"
              value={formatPct(rates.conversationToBooked)}
              hint={`${funnel.totals.booked} of ${funnel.totals.conversations}`}
            />
            <Stat
              label="Show rate"
              value={formatPct(rates.showRate)}
              hint={`${funnel.totals.taken} of ${funnel.totals.booked}`}
            />
            <Stat
              label="Close rate"
              value={formatPct(rates.closeRate)}
              hint={`${funnel.totals.closed} of ${funnel.totals.taken}`}
            />
            <Stat
              label="Outreach → close"
              value={formatPct(rates.outreachToClose, 2)}
              hint="end to end"
            />
          </div>

          <p className="mt-2 text-[11px] text-ink-faint">
            At six to eight closes a year a single event moves any of these by tens of points. They
            are off the dashboard for that reason — a number that swings that hard on one deal is
            not a signal to steer by.
          </p>
        </section>

        <section>
          <RowHeading hint="what the money bought">Cost</RowHeading>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Spend in range" value={formatMYR(rangeSpend)} hint="months touched by range" />
            <Stat label="Cost per prospect" value={formatMYR(costPerProspect)} />
            <Stat label="Cost per acquisition" value={formatMYR(costPerAcquisition)} />
            <Stat
              label="Revenue booked"
              value={formatMYR(sourceTotals.revenue)}
              hint="setup + monthly, clients won in range"
            />
          </div>
        </section>

        <section>
          <RowHeading hint="where prospects come from">Sources</RowHeading>
          <div className="grid gap-3 xl:grid-cols-2">
            <SourceBars rows={sourceRows} />
            <ProspectVolumeChart points={volume} />
          </div>
          <div className="mt-3">
            <SourceTable rows={sourceRows} totals={sourceTotals} />
          </div>
        </section>

        <section>
          <RowHeading hint="the four numbers from the entry page, against their targets">
            Activity
          </RowHeading>

          <div className="grid gap-3 xl:grid-cols-2">
            <Card
              title="Effort vs target"
              subtitle="Averaged over days actually logged, so a missed day doesn't read as a zero day."
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-line">
                {activityLines.map((line) => {
                  const met = line.attainment !== null && line.attainment >= 1;
                  return (
                    <li key={line.key} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 text-xs text-ink-muted">{line.label}</span>
                      <span className="tabular w-16 text-right text-xs text-ink-faint">
                        {formatNumber(line.total)} total
                      </span>
                      <span
                        className={cx(
                          "tabular w-24 text-right text-sm font-semibold",
                          line.target === null ? "text-ink" : met ? "text-good" : "text-warn"
                        )}
                      >
                        {line.perLoggedDay === null ? "—" : line.perLoggedDay.toFixed(1)}
                        <span className="text-[11px] font-normal text-ink-faint">
                          {line.target === null ? "/day" : `/${line.target}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <SpendForm
              month={spendMonth}
              maxMonth={thisMonth}
              rows={spend.filter((row) => row.month === spendMonth)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
