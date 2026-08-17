"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/dates";
import { loadSettings } from "@/lib/settings";
import {
  OPEN_STAGES,
  STAGE_DATE_FIELD,
  isSource,
  isStage,
  type Source,
  type Stage,
} from "@/lib/types";
import type { ActionResult } from "../entry/actions";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateAll() {
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/analysis");
  revalidatePath("/clients");
}

// ---------------------------------------------------------------------------
// Stage dates
// ---------------------------------------------------------------------------

/**
 * The date columns to stamp when a prospect reaches `stage`.
 *
 * Every earlier stage that was never stamped gets stamped too. Skipping straight
 * from "new" to "proposal" still means a conversation happened — the funnel would
 * lie if the intermediate counts stayed empty. Already-stamped dates are left
 * alone, so a column always records the FIRST time that stage was reached and
 * moving a card backwards never rewrites history.
 */
function stageStamps(
  current: Record<string, unknown>,
  stage: Stage,
  on: string
): Record<string, string> {
  const open = OPEN_STAGES as readonly Stage[];

  let targets: Stage[];
  if (stage === "lost") targets = ["lost"];
  else if (stage === "won") targets = [...open, "won"];
  else targets = open.slice(0, open.indexOf(stage) + 1);

  const stamps: Record<string, string> = {};
  for (const s of targets) {
    const column = STAGE_DATE_FIELD[s];
    if (!current[column]) stamps[column] = on;
  }
  return stamps;
}

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------

export type ProspectInput = {
  name: string;
  source: Source;
  referred_by_client_id: string | null;
  est_setup_fee_myr: number;
  est_monthly_fee_myr: number;
  notes: string;
  new_on?: string;
};

export async function createProspect(input: ProspectInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!isSource(input.source)) return { ok: false, error: "Invalid source." };

  const startedOn =
    input.new_on && ISO_DATE.test(input.new_on) && input.new_on <= today() ? input.new_on : today();

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("prospects").insert({
    name,
    source: input.source,
    referred_by_client_id: input.source === "referral" ? input.referred_by_client_id : null,
    stage: "new",
    new_on: startedOn,
    est_setup_fee_myr: money(input.est_setup_fee_myr),
    est_monthly_fee_myr: money(input.est_monthly_fee_myr),
    notes: input.notes.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function updateProspect(input: {
  id: string;
  name: string;
  source: Source;
  referred_by_client_id: string | null;
  est_setup_fee_myr: number;
  est_monthly_fee_myr: number;
  notes: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!isSource(input.source)) return { ok: false, error: "Invalid source." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("prospects")
    .update({
      name,
      source: input.source,
      referred_by_client_id: input.source === "referral" ? input.referred_by_client_id : null,
      est_setup_fee_myr: money(input.est_setup_fee_myr),
      est_monthly_fee_myr: money(input.est_monthly_fee_myr),
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteProspect(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // A won prospect owns a client record. Deleting it would leave revenue on the
  // dashboard with nothing behind it.
  const { data: existing } = await supabase
    .from("prospects")
    .select("client_id")
    .eq("id", id)
    .maybeSingle();
  if ((existing as { client_id?: string | null } | null)?.client_id) {
    return {
      ok: false,
      error: "This prospect became a client. Churn them on the Clients page instead.",
    };
  }

  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stage moves — one click, no form
// ---------------------------------------------------------------------------

/** Moves a prospect to any open stage. Won and lost have their own actions. */
export async function moveProspect(input: { id: string; stage: Stage }): Promise<ActionResult> {
  if (!isStage(input.stage)) return { ok: false, error: "Invalid stage." };
  if (input.stage === "won") {
    return { ok: false, error: "Marking won needs the actual fees — use the won form." };
  }
  if (input.stage === "lost") {
    return { ok: false, error: "Marking lost needs a reason." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: current, error: readError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: false, error: "Prospect not found." };

  // Won is not reversible from here. The client record is real revenue; undoing
  // the win by dragging a card would leave MRR with no owner.
  if ((current as { client_id?: string | null }).client_id) {
    return {
      ok: false,
      error: "This prospect is already a client. Change their status on the Clients page.",
    };
  }

  const { error } = await supabase
    .from("prospects")
    .update({
      stage: input.stage,
      ...stageStamps(current as Record<string, unknown>, input.stage, today()),
      // Re-opening from lost clears the loss, so it stops counting as one.
      lost_on: null,
      lost_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function loseProspect(input: { id: string; reason: string }): Promise<ActionResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required to mark a prospect lost." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("prospects")
    .update({
      stage: "lost",
      lost_on: today(),
      lost_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Won — the one moment that creates records
// ---------------------------------------------------------------------------

export type WinInput = {
  id: string;
  setup_fee_myr: number;
  monthly_fee_myr: number;
  go_live_date: string | null;
  won_on?: string;
};

/**
 * Marks a prospect won and creates the client and project rows behind it.
 *
 * This is the only place a client record is created. There is no "log a closed
 * deal" form any more: a client that never existed as a prospect would have no
 * source, no stage dates, and no sales cycle to measure.
 */
export async function winProspect(input: WinInput): Promise<ActionResult> {
  const wonOn =
    input.won_on && ISO_DATE.test(input.won_on) && input.won_on <= today() ? input.won_on : today();
  if (input.go_live_date !== null && !ISO_DATE.test(input.go_live_date)) {
    return { ok: false, error: "Invalid go-live date." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: prospect, error: readError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const row = prospect as Record<string, unknown>;
  if (row.client_id) return { ok: false, error: "This prospect already has a client record." };

  const settings = await loadSettings(supabase);

  // 1. The client record.
  const { data: created, error: clientError } = await supabase
    .from("deals")
    .insert({
      client_name: String(row.name ?? ""),
      close_date: wonOn,
      source: row.source,
      setup_fee_myr: money(input.setup_fee_myr),
      monthly_fee_myr: money(input.monthly_fee_myr),
      status: "active",
      go_live_date: input.go_live_date,
      last_contact_on: wonOn,
      notes: (row.notes as string) ?? null,
    })
    .select("id")
    .maybeSingle();

  if (clientError) return { ok: false, error: clientError.message };

  // The preview client does not return inserted rows; fall back to a lookup so
  // both backends end up with the same links.
  let clientId = (created as { id?: string } | null)?.id ?? null;
  if (!clientId) {
    const { data: found } = await supabase
      .from("deals")
      .select("id, client_name, close_date")
      .eq("client_name", String(row.name ?? ""))
      .eq("close_date", wonOn)
      .maybeSingle();
    clientId = (found as { id?: string } | null)?.id ?? null;
  }

  // 2. The build. Target defaults to the close-to-live target, so a missing
  //    go-live date still produces a date the overdue flag can bite on.
  const targetDate = input.go_live_date ?? addDays(wonOn, settings.close_to_live_target_days);
  const { error: projectError } = await supabase.from("projects").insert({
    deal_id: clientId,
    project_name: `${String(row.name ?? "New client")} — Build`,
    start_date: wonOn,
    target_date: targetDate,
    status: "in_progress",
  });
  if (projectError) return { ok: false, error: projectError.message };

  // 3. The prospect itself.
  const { error: updateError } = await supabase
    .from("prospects")
    .update({
      stage: "won",
      ...stageStamps(row, "won", wonOn),
      won_on: wonOn,
      client_id: clientId,
      lost_on: null,
      lost_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (updateError) return { ok: false, error: updateError.message };

  revalidateAll();
  return { ok: true };
}
