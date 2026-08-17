import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  previousRange,
  resolveRange,
  startOfWeek,
  today,
  RANGE_PRESETS,
  type RangePreset,
} from "@/lib/dates";
import { loadSettings } from "@/lib/settings";
import {
  buildCapacity,
  buildContentSummary,
  buildFulfilmentSummary,
  buildFunnel,
  buildGoalGap,
  buildMonthlyCompletions,
  buildMonthlyRevenue,
  buildReferralSummary,
  buildRevenueSummary,
  daysOverdue,
} from "@/lib/metrics";
import {
  normaliseClient,
  normaliseOnboardingProgress,
  normaliseProject,
  normaliseProspect,
  normaliseReferralAsk,
  normaliseWeeklyContent,
  type Client,
  type OnboardingProgress,
  type Project,
  type Prospect,
  type ReferralAsk,
  type WeeklyContent,
} from "@/lib/types";
import { formatDays, formatMYR, formatNumber } from "@/lib/format";
import { RowHeading, Stat } from "@/components/ui";
import { RangeSelector } from "./range-selector";
import { GoalHero } from "./goal-hero";
import { FunnelRow } from "./funnel-row";
import { ContentCard } from "./content-card";
import { ReferralsCard } from "./referrals-card";
import { CapacityCard } from "./capacity-card";
import { CashCollectedChart, MrrMovementChart, MrrTrendChart } from "./revenue-charts";
import { CompletionsChart } from "./fulfilment";
import { OverduePanel, type OverdueEntry } from "./overdue-panel";

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

  // Prospects, clients and projects are fetched whole rather than range-filtered:
  // MRR at any past month depends on every client ever won, and the sales-cycle
  // average depends on every prospect ever closed.
  const [
    prospectsRes,
    clientsRes,
    projectsRes,
    onboardingRes,
    contentRes,
    asksRes,
    settings,
  ] = await Promise.all([
    supabase.from("prospects").select("*"),
    supabase.from("deals").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("onboarding_progress").select("*"),
    supabase
      .from("weekly_content")
      .select("*")
      .gte("week_start", addDays(startOfWeek(todayISO), -7 * 7)),
    supabase.from("referral_asks").select("*"),
    loadSettings(supabase),
  ]);

  const loadError =
    prospectsRes.error?.message ??
    clientsRes.error?.message ??
    projectsRes.error?.message ??
    onboardingRes.error?.message ??
    contentRes.error?.message ??
    asksRes.error?.message ??
    null;

  const map = <T,>(res: { data: unknown[] | null }, fn: (row: Record<string, unknown>) => T): T[] =>
    (res.data ?? []).map((row) => fn(row as Record<string, unknown>));

  const prospects: Prospect[] = map(prospectsRes, normaliseProspect);
  const clients: Client[] = map(clientsRes, normaliseClient);
  const projects: Project[] = map(projectsRes, normaliseProject);
  const onboarding: OnboardingProgress[] = map(onboardingRes, normaliseOnboardingProgress);
  const content: WeeklyContent[] = map(contentRes, normaliseWeeklyContent);
  const asks: ReferralAsk[] = map(asksRes, normaliseReferralAsk);

  const goal = buildGoalGap(clients, prospects, settings, todayISO);
  const funnel = buildFunnel(prospects, range, previous);
  const contentSummary = buildContentSummary(content, settings, 8, todayISO);
  const referrals = buildReferralSummary(clients, prospects, asks, todayISO);
  const capacity = buildCapacity(projects, clients, onboarding, settings, range);
  const revenue = buildRevenueSummary(clients, range, todayISO);
  const monthlyRevenue = buildMonthlyRevenue(clients, range);
  const completions = buildMonthlyCompletions(projects, range);
  const fulfilment = buildFulfilmentSummary(projects, clients, range, todayISO);

  const clientNameById = new Map(clients.map((client) => [client.id, client.client_name]));
  const overdue: OverdueEntry[] = fulfilment.overdue.map((project) => ({
    project,
    clientName: project.deal_id ? (clientNameById.get(project.deal_id) ?? "Unlinked") : "Unlinked",
    lateBy: daysOverdue(project, todayISO) ?? 0,
  }));

  const askOptions = clients
    .filter((client) => client.status === "active")
    .map((client) => ({
      id: client.id,
      name: client.client_name,
      lastAsked: client.referral_asked_on,
    }));

  const empty =
    !loadError && prospects.length === 0 && clients.length === 0 && projects.length === 0;

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

      {/* First run: the cards below are all legitimately empty, which on its own
          reads like something is broken. Say what to do instead. */}
      {empty ? (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-sm font-medium text-ink">Nothing logged yet.</p>
          <p className="mt-1 text-xs text-ink-muted">
            Add your first prospect on{" "}
            <Link href="/pipeline" className="text-accent-bright underline underline-offset-2">
              Pipeline
            </Link>
            , log today on{" "}
            <Link href="/entry" className="text-accent-bright underline underline-offset-2">
              Entry
            </Link>
            , and set your target MRR in{" "}
            <Link href="/settings" className="text-accent-bright underline underline-offset-2">
              Settings
            </Link>
            . Every card below fills in from those.
          </p>
        </div>
      ) : null}

      <div className="space-y-6">
        {/* The goal. Everything below is context for this one number. */}
        <GoalHero goal={goal} />

        <section>
          <RowHeading hint="counts of prospects reaching each stage in range">Funnel</RowHeading>
          <FunnelRow funnel={funnel} />
        </section>

        <section>
          <RowHeading hint="content output and the referral engine">Inputs</RowHeading>
          <div className="grid gap-3 xl:grid-cols-2">
            <ContentCard content={contentSummary} />
            <ReferralsCard referrals={referrals} askOptions={askOptions} />
          </div>
        </section>

        <section>
          <RowHeading hint="delivery capacity is the one number where more is worse">
            Fulfilment
          </RowHeading>

          <div className="grid gap-3 xl:grid-cols-2">
            <CapacityCard capacity={capacity} />
            <OverduePanel
              load={fulfilment.loadPerClient}
              activeProjects={fulfilment.activeProjectCount}
              activeClients={fulfilment.activeClients}
              overdue={overdue}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat
              label="Completed in range"
              value={formatNumber(fulfilment.completedInRange)}
              hint="by completion date"
            />
            <Stat
              label="Clients under servicing"
              value={formatNumber(fulfilment.activeClients)}
              hint="status = active"
            />
            <Stat
              label="Avg delivery time"
              value={formatDays(fulfilment.averageDeliveryDays)}
              hint="project start to completion, in range"
            />
          </div>

          <div className="mt-3">
            <CompletionsChart points={completions} />
          </div>
        </section>

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
              hint={`${revenue.clientsWonInRange} won in range`}
            />
            <Stat
              label="Avg monthly fee"
              value={formatMYR(revenue.averageMonthlyFee)}
              hint="clients won in range"
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
      </div>
    </div>
  );
}
