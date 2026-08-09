"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, formatDMY, formatDM } from "@/lib/dates";
import { conversionRates, type FunnelTotals, type LoggedDay } from "@/lib/metrics";
import { formatMYR, formatMYRPrecise, formatPct } from "@/lib/format";
import {
  SOURCES,
  SOURCE_LABELS,
  TIER_LABELS,
  type DailyLead,
  type Deal,
  type Source,
} from "@/lib/types";
import { Badge, Card, cx, EmptyState } from "@/components/ui";
import { saveDailyEntry, type EntryRowInput } from "./actions";
import { DealModal } from "./deal-modal";

type Cell = { leads: string; booked: string; taken: string; spend: string };
type Grid = Record<Source, Cell>;

const EMPTY_CELL: Cell = { leads: "", booked: "", taken: "", spend: "" };

/** Blank means zero, so a zero from the database is rendered blank. */
function show(value: number): string {
  return value === 0 ? "" : String(value);
}

function buildGrid(rows: DailyLead[]): Grid {
  const grid = {} as Grid;
  for (const source of SOURCES) {
    const row = rows.find((r) => r.source === source);
    grid[source] = row
      ? {
          leads: show(row.leads_generated),
          booked: show(row.calls_booked),
          taken: show(row.calls_taken),
          spend: show(row.spend_myr),
        }
      : { ...EMPTY_CELL };
  }
  return grid;
}

const toNumber = (value: string): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const FIELDS: { key: keyof Cell; label: string; short: string; decimal?: boolean }[] = [
  { key: "leads", label: "Leads", short: "Leads" },
  { key: "booked", label: "Calls booked", short: "Booked" },
  { key: "taken", label: "Calls taken", short: "Taken" },
  { key: "spend", label: "Spend (RM)", short: "Spend", decimal: true },
];

