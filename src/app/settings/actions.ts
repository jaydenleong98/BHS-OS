"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normaliseSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";
import type { ActionResult } from "../entry/actions";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveSettings(input: AppSettings): Promise<ActionResult> {
  if (input.goal_deadline !== null && !ISO_DATE.test(input.goal_deadline)) {
    return { ok: false, error: "Invalid goal deadline." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Normalising here as well as on read means a bad value can never be stored,
  // not just never displayed.
  const clean = normaliseSettings(input as unknown as Record<string, unknown>);

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: "singleton", ...clean, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/entry");
  revalidatePath("/analysis");
  return { ok: true };
}

/**
 * Deletes every record in the app. Settings survive.
 *
 * This exists because the app shipped with a generated dataset — plausible
 * client names, plausible MRR — and a demo number that looks real is worse than
 * no number at all. One button, one typed confirmation, and the app is empty and
 * honest.
 *
 * Children before parents: the foreign keys point at `deals`, so it goes last.
 */
const WIPE_ORDER = [
  "onboarding_progress",
  "referral_asks",
  "prospects",
  "projects",
  "deals",
  "daily_activity",
  "weekly_content",
  "monthly_spend",
] as const;

export async function wipeAllData(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  for (const table of WIPE_ORDER) {
    // PostgREST refuses an unfiltered delete; every table carries created_at, so
    // this is the "match everything" filter that still satisfies it.
    const { error } = await supabase.from(table).delete().gte("created_at", "1970-01-01");
    if (error) return { ok: false, error: `${table}: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/clients");
  revalidatePath("/entry");
  revalidatePath("/analysis");
  revalidatePath("/settings");
  return { ok: true };
}
