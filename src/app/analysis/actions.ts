"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SOURCES, isSource, type Source } from "@/lib/types";
import type { ActionResult } from "../entry/actions";

const MONTH_KEY = /^\d{4}-\d{2}$/;

/**
 * Ad spend for one month, all sources at once.
 *
 * Monthly, not daily. Spend is decided and reconciled monthly, so typing it in
 * daily only ever produced a number that had to be corrected later — and it was
 * the last thing left on the entry page that was not effort.
 *
 * A source set to zero is deleted rather than stored, so the spend table only
 * ever holds months where money actually moved.
 */
export async function saveMonthlySpend(input: {
  month: string;
  spend: { source: Source; spend_myr: number }[];
}): Promise<ActionResult> {
  if (!MONTH_KEY.test(input.month)) return { ok: false, error: "Invalid month." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const clean = (value: number) =>
    Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;

  const toUpsert: { month: string; source: Source; spend_myr: number }[] = [];
  const toDelete: Source[] = [];

  for (const source of SOURCES) {
    const entry = input.spend.find((s) => s.source === source);
    if (entry && !isSource(entry.source)) return { ok: false, error: "Invalid source." };
    const amount = clean(entry?.spend_myr ?? 0);
    if (amount === 0) toDelete.push(source);
    else toUpsert.push({ month: input.month, source, spend_myr: amount });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("monthly_spend")
      .upsert(toUpsert, { onConflict: "month,source" });
    if (error) return { ok: false, error: error.message };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("monthly_spend")
      .delete()
      .eq("month", input.month)
      .in("source", toDelete);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/analysis");
  return { ok: true };
}
