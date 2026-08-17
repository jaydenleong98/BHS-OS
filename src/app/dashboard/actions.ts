"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import type { ActionResult } from "../entry/actions";

/**
 * Records one referral ask.
 *
 * Deliberately the cheapest possible write — a button on the dashboard, no form.
 * Referrals are the highest-converting source and the most under-used one, and an
 * ask I have to open a page to log is an ask I will not log.
 */
export async function logReferralAsk(input: {
  client_id: string | null;
  notes?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("referral_asks").insert({
    asked_on: today(),
    client_id: input.client_id,
    notes: input.notes?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  // Stamp the client too, so /clients can show who has never been asked.
  if (input.client_id) {
    const { error: clientError } = await supabase
      .from("deals")
      .update({ referral_asked_on: today() })
      .eq("id", input.client_id);
    if (clientError) return { ok: false, error: clientError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return { ok: true };
}
