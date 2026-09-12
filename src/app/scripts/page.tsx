import { createClient } from "@/lib/supabase/server";
import { normaliseScriptEntry, type ScriptEntry } from "@/lib/types";
import { ScriptsBoard } from "./scripts-board";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .order("created_at", { ascending: true });

  const entries: ScriptEntry[] = (data ?? []).map((row) =>
    normaliseScriptEntry(row as Record<string, unknown>)
  );
  const scripts = entries.filter((e) => e.category === "script");
  const objections = entries.filter((e) => e.category === "objection");

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Scripts</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          Your sales scripts and objection responses, in one place.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load scripts: {error.message}
        </p>
      ) : null}

      <ScriptsBoard scripts={scripts} objections={objections} />
    </div>
  );
}
