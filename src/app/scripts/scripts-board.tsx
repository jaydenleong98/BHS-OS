"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScriptCategory, ScriptEntry } from "@/lib/types";
import { Card, EmptyState, cx } from "@/components/ui";
import { createScriptEntry, deleteScriptEntry, updateScriptEntry } from "./actions";

/**
 * The script and objection-handling library. Two sections, same card shape:
 * a title, a body, save and delete. Nothing here is versioned or shared —
 * it's a personal reference, so the bar is "fast to open and fast to edit".
 */
export function ScriptsBoard({
  scripts,
  objections,
}: {
  scripts: ScriptEntry[];
  objections: ScriptEntry[];
}) {
  return (
    <div className="space-y-4">
      <Section
        category="script"
        title="Sales scripts"
        subtitle="Opening lines, discovery questions, closing language."
        addLabel="+ Add script"
        entries={scripts}
      />
      <Section
        category="objection"
        title="Objection handling"
        subtitle="One objection per card. Keep the response short enough to say out loud."
        addLabel="+ Add objection"
        entries={objections}
      />
    </div>
  );
}

function Section({
  category,
  title,
  subtitle,
  addLabel,
  entries,
}: {
  category: ScriptCategory;
  title: string;
  subtitle: string;
  addLabel: string;
  entries: ScriptEntry[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const title = draftTitle.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    const result = await createScriptEntry({ category, title });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraftTitle("");
    setAdding(false);
    setError(null);
    router.refresh();
  }

  return (
    <Card title={title} subtitle={subtitle} bodyClassName="space-y-3">
      {entries.length === 0 && !adding ? (
        <EmptyState compact title="Nothing here yet." hint={`Add your first entry with "${addLabel}" below.`} />
      ) : (
        entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
      )}

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") {
                setAdding(false);
                setDraftTitle("");
              }
            }}
            placeholder="Title…"
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent focus:bg-surface-3"
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-bright"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-md border border-dashed border-line-strong px-3 py-2 text-xs text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
        >
          {addLabel}
        </button>
      )}
    </Card>
  );
}

function EntryCard({ entry }: { entry: ScriptEntry }) {
  const router = useRouter();
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.body);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = title !== entry.title || body !== entry.body;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await updateScriptEntry({ id: entry.id, title, body });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function remove() {
    const result = await deleteScriptEntry(entry.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-md border border-line bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className={cx("text-xs text-ink-faint transition-transform", open && "rotate-90")}>
          ▸
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</span>
        {dirty ? <span className="shrink-0 text-[10px] text-warn">unsaved</span> : null}
      </button>

      {open ? (
        <div className="space-y-2 border-t border-line px-3 py-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium outline-none transition-colors focus:border-accent"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write it the way you'd actually say it."
            className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent"
          />

          {error ? (
            <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-2 py-1.5 text-xs text-bad">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            {confirmDelete ? (
              <>
                <span className="text-xs text-ink-faint">Delete this entry?</span>
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-md border border-bad/40 px-2.5 py-1.5 text-xs font-medium text-bad transition-colors hover:bg-bad/10"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-ink-faint hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-xs text-ink-faint transition-colors hover:text-bad"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
