import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { clientsUnderServicing, mrrAsAt, activeProjects, overdueProjects } from "@/lib/metrics";
import { normaliseDeal, normaliseProject, type Deal, type Project } from "@/lib/types";
import { formatMYR, formatNumber } from "@/lib/format";
import { EmptyState, Stat } from "@/components/ui";
import { ClientsTable } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const todayISO = today();

  const [dealsRes, projectsRes] = await Promise.all([
    supabase.from("deals").select("*").order("close_date", { ascending: false }),
    supabase.from("projects").select("*").order("start_date", { ascending: false }),
  ]);

  const error = dealsRes.error?.message ?? projectsRes.error?.message ?? null;
  const deals: Deal[] = (dealsRes.data ?? []).map(normaliseDeal);
  const projects: Project[] = (projectsRes.data ?? []).map(normaliseProject);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Client &amp; Project Register</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          State lives here. Clients under servicing, active projects and MRR are read from these
          rows — they are never typed into the daily form.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load the register: {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Clients under servicing"
          value={formatNumber(clientsUnderServicing(deals))}
          hint={`of ${deals.length} total deals`}
        />
        <Stat
          label="Current MRR"
          value={formatMYR(mrrAsAt(deals, todayISO))}
          tone="accent"
          hint="as at today"
        />
        <Stat
          label="Active projects"
          value={formatNumber(activeProjects(projects).length)}
          hint="in progress or blocked"
        />
        <Stat
          label="Past target date"
          value={formatNumber(overdueProjects(projects, todayISO).length)}
          tone={overdueProjects(projects, todayISO).length > 0 ? "bad" : "default"}
          hint="not yet delivered"
        />
      </div>

      {deals.length === 0 && !error ? (
        <EmptyState
          title="No clients yet."
          hint="Log your first closed deal from the Daily Entry page. Every state metric on the dashboard is derived from these records."
        />
      ) : (
        <ClientsTable deals={deals} projects={projects} todayISO={todayISO} />
      )}
    </div>
  );
}
