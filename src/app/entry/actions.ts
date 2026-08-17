"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek } from "@/lib/dates";

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
  conversations: number;
  sales_calls: number;
  deep_work_blocks: number;
  note: string;
};

/**
 * Saves one day of effort.
 *
 * Unlike the flow grid this replaced, an all-zero day is stored rather than
 * deleted. "I did nothing today" is a complete, true answer and has to be
 * recordable — otherwise the streak can't tell it apart from a day I forgot.
 */
export async function saveDailyEntry(input: DailyEntryInput): Promise<ActionResult> {
  if (!ISO_DATE.test(input.entry_date)) return { ok: false, error: "Invalid date." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("daily_activity").upsert(
    {
      entry_date: input.entry_date,
      outreach: count(input.outreach),
      conversations: count(input.conversations),
      sales_calls: count(input.sales_calls),
      deep_work_blocks: count(input.deep_work_blocks),
      note: input.note.trim() || null,
    },
    { onConflict: "entry_date" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/entry");
  revalidatePath("/analysis");
  return { ok: true };
}

export type WeeklyContentInput = {
  week_start: string;
  content_posted: number;
  blog_posts: number;
  note: string;
};

/** Vaneese's week. Keyed by Monday, and normalised to one even if a Thursday arrives. */
export async function saveWeeklyContent(input: WeeklyContentInput): Promise<ActionResult> {
  if (!ISO_DATE.test(input.week_start)) return { ok: false, error: "Invalid week." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("weekly_content").upsert(
    {
      week_start: startOfWeek(input.week_start),
      content_posted: count(input.content_posted),
      blog_posts: count(input.blog_posts),
      note: input.note.trim() || null,
    },
    { onConflict: "week_start" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/entry");
  revalidatePath("/dashboard");
  return { ok: true };
}
