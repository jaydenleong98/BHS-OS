"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Counts only. Negatives and junk collapse to zero; blank already arrives as 0. */
function count(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 100_000);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export type DailyEntryInput = {
  entry_date: string;
  outreach: number;
  follow_up: number;
  meetings_booked: number;
  meetings_attended: number;
  note: string;
};

/**
 * Saves one day of activity.
 *
 * An all-zero day is stored rather than deleted. "I did nothing today" is a
 * complete, true answer and has to be recordable — otherwise the streak can't
 * tell it apart from a day that was simply never logged.
 */
export async function saveDailyEntry(input: DailyEntryInput): Promise<ActionResult> {
  if (!ISO_DATE.test(input.entry_date)) return { ok: false, error: "Invalid date." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("daily_activity").upsert(
    {
      entry_date: input.entry_date,
      outreach: count(input.outreach),
      follow_up: count(input.follow_up),
      meetings_booked: count(input.meetings_booked),
      meetings_attended: count(input.meetings_attended),
      note: input.note.trim() || null,
    },
    { onConflict: "entry_date" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/entry");
  revalidatePath("/dashboard");
  return { ok: true };
}
