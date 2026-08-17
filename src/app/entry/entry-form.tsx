"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, formatDMY, formatDM } from "@/lib/dates";
import type { LoggedDay } from "@/lib/metrics";
import type { AppSettings, DailyActivity } from "@/lib/types";
import { Badge, Card, cx } from "@/components/ui";
import { saveDailyEntry } from "./actions";

/**
 * The whole of my daily typing surface: four counts, one optional note, one save.
 *
 * There is no summary, no rate and no total on this page by design. Entry and
 * review are different jobs, and mixing them is what turned the old version into
 * a twenty-eight-cell grid nobody wanted to open.
 */

type Field = {
  key: keyof Draft;
  label: string;
  definition: string;
  target: (s: AppSettings) => number | null;
};

const FIELDS: Field[] = [
  {
    key: "outreach",
    label: "Outreach",
    definition: "Deliberate contact with a named person who could buy or refer.",
    target: (s) => s.outreach_target_per_day,
  },
  {
    key: "conversations",
    label: "Conversations started",
    definition: "A two-way exchange. A sent message on its own is not one.",
    target: (s) => s.conversations_target_per_day,
  },
  {
    key: "salesCalls",
    label: "Sales calls taken",
    definition: "Actual calls that happened. No target — log the number.",
    target: () => null,
  },
  {
    key: "deepWork",
    label: "Deep work blocks",
    definition: "Uninterrupted blocks on building, not admin.",
    target: (s) => s.deep_work_target_per_day,
  },
];

type Draft = {
  outreach: string;
  conversations: string;
  salesCalls: string;
  deepWork: string;
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
    conversations: show(row?.conversations ?? 0),
    salesCalls: show(row?.sales_calls ?? 0),
    deepWork: show(row?.deep_work_blocks ?? 0),
  };
}

export function EntryForm({
  entryDate,
  maxDate,
  initialRow,
  settings,
  last7Days,
  streak,
  loadError,
}: {
  entryDate: string;
  maxDate: string;
  initialRow: DailyActivity | null;
  settings: AppSettings;
  last7Days: LoggedDay[];
  streak: number;
  loadError: string | null;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

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
      conversations: toNumber(draft.conversations),
      sales_calls: toNumber(draft.salesCalls),
      deep_work_blocks: toNumber(draft.deepWork),
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

  function goToDate(date: string) {
    if (!date || date > maxDate) return;
    startNavigation(() => router.push(`/entry?date=${date}`));
  }

  const isToday = entryDate === maxDate;

  return (
    <div className="space-y-4">
      <DateNav
        entryDate={entryDate}
        maxDate={maxDate}
        isToday={isToday}
        onGo={goToDate}
      />

      <StreakStrip days={last7Days} streak={streak} selected={entryDate} onSelect={goToDate} />

      {loadError ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load this day: {loadError}
        </p>
      ) : null}

      <Card
        title="Today"
        subtitle="Blank counts as zero. All zeros still counts as a logged day."
        className={cx(navigating && "opacity-60 transition-opacity")}
        bodyClassName="p-0"
      >
        <div className="divide-y divide-line">
          {FIELDS.map((field) => {
            const target = field.target(settings);
            return (
              <label
                key={field.key}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-2/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-ink">{field.label}</span>
                    {target === null ? (
                      <span className="text-[11px] text-ink-faint">no target</span>
                    ) : (
                      <span className="tabular text-[11px] text-ink-faint">target {target}/day</span>
                    )}
                  </span>
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
            );
          })}
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
          placeholder="Public holiday, all day in delivery, XHS post took off…"
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

export function DateNav({
  entryDate,
  maxDate,
  isToday,
  onGo,
  label = "Date",
}: {
  entryDate: string;
  maxDate: string;
  isToday: boolean;
  onGo: (date: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-faint">
        {isToday ? "Today" : "Backfilling"} · {formatDMY(entryDate)}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onGo(addDays(entryDate, -1))}
          aria-label="Previous day"
          className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          ‹
        </button>
        <input
          type="date"
          value={entryDate}
          max={maxDate}
          onChange={(e) => onGo(e.target.value)}
          aria-label={label}
          className="tabular rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="button"
          onClick={() => onGo(addDays(entryDate, 1))}
          disabled={!(entryDate < maxDate)}
          aria-label="Next day"
          className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30 disabled:hover:border-line"
        >
          ›
        </button>
        {!isToday ? (
          <button
            type="button"
            onClick={() => onGo(maxDate)}
            className="ml-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Today
          </button>
        ) : null}
      </div>
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

/** Seven boxes. Gaps are the whole point — they should be obvious at a glance. */
function StreakStrip({
  days,
  streak,
  selected,
  onSelect,
}: {
  days: LoggedDay[];
  streak: number;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const missed = days.filter((d) => !d.logged).length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            title={`${formatDMY(day.date)} — ${day.logged ? "logged" : "not logged"}`}
            className={cx(
              "tabular w-11 rounded border px-1 py-1.5 text-center text-[10px] transition-colors",
              day.logged
                ? "border-accent/40 bg-accent/15 text-accent-bright hover:bg-accent/25"
                : "border-dashed border-line-strong bg-transparent text-ink-faint hover:border-warn/50 hover:text-warn",
              day.date === selected && "ring-1 ring-accent-bright"
            )}
          >
            {formatDM(day.date)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-ink-muted">
          <span className="tabular font-semibold text-ink">{streak}</span> day streak
        </span>
        {missed > 0 ? (
          <Badge tone="warn">{missed} of last 7 not logged</Badge>
        ) : (
          <Badge tone="good">Last 7 days complete</Badge>
        )}
      </div>
    </div>
  );
}
