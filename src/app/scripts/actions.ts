"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ScriptCategory } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createScriptEntry(input: {
  category: ScriptCategory;
  title: string;
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title can't be empty." };

  const { error } = await supabase.from("scripts").insert({
    category: input.category,
    title,
    body: "",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/scripts");
  return { ok: true };
}

export async function updateScriptEntry(input: {
  id: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title can't be empty." };

  const { error } = await supabase
    .from("scripts")
    .update({ title, body: input.body, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/scripts");
  return { ok: true };
}

export async function deleteScriptEntry(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("scripts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/scripts");
  return { ok: true };
}
