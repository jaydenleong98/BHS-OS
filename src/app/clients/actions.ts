"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import {
  CLIENT_STATUSES,
  ONBOARDING_STEPS,
  PROJECT_STATUSES,
  type ClientStatus,
  type ProjectStatus,
} from "@/lib/types";
import type { ActionResult } from "../entry/actions";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidateAll() {
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
}

/**
 * Sets a client's status, keeping churn_date consistent with it.
 *
 * This matters more than it looks: MRR is defined off churn_date, not status.
 * Letting the two drift would leave a churned client still billing on the
 * dashboard, so churning always stamps a date and un-churning always clears it.
 */
export async function setClientStatus(input: {
  id: string;
  status: ClientStatus;
  churn_date?: string | null;
}): Promise<ActionResult> {
  if (!CLIENT_STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let churnDate: string | null = null;
  if (input.status === "churned") {
    const proposed = input.churn_date ?? today();
    if (!ISO_DATE.test(proposed)) return { ok: false, error: "Invalid churn date." };
    churnDate = proposed;
  }

  const { error } = await supabase
    .from("deals")
    .update({ status: input.status, churn_date: churnDate })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Edit the commercials on a client. Both feed MRR and cash collected. */
export async function updateClientFees(input: {
  id: string;
  setup_fee_myr: number;
  monthly_fee_myr: number;
}): Promise<ActionResult> {
  const clean = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0);

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("deals")
    .update({
      setup_fee_myr: clean(input.setup_fee_myr),
      monthly_fee_myr: clean(input.monthly_fee_myr),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Relationship state — none of this is inferable, all of it is set by hand
// ---------------------------------------------------------------------------

/** Delivery pain, 1–5. Stamped with the day it was last judged, because it ages. */
export async function setDeliveryPain(input: {
  id: string;
  pain: number | null;
}): Promise<ActionResult> {
  if (input.pain !== null && !(Number.isInteger(input.pain) && input.pain >= 1 && input.pain <= 5)) {
    return { ok: false, error: "Pain rating must be 1 to 5." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("deals")
    .update({
      delivery_pain: input.pain,
      delivery_pain_updated_on: input.pain === null ? null : today(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Last meaningful contact. Null clears it, which makes the client read as stale. */
export async function setLastContact(input: {
  id: string;
  date: string | null;
}): Promise<ActionResult> {
  if (input.date !== null && !ISO_DATE.test(input.date)) {
    return { ok: false, error: "Invalid contact date." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("deals")
    .update({ last_contact_on: input.date })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/**
 * Records a referral ask against a client.
 *
 * Writes both the client stamp and a row in referral_asks, so the dashboard's
 * "asks this month" counter and the client's "last asked" can never disagree.
 */
export async function markReferralAsked(input: { id: string }): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const askedOn = today();

  const { error: askError } = await supabase
    .from("referral_asks")
    .insert({ asked_on: askedOn, client_id: input.id });
  if (askError) return { ok: false, error: askError.message };

  const { error } = await supabase
    .from("deals")
    .update({ referral_asked_on: askedOn })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/**
 * Whether billing terms were said out loud at onboarding, and confirmed back.
 *
 * This exists because a client once churned believing the setup fee was a
 * lifetime fee and never registered the monthly retainer at all. It is a
 * one-checkbox insurance policy against the most expensive misunderstanding
 * this business has had.
 */
export async function setBillingConfirmed(input: {
  id: string;
  confirmed: boolean;
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("deals")
    .update({
      billing_terms_confirmed: input.confirmed,
      billing_terms_confirmed_on: input.confirmed ? today() : null,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Go-live date. Close-to-live on the dashboard is measured against this. */
export async function setGoLiveDate(input: {
  id: string;
  date: string | null;
}): Promise<ActionResult> {
  if (input.date !== null && !ISO_DATE.test(input.date)) {
    return { ok: false, error: "Invalid go-live date." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("deals")
    .update({ go_live_date: input.date })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** One checklist step for one client. Presence of the row is what "done" means. */
export async function setOnboardingStep(input: {
  client_id: string;
  step_key: string;
  done: boolean;
}): Promise<ActionResult> {
  if (!ONBOARDING_STEPS.some((step) => step.key === input.step_key)) {
    return { ok: false, error: "Unknown onboarding step." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (input.done) {
    const { error } = await supabase.from("onboarding_progress").upsert(
      { client_id: input.client_id, step_key: input.step_key, done_on: today() },
      { onConflict: "client_id,step_key" }
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("onboarding_progress")
      .delete()
      .eq("client_id", input.client_id)
      .eq("step_key", input.step_key);
    if (error) return { ok: false, error: error.message };
  }

  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Sets a project's status, keeping completed_date consistent with it.
 * Avg delivery time is measured off completed_date, so the same rule applies.
 */
export async function setProjectStatus(input: {
  id: string;
  status: ProjectStatus;
  completed_date?: string | null;
}): Promise<ActionResult> {
  if (!PROJECT_STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let completedDate: string | null = null;
  if (input.status === "completed") {
    const proposed = input.completed_date ?? today();
    if (!ISO_DATE.test(proposed)) return { ok: false, error: "Invalid completion date." };
    completedDate = proposed;
  }

  const { error } = await supabase
    .from("projects")
    .update({ status: input.status, completed_date: completedDate })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Inline edit of a project's target date — the date the overdue flag compares against. */
export async function setProjectTargetDate(input: {
  id: string;
  target_date: string | null;
}): Promise<ActionResult> {
  if (input.target_date !== null && !ISO_DATE.test(input.target_date)) {
    return { ok: false, error: "Invalid target date." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("projects")
    .update({ target_date: input.target_date })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function addProject(input: {
  deal_id: string;
  project_name: string;
  start_date: string;
  target_date: string | null;
}): Promise<ActionResult> {
  const name = input.project_name.trim();
  if (!name) return { ok: false, error: "Project name is required." };
  if (!ISO_DATE.test(input.start_date)) return { ok: false, error: "Invalid start date." };
  if (input.target_date !== null && !ISO_DATE.test(input.target_date)) {
    return { ok: false, error: "Invalid target date." };
  }

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("projects").insert({
    deal_id: input.deal_id,
    project_name: name,
    start_date: input.start_date,
    target_date: input.target_date,
    status: input.start_date > today() ? "not_started" : "in_progress",
  });

  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}
