import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import {
  activeClientCount,
  activeProjects,
  mrrAsAt,
  overdueProjects,
  staleClients,
} from "@/lib/metrics";
import {
  normaliseClient,
  normaliseOnboardingProgress,
  normaliseProject,
  type Client,
  type OnboardingProgress,
  type Project,
} from "@/lib/types";
import { formatMYR, formatNumber } from "@/lib/format";
import { EmptyState, Stat } from "@/components/ui";
import { ClientsTable } from "./clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const todayISO = today();

  const [clientsRes, projectsRes, onboardingRes] = await Promise.all([
    supabase.from("deals").select("*").order("close_date", { ascending: false }),
    supabase.from("projects").select("*").order("start_date", { ascending: false }),
    supabase.from("onboarding_progress").select("*"),
  ]);

  const error =
    clientsRes.error?.message ?? projectsRes.error?.message ?? onboardingRes.error?.message ?? null;

  const clients: Client[] = (clientsRes.data ?? []).map((r) =>
    normaliseClient(r as Record<string, unknown>)
  );
  const projects: Project[] = (projectsRes.data ?? []).map((r) =>
    normaliseProject(r as Record<string, unknown>)
  );
  const onboarding: OnboardingProgress[] = (onboardingRes.data ?? []).map((r) =>
    normaliseOnboardingProgress(r as Record<string, unknown>)
  );

  const stale = staleClients(clients, todayISO).length;
  const unconfirmed = clients.filter(
    (c) => c.status !== "churned" && !c.billing_terms_confirmed
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Client Register</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          State lives here. Clients are created by winning a prospect on{" "}
          <Link href="/pipeline" className="text-accent-bright underline underline-offset-2">
            Pipeline
          </Link>{" "}
          — MRR, active builds and delivery load are read from these rows and never typed in.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load the register: {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Active clients"
          value={formatNumber(activeClientCount(clients))}
          hint={`of ${clients.length} total`}
        />
        <Stat
          label="Current MRR"
          value={formatMYR(mrrAsAt(clients, todayISO))}
          tone="accent"
          hint="as at today"
        />
        <Stat
          label="Active builds"
          value={formatNumber(activeProjects(projects).length)}
          hint="in progress or blocked"
        />
        <Stat
          label="No contact 30d+"
          value={formatNumber(stale)}
          tone={stale > 0 ? "warn" : "default"}
          hint="including never contacted"
        />
        <Stat
          label="Billing unconfirmed"
          value={formatNumber(unconfirmed)}
          tone={unconfirmed > 0 ? "bad" : "default"}
          hint="terms never said out loud"
        />
      </div>

      {overdueProjects(projects, todayISO).length > 0 ? (
        <p className="rounded-md border border-bad/40 bg-bad/5 px-3 py-2 text-xs text-bad">
          {overdueProjects(projects, todayISO).length} build
          {overdueProjects(projects, todayISO).length === 1 ? " is" : "s are"} past target date.
        </p>
      ) : null}

      {clients.length === 0 && !error ? (
        <EmptyState
          title="No clients yet."
          hint="A client record is created automatically when you mark a prospect won on the Pipeline page. There is no way to add one by hand — a client with no prospect behind it would have no source and no sales cycle."
          action={
            <Link
              href="/pipeline"
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent-bright transition-colors hover:bg-accent/20"
            >
              Open pipeline →
            </Link>
          }
        />
      ) : (
        <ClientsTable
          clients={clients}
          projects={projects}
          onboarding={onboarding}
          todayISO={todayISO}
        />
      )}
    </div>
  );
}
