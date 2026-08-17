"use client";

import { useMemo, useState } from "react";
import type { SourceRow } from "@/lib/metrics";
import { formatMYR, formatMYRPrecise, formatNumber, formatPct } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/types";
import { Card, cx, EmptyState } from "@/components/ui";

type ColumnKey = keyof Omit<SourceRow, "source">;

type Column = {
  key: ColumnKey;
  label: string;
  render: (row: SourceRow) => string;
  /** Rates and money get a tighter, dimmer treatment than the raw counts. */
  group: "count" | "rate" | "money";
  /** Lower is better — flips the heat direction. */
  lowerIsBetter?: boolean;
  title?: string;
};

const COLUMNS: Column[] = [
  { key: "prospects", label: "Prospects", render: (r) => formatNumber(r.prospects), group: "count" },
  {
    key: "conversations",
    label: "Convos",
    render: (r) => formatNumber(r.conversations),
    group: "count",
  },
  { key: "booked", label: "Booked", render: (r) => formatNumber(r.booked), group: "count" },
  { key: "taken", label: "Taken", render: (r) => formatNumber(r.taken), group: "count" },
  { key: "closed", label: "Closed", render: (r) => formatNumber(r.closed), group: "count" },
  {
    key: "conversationRate",
    label: "→ Convo",
    render: (r) => formatPct(r.conversationRate),
    group: "rate",
    title: "conversations ÷ prospects added",
  },
  {
    key: "showRate",
    label: "Show rate",
    render: (r) => formatPct(r.showRate),
    group: "rate",
    title: "calls taken ÷ calls booked",
  },
  {
    key: "closeRate",
    label: "Close rate",
    render: (r) => formatPct(r.closeRate),
    group: "rate",
    title: "won ÷ calls taken",
  },
  { key: "spend", label: "Spend", render: (r) => formatMYR(r.spend), group: "money" },
  {
    key: "costPerProspect",
    label: "Cost/prospect",
    render: (r) => formatMYRPrecise(r.costPerProspect),
    group: "money",
    lowerIsBetter: true,
    title: "spend ÷ prospects added",
  },
  {
    key: "costPerAcquisition",
    label: "Cost/acquisition",
    render: (r) => formatMYR(r.costPerAcquisition),
    group: "money",
    lowerIsBetter: true,
    title: "spend ÷ clients won",
  },
  {
    key: "revenue",
    label: "Revenue",
    render: (r) => formatMYR(r.revenue),
    group: "money",
    title: "Setup + monthly fees of clients won in range, by source",
  },
];

/**
 * Where the "spend more effort here" decision gets made — on the Analysis tab,
 * not the dashboard, because at this volume every rate in it needs a long window
 * and a sceptical reader.
 *
 * Sortable on every column. Best and worst in each rate/cost column are tinted
 * so the read is immediate, but the tint is a background wash — the value itself
 * stays in text colour and is never encoded by colour alone.
 */
export function SourceTable({ rows, totals }: { rows: SourceRow[]; totals: SourceRow }) {
  const [sortKey, setSortKey] = useState<ColumnKey>("prospects");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Undefined rates sort to the bottom regardless of direction — a source
      // with no denominator isn't "worst", it's unmeasured.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return descending ? bv - av : av - bv;
    });
    return copy;
  }, [rows, sortKey, descending]);

  /** Best/worst per column, ignoring nulls and single-value columns. */
  const extremes = useMemo(() => {
    const map = new Map<ColumnKey, { best: number; worst: number }>();
    for (const column of COLUMNS) {
      if (column.group === "count") continue;
      const values = rows
        .map((r) => r[column.key])
        .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
      if (values.length < 2) continue;
      const high = Math.max(...values);
      const low = Math.min(...values);
      if (high === low) continue;
      map.set(column.key, {
        best: column.lowerIsBetter ? low : high,
        worst: column.lowerIsBetter ? high : low,
      });
    }
    return map;
  }, [rows]);

  function toggleSort(key: ColumnKey) {
    if (key === sortKey) setDescending((d) => !d);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  if (rows.length === 0) {
    return (
      <Card title="Source performance">
        <EmptyState
          compact
          title="No source activity in this range."
          hint="Sources appear here once they have a prospect, spend, or a won client against them."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Source performance"
      subtitle="Sorted by any column. Counts come from prospect stage dates; spend is whichever months the range touches."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-xs">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint"
              >
                Source
              </th>
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    title={column.title}
                    className={cx(
                      "border-b border-line px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide",
                      column.group === "money" && "border-l border-line",
                      active ? "text-accent-bright" : "text-ink-faint"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
                      className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                    >
                      {column.label}
                      <span aria-hidden className={cx(!active && "opacity-0")}>
                        {descending ? "▾" : "▴"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row) => (
              <tr key={row.source} className="group hover:bg-surface-2/40">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5 text-left font-normal text-ink group-hover:bg-surface-2"
                >
                  {SOURCE_LABELS[row.source]}
                </th>

                {COLUMNS.map((column) => {
                  const value = row[column.key];
                  const extreme = extremes.get(column.key);
                  const isBest = extreme !== undefined && value === extreme.best;
                  const isWorst = extreme !== undefined && value === extreme.worst;

                  return (
                    <td
                      key={column.key}
                      className={cx(
                        "tabular border-b border-line px-3 py-1.5 text-right",
                        column.group === "money" && "border-l border-line",
                        value === null ? "text-ink-faint" : "text-ink-muted",
                        isBest && "bg-good/10 text-ink",
                        isWorst && "bg-bad/10 text-ink"
                      )}
                    >
                      {column.render(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-surface-2/60">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-faint"
              >
                All sources
              </th>
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "tabular px-3 py-2 text-right font-medium text-ink",
                    column.group === "money" && "border-l border-line"
                  )}
                >
                  {column.render(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-line px-3 py-2 text-[11px] text-ink-faint">
        Green marks the best value in a column, red the worst. Cost columns invert — lower wins. A
        dash means the denominator was zero, not that the value is zero. At six to eight closes a
        year, treat every rate in this table as a hint, not a finding.
      </p>
    </Card>
  );
}
