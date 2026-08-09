"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SOURCES, TIERS, type Source, type Tier } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanNumber(value: unknown, { integer = true } = {}): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
}

export type EntryRowInput = {
  source: Source;
  leads_generated: number;
  calls_booked: number;
  calls_taken: number;
  spend_myr: number;
};

/**
 * Saves one day of flow metrics.
 *
 * Rows that are entirely empty are deleted rather than stored as zeros — the
 * schema's "only rows with activity get saved" rule. That keeps a blanked-out
 * source from lingering as a phantom zero row after an edit.
 */
export async function saveDailyEntry(input: {
  entry_date: string;
  rows: EntryRowInput[];
  note: string;
}): Promise<ActionResult> {
  if (!ISO_DATE.test(input.entry_date)) {
    return { ok: false, error: "Invalid date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const toUpsert: (EntryRowInput & { entry_date: string })[] = [];
  const toDelete: Source[] = [];

  for (const source of SOURCES) {
    const row = input.rows.find((r) => r.source === source);
    const values = {
      leads_generated: cleanNumber(row?.leads_generated),
      calls_booked: cleanNumber(row?.calls_booked),
      calls_taken: cleanNumber(row?.calls_taken),
      spend_myr: cleanNumber(row?.spend_myr, { integer: false }),
    };
    const empty =
      values.leads_generated === 0 &&
      values.calls_booked === 0 &&
      values.calls_taken === 0 &&
      values.spend_myr === 0;

    if (empty) toDelete.push(source);
    else toUpsert.push({ entry_date: input.entry_date, source, ...values });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("daily_leads")
      .upsert(toUpsert, { onConflict: "entry_date,source" });
    if (error) return { ok: false, error: error.message };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("daily_leads")
      .delete()
      .eq("entry_date", input.entry_date)
      .in("source", toDelete);
    if (error) return { ok: false, error: error.message };
  }

  const note = input.note.trim();
  if (note) {
    const { error } = await supabase
      .from("daily_notes")
      .upsert({ entry_date: input.entry_date, note }, { onConflict: "entry_date" });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("daily_notes")
      .delete()
      .eq("entry_date", input.entry_date);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/entry");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type DealInput = {
  client_name: string;
  close_date: string;
  source: Source;
  tier: Tier | "";
  setup_fee_myr: number;
  monthly_fee_myr: number;
  notes?: string;
};

/** Logs a closed deal. This row is the conversion record the funnel closes on. */
export async function logDeal(input: DealInput): Promise<ActionResult> {
  const clientName = input.client_name.trim();
  if (!clientName) return { ok: false, error: "Client name is required." };
  if (!ISO_DATE.test(input.close_date)) return { ok: false, error: "Invalid close date." };
  if (!SOURCES.includes(input.source)) return { ok: false, error: "Invalid source." };
  if (input.tier !== "" && !TIERS.includes(input.tier)) {
    return { ok: false, error: "Invalid tier." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("deals").insert({
    client_name: clientName,
    close_date: input.close_date,
    source: input.source,
    tier: input.tier === "" ? null : input.tier,
    setup_fee_myr: cleanNumber(input.setup_fee_myr, { integer: false }),
    monthly_fee_myr: cleanNumber(input.monthly_fee_myr, { integer: false }),
    status: "active",
    notes: input.notes?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/entry");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return { ok: true };
}