export function EntryForm({
  entryDate,
  maxDate,
  initialRows,
  initialNote,
  dealsOnDate,
  last7Days,
  streak,
  loadError,
}: {
  entryDate: string;
  maxDate: string;
  initialRows: DailyLead[];
  initialNote: string;
  dealsOnDate: Deal[];
  last7Days: LoggedDay[];
  streak: number;
  loadError: string | null;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const [grid, setGrid] = useState<Grid>(() => buildGrid(initialRows));
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dealModalOpen, setDealModalOpen] = useState(false);

  // Snapshot of what's on the server, so "unsaved changes" is truthful.
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ grid: buildGrid(initialRows), note: initialNote })
  );
  const dirty = JSON.stringify({ grid, note }) !== baseline;

  const saveRef = useRef<() => void>(() => {});

  const totals = useMemo(() => {
    let leads = 0;
    let callsBooked = 0;
    let callsTaken = 0;
    let spend = 0;
    for (const source of SOURCES) {
      leads += toNumber(grid[source].leads);
      callsBooked += toNumber(grid[source].booked);
      callsTaken += toNumber(grid[source].taken);
      spend += toNumber(grid[source].spend);
    }
    const t: FunnelTotals = {
      leads,
      callsBooked,
      callsTaken,
      dealsClosed: dealsOnDate.length,
      spend,
    };
    return t;
  }, [grid, dealsOnDate.length]);

  const rates = useMemo(() => conversionRates(totals), [totals]);

  function setCell(source: Source, field: keyof Cell, value: string) {
    // Digits plus at most one decimal point; nothing else can reach the action.
    const cleaned = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setGrid((prev) => ({ ...prev, [source]: { ...prev[source], [field]: cleaned } }));
    setSavedAt(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const rows: EntryRowInput[] = SOURCES.map((source) => ({
      source,
      leads_generated: toNumber(grid[source].leads),
      calls_booked: toNumber(grid[source].booked),
      calls_taken: toNumber(grid[source].taken),
      spend_myr: toNumber(grid[source].spend),
    }));

    const result = await saveDailyEntry({ entry_date: entryDate, rows, note });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setBaseline(JSON.stringify({ grid, note }));
    setSavedAt(
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
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
  const canGoForward = entryDate < maxDate;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24 sm:pb-4">
      {/* Header: date navigation + logging streak */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Daily Entry</h1>
          <p className="mt-0.5 text-xs text-ink-faint">
            {isToday ? "Today" : "Backfilling"} · {formatDMY(entryDate)}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToDate(addDays(entryDate, -1))}
            aria-label="Previous day"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            ‹
          </button>
          <input
            type="date"
            value={entryDate}
            max={maxDate}
            onChange={(e) => goToDate(e.target.value)}
            className="tabular rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="button"
            onClick={() => goToDate(addDays(entryDate, 1))}
            disabled={!canGoForward}
            aria-label="Next day"
            className="rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30 disabled:hover:border-line"
          >
            ›
          </button>
          {!isToday ? (
            <button
              type="button"
              onClick={() => goToDate(maxDate)}
              className="ml-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Today
            </button>
          ) : null}
        </div>
      </div>

      <StreakStrip days={last7Days} streak={streak} selected={entryDate} onSelect={goToDate} />

      {loadError ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Could not load this day: {loadError}
        </p>
      ) : null}

      {/* The grid */}
      <Card
        title="Flow metrics"
        subtitle="Only what happened today. Blank counts as zero."
        className={cx(navigating && "opacity-60 transition-opacity")}
        bodyClassName="p-0"
      >
        {/* Desktop: column headers */}
        <div className="hidden grid-cols-[8.5rem_repeat(4,1fr)] gap-px border-b border-line bg-line px-0 sm:grid">
          <div className="bg-surface px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Source
          </div>
          {FIELDS.map((f) => (
            <div
              key={f.key}
              className="bg-surface px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-faint"
            >
              {f.short}
            </div>
          ))}
        </div>

        <div className="divide-y divide-line sm:divide-y-0">
          {SOURCES.map((source) => (
            <div
              key={source}
              className="px-3 py-3 sm:grid sm:grid-cols-[8.5rem_repeat(4,1fr)] sm:items-center sm:gap-2 sm:px-0 sm:py-0"
            >
              <div className="mb-2 text-sm font-medium text-ink sm:mb-0 sm:px-3 sm:py-1.5 sm:text-ink-muted">
                {SOURCE_LABELS[source]}
              </div>

              <div className="grid grid-cols-4 gap-2 sm:contents">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block sm:px-1 sm:py-1">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-faint sm:hidden">
                      {f.short}
                    </span>
                    <input
                      type="text"
                      inputMode={f.decimal ? "decimal" : "numeric"}
                      value={grid[source][f.key]}
                      onChange={(e) => setCell(source, f.key, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      aria-label={`${SOURCE_LABELS[source]} — ${f.label}`}
                      className="tabular w-full rounded-md border border-line bg-surface-2 px-2.5 py-2 text-right text-sm outline-none transition-colors placeholder:text-ink-faint/50 focus:border-accent focus:bg-surface-3 sm:py-1.5"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Running total */}
        <div className="grid grid-cols-4 gap-2 border-t border-line-strong px-3 py-3 sm:grid-cols-[8.5rem_repeat(4,1fr)] sm:gap-2 sm:px-0">
          <div className="col-span-4 text-[11px] font-medium uppercase tracking-wide text-ink-faint sm:col-span-1 sm:px-3 sm:py-2">
            Total
          </div>
          <div className="tabular px-1 text-right text-sm font-semibold sm:px-3 sm:py-2">
            {totals.leads}
          </div>
          <div className="tabular px-1 text-right text-sm font-semibold sm:px-3 sm:py-2">
            {totals.callsBooked}
          </div>
          <div className="tabular px-1 text-right text-sm font-semibold sm:px-3 sm:py-2">
            {totals.callsTaken}
          </div>
          <div className="tabular px-1 text-right text-sm font-semibold sm:px-3 sm:py-2">
            {totals.spend > 0 ? formatMYRPrecise(totals.spend) : "—"}
          </div>
        </div>

        {/* Same definitions as the dashboard funnel, scoped to this one day. */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-3 py-2.5 text-xs text-ink-faint sm:px-4">
          <span>
            Lead→Booked <span className="tabular text-ink-muted">{formatPct(rates.leadToBooked)}</span>
          </span>
          <span>
            Show rate <span className="tabular text-ink-muted">{formatPct(rates.showRate)}</span>
          </span>
          <span>
            Cost/lead <span className="tabular text-ink-muted">{formatMYRPrecise(rates.costPerLead)}</span>
          </span>
          <span>
            Closed today <span className="tabular text-ink-muted">{dealsOnDate.length}</span>
          </span>
        </div>
      </Card>

      {/* Day note */}
      <Card title="Note" subtitle="Why today looked the way it did. Optional." bodyClassName="p-3">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSavedAt(null);
          }}
          rows={2}
          placeholder="Public holiday, ad account paused, XHS post took off…"
          className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-faint/60 focus:border-accent focus:bg-surface-3"
        />
      </Card>

      {/* Deals closed on this date */}
      <Card
        title="Closed deals"
        subtitle={`Logged against ${formatDMY(entryDate)}`}
        action={
          <button
            type="button"
            onClick={() => setDealModalOpen(true)}
            className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent-bright transition-colors hover:bg-accent/20"
          >
            + Log a closed deal
          </button>
        }
        bodyClassName="p-3"
      >
        {dealsOnDate.length === 0 ? (
          <EmptyState
            compact
            title="No deals closed on this date."
            hint="Closing one today? Log it here — it's the conversion record the whole funnel ends on."
          />
        ) : (
          <ul className="divide-y divide-line">
            {dealsOnDate.map((deal) => (
              <li key={deal.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
                <span className="text-sm font-medium text-ink">{deal.client_name}</span>
                <Badge>{SOURCE_LABELS[deal.source]}</Badge>
                {deal.tier ? <Badge tone="accent">{TIER_LABELS[deal.tier]}</Badge> : null}
                <span className="tabular ml-auto text-xs text-ink-muted">
                  {formatMYR(deal.setup_fee_myr)} setup · {formatMYR(deal.monthly_fee_myr)}/mo
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error ? (
        <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      ) : null}

      {/* Save bar — sticks to the bottom on mobile so it's always one thumb away. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
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

      {dealModalOpen ? (
        <DealModal
          defaultCloseDate={entryDate}
          maxDate={maxDate}
          onClose={() => setDealModalOpen(false)}
          onSaved={() => {
            setDealModalOpen(false);
            router.refresh();
          }}
        />
      ) : null}
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
          <Badge tone="warn">
            {missed} of last 7 not logged
          </Badge>
        ) : (
          <Badge tone="good">Last 7 days complete</Badge>
        )}
      </div>
    </div>
  );
}
