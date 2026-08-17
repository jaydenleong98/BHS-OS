import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { averageCycleDays, weightedPipeline } from "@/lib/metrics";
import { formatDays } from "@/lib/format";
import { normaliseClient, normaliseProspect, type Client, type Prospect } from "@/lib/types";
import { PipelineBoard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();
  const todayISO = today();

  const [prospectsRes, clientsRes] = await Promise.all([
    supabase.from("prospects").select("*").order("new_on", { ascending: false }),
    supabase.from("deals").select("*").order("client_name"),
  ]);

  const loadError = prospectsRes.error?.message ?? clientsRes.error?.message ?? null;

  const prospects: Prospect[] = (prospectsRes.data ?? []).map((r) =>
    normaliseProspect(r as Record<string, unknown>)
  );
  const clients: Client[] = (clientsRes.data ?? []).map((r) =>
    normaliseClient(r as Record<string, unknown>)
  );

  const cycle = averageCycleDays(prospects);

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          One record per prospect. Drag a card between columns, or use the button on its face.
          Average cycle to won:{" "}
          <span className="tabular text-ink-muted">{formatDays(cycle, 0)}</span>. Stage weights on
          the pipeline value are a stated assumption, not a measurement.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load the pipeline: {loadError}
        </p>
      ) : null}

      <PipelineBoard
        prospects={prospects}
        clients={clients}
        pipelineValue={weightedPipeline(prospects)}
        todayISO={todayISO}
      />
    </div>
  );
}
