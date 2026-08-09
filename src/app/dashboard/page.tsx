import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  previousRange,
  resolveRange,
  today,
  RANGE_PRESETS,
  type RangePreset,
} from "@/lib/dates";
import {
  buildDailyVolume,
  buildFulfilmentSummary,
  buildFunnel,
  buildMonthlyCompletions,
  buildMonthlyRevenue,
  buildRevenueSummary,
  buildSourcePerformance,
  daysOverdue,
  hasActivity,
  totalSourceRow,
} from "@/lib/metrics";
import {
  normaliseDailyLead,
  normaliseDeal,
  normaliseProject,
  type DailyLead,
  type Deal,
  type Project,
} from "@/lib/types";
import { formatDays, formatMYR, formatNumber } from "@/lib/format";
import { RowHeading, Stat } from "@/components/ui";
import { RangeSelector } from "./range-selector";
import { FunnelRow } from "./funnel-row";
import { VolumeChart } from "./volume-chart";
import { SourceTable } from "./source-table";
import { CashCollectedChart, MrrMovementChart, MrrTrendChart } from "./revenue-charts";
import { CompletionsChart } from "./fulfilment";
import { OverduePanel, type OverdueEntry } from "./overdue-panel";

export const dynamic = "force-dynamic";

const ROLLING_WINDOW = 7;

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

  // Fetch far enough back to cover the comparison window and the rolling
  // average's lead-in, so the 7-day line is defined at the first visible point.
  const fetchFrom =
    previous.from < addDays(range.from, -(ROLLING_WINDOW - 1))
      ? previous.from
      : addDays(range.from, -(ROLLING_WINDOW - 1));

  const supabase = await createClient();

  // Deals and projects are fetched whole, not filtered by range: MRR at any past
  // month depends on every deal ever closed, not just the ones inside the window.
  const [leadsRes, dealsRes, projectsRes] = await Promise.all([
    supabase
      .from("daily_leads")
      .select("*")
      .gte("entry_date", fetchFrom)
      .lte("entry_date", range.to),
    supabase.from("deals").select("*"),
    supabase.from("projects").select("*"),
  ]);

  const loadError =
    leadsRes.error?.message ?? dealsRes.error?.message ?? projectsRes.error?.message ?? null;

  const leads: DailyLead[] = (leadsRes.data ?? []).map(normaliseDailyLead);
  const deals: Deal[] = (dealsRes.data ?? []).map(normaliseDeal);
  const projects: Project[] = (projectsRes.data ?? []).map(normaliseProject);

  const funnel = buildFunnel(leads, deals, range, previous);
  const volume = buildDailyVolume(leads, range, ROLLING_WINDOW);
  const sourceRows = buildSourcePerformance(leads, deals, range).filter(hasActivity);
  const sourceTotals = totalSourceRow(sourceRows);
  const monthlyRevenue = buildMonthlyRevenue(deals, range);
  const revenue = buildRevenueSummary(deals, range, todayISO);
  const completions = buildMonthlyCompletions(projects, range);
  const fulfilment = buildFulfilmentSummary(projects, deals, range, todayISO);

  const clientNameByDeal = new Map(deals.map((deal) => [deal.id, deal.client_name]));
  const overdue: OverdueEntry[] = fulfilment.overdue.map((project) => ({
    project,
    clientName: project.deal_id
      ? (clientNameByDeal.get(project.deal_id) ?? "Unlinked")
      : "Unlinked",
    lateBy: daysOverdue(project, todayISO) ?? 0,
  }));

  return (
    <div className="pb-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
      </div>

      <RangeSelector preset={preset} range={range} previous={previous} maxDate={todayISO} />

      {loadError ? (
        <p role="alert" className="mb-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load dashboard data: {loadError}
        </p>
      ) : null}

      <div className="space-y-6">
        {/* Row A — Funnel */}
        <section>
          <RowHeading hint="counts, stage conversion, and change vs the previous equivalent period">
            Funnel
          </RowHeading>
          <FunnelRow funnel={funnel} />
        </section>

        {/* Row B — Volume */}
        <section>
          <RowHeading hint={`daily leads by source with a ${ROLLING_WINDOW}-day rolling average`}>
            Volume
          </RowHeading>
          <VolumeChart points={volume} />
        </section>

        {/* Row C — Source performance */}
        <section>
          <RowHeading hint="where to spend more effort">Sources</RowHeading>
          <SourceTable rows={sourceRows} totals={sourceTotals} />
        </section>

        {/* Row D — Revenue */}
        <section>
          <RowHeading hint="MRR is measured at each month end; state figures are as at today">
            Revenue
          </RowHeading>

          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              label="Current MRR"
              value={formatMYR(revenue.currentMrr)}
              tone="accent"
              hint="as at today"
            />
            <Stat
              label="Active clients"
              value={formatNumber(revenue.activeClients)}
              hint="status = active"
            />
            <Stat
              label="Avg setup fee"
              value={formatMYR(revenue.averageSetupFee)}
              hint={`${revenue.dealsClosedInRange} closed in range`}
            />
            <Stat
              label="Avg monthly fee"
              value={formatMYR(revenue.averageMonthlyFee)}
              hint="deals closed in range"
            />
            <Stat label="ARPA" value={formatMYR(revenue.arpa)} hint="MRR ÷ active clients" />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <MrrTrendChart points={monthlyRevenue} />
            <MrrMovementChart points={monthlyRevenue} />
          </div>
          <div className="mt-3">
            <CashCollectedChart points={monthlyRevenue} />
          </div>
        </section>

        {/* Row E — Fulfilment */}
        <section>
          <RowHeading hint="derived from the client register, never typed in">
            Fulfilment
          </RowHeading>

          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Active projects"
              value={formatNumber(fulfilment.activeProjectCount)}
              hint="in progress or blocked"
            />
            <Stat
              label="Completed in range"
              value={formatNumber(fulfilment.completedInRange)}
              hint="by completion date"
            />
            <Stat
              label="Clients under servicing"
              value={formatNumber(fulfilment.clientsUnderServicing)}
              hint="deals with status = active"
            />
            <Stat
              label="Avg delivery time"
              value={formatDays(fulfilment.averageDeliveryDays)}
              hint="start to completion, in range"
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <CompletionsChart points={completions} />
            <OverduePanel
              load={fulfilment.loadPerClient}
              activeProjects={fulfilment.activeProjectCount}
              activeClients={fulfilment.clientsUnderServicing}
              overdue={overdue}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
