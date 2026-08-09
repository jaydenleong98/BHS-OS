"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import {
  DEAL_STATUSES,
  PROJECT_STATUSES,
  type DealStatus,
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
  revalidatePath("/entry");
}

/**
 * Sets a deal's status, keeping churn_date consistent with it.
 *
 * This matters more than it looks: MRR is defined off churn_date, not status.
 * Letting the two drift would leave a churned client still billing on the
 * dashboard, so churning always stamps a date and un-churning always clears it.
 */
export async function setDealStatus(input: {
  id: string;
  status: DealStatus;
  churn_date?: string | null;
}): Promise<ActionResult> {
  if (!DEAL_STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };

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

/** Edit the commercials on a deal. Both feed MRR and cash collected. */
export async function updateDealFees(input: {
  id: string;
  setup_fee_myr: number;
  monthly_fee_myr: number;
}): Promise<ActionResult> {
  const clean = (n: number) =>
    Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;

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
