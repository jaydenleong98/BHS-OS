"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDMY } from "@/lib/dates";
import type { DailyActivity } from "@/lib/types";
import { Card } from "@/components/ui";
import { saveDailyEntry } from "./actions";

/**
 * The whole daily typing surface: four counts, one optional note, one save.
 *
 * There is no summary, no rate and no total on this page by design. Entry and
 * review are different jobs — review lives on the Dashboard.
 */

type Field = {
  key: keyof Draft;
  label: string;
  definition: string;
};

const FIELDS: Field[] = [
  {
    key: "outreach",
    label: "Outreach",
    definition: "New, cold contact with a named prospect.",
  },
  {
    key: "followUp",
    label: "Follow-up",
    definition: "A touch on a prospect already in conversation.",
  },
  {
    key: "meetingsBooked",
    label: "Meetings booked",
    definition: "A call or meeting confirmed on the calendar today.",
  },
  {
    key: "meetingsAttended",
    label: "Meetings attended",
    definition: "A call or meeting that actually happened today.",
  },
];

type Draft = {
  outreach: string;
  followUp: string;
  meetingsBooked: string;
  meetingsAttended: string;
};

/** Blank means zero, so a zero from the database is rendered blank. */
const show = (value: number): string => (value === 0 ? "" : String(value));

const toNumber = (value: string): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function buildDraft(row: DailyActivity | null): Draft {
  return {
    outreach: show(row?.outreach ?? 0),
    followUp: show(row?.follow_up ?? 0),
    meetingsBooked: show(row?.meetings_booked ?? 0),
    meetingsAttended: show(row?.meetings_attended ?? 0),
  };
}

export function EntryForm({
  entryDate,
  maxDate,
  initialRow,
  loadError,
}: {
  entryDate: string;
  maxDate: string;
  initialRow: DailyActivity | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => buildDraft(initialRow));
  const [note, setNote] = useState(initialRow?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snapshot of what's on the server, so "unsaved changes" is truthful.
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ draft: buildDraft(initialRow), note: initialRow?.note ?? "" })
  );
  const dirty = JSON.stringify({ draft, note }) !== baseline;

  const saveRef = useRef<() => void>(() => {});

  function setField(key: keyof Draft, value: string) {
    // Digits only; nothing else can reach the action.
    const cleaned = value.replace(/[^\d]/g, "");
    setDraft((prev) => ({ ...prev, [key]: cleaned }));
    setSavedAt(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const result = await saveDailyEntry({
      entry_date: entryDate,
      outreach: toNumber(draft.outreach),
      follow_up: toNumber(draft.followUp),
      meetings_booked: toNumber(draft.meetingsBooked),
      meetings_attended: toNumber(draft.meetingsAttended),
      note,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBaseline(JSON.stringify({ draft, note }));
    setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    router.refresh();
  }

  saveRef.current = save;

  // Ctrl/Cmd+S saves. Muscle memory beats reaching for the mouse.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Warn before losing typed-but-unsaved numbers.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const isToday = entryDate === maxDate;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-faint">
        {isToday ? "Today" : "Backfilling"} · {formatDMY(entryDate)}
      </p>

      {loadError ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load this day: {loadError}
        </p>
      ) : null}

      <Card
        title={isToday ? "Today" : formatDMY(entryDate)}
        subtitle="Blank counts as zero. All zeros still counts as a logged day."
        bodyClassName="p-0"
      >
        <div className="divide-y divide-line">
          {FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/40"
            >
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium text-ink">{field.label}</span>
                <span className="mt-0.5 block text-xs text-ink-faint">{field.definition}</span>
              </span>

              <input
                type="text"
                inputMode="numeric"
                value={draft[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                aria-label={field.label}
                className="tabular w-24 shrink-0 rounded-md border border-line bg-surface-2 px-3 py-2.5 text-right text-lg outline-none transition-colors placeholder:text-ink-faint/40 focus:border-accent focus:bg-surface-3"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Note" subtitle="Why today looked the way it did. Optional." bodyClassName="p-3">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSavedAt(null);
          }}
          rows={2}
          placeholder="Public holiday, chasing a proposal, good call with a new lead…"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent focus:bg-surface-3"
        />
      </Card>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      <SaveBar saving={saving} dirty={dirty} savedAt={savedAt} onSave={save} />
    </div>
  );
}

export function SaveBar({
  saving,
  dirty,
  savedAt,
  onSave,
  label = "Save entry",
}: {
  saving: boolean;
  dirty: boolean;
  savedAt: string | null;
  onSave: () => void;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
        >
          {saving ? "Saving…" : label}
        </button>

        <span aria-live="polite" className="text-xs">
          {savedAt ? (
            <span className="text-good">✓ Saved at {savedAt}</span>
          ) : dirty ? (
            <span className="text-warn">Unsaved changes</span>
          ) : (
            <span className="text-ink-faint">Up to date</span>
          )}
        </span>

        <kbd className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint sm:inline">
          Ctrl+S
        </kbd>
      </div>
    </div>
  );
}
