"use client";

import { useMemo, useState } from "react";
import type { SourceRow } from "@/lib/metrics";
import { formatMYR, formatMYRPrecise, formatNumber, formatPct } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/types";
import { SOURCE_COLORS } from "@/lib/chart-theme";
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
  { key: "leads", label: "Leads", render: (r) => formatNumber(r.leads), group: "count" },
  { key: "callsBooked", label: "Booked", render: (r) => formatNumber(r.callsBooked), group: "count" },
  { key: "callsTaken", label: "Taken", render: (r) => formatNumber(r.callsTaken), group: "count" },
  { key: "dealsClosed", label: "Closed", render: (r) => formatNumber(r.dealsClosed), group: "count" },
  {
    key: "leadToBooked",
    label: "Lead→Booked",
    render: (r) => formatPct(r.leadToBooked),
    group: "rate",
    title: "calls_booked ÷ leads_generated",
  },
  {
    key: "bookedToTaken",
    label: "Booked→Taken",
    render: (r) => formatPct(r.bookedToTaken),
    group: "rate",
    title: "calls_taken ÷ calls_booked",
  },
  {
    key: "takenToClosed",
    label: "Taken→Closed",
    render: (r) => formatPct(r.takenToClosed),
    group: "rate",
    title: "deals closed ÷ calls_taken",
  },
  { key: "spend", label: "Spend", render: (r) => formatMYR(r.spend), group: "money" },
  {
    key: "costPerLead",
    label: "Cost/lead",
    render: (r) => formatMYRPrecise(r.costPerLead),
    group: "money",
    lowerIsBetter: true,
    title: "spend ÷ leads_generated",
  },
  {
    key: "costPerDeal",
    label: "Cost/deal",
    render: (r) => formatMYR(r.costPerDeal),
    group: "money",
    lowerIsBetter: true,
    title: "spend ÷ deals closed",
  },
  {
    key: "revenue",
    label: "Revenue",
    render: (r) => formatMYR(r.revenue),
    group: "money",
    title: "Setup fees + monthly fees of deals closed in range, by source",
  },
];

/**
 * Row C — where the "spend more effort here" decision gets made.
 *
 * Sortable on every column. Best and worst in each rate/cost column are tinted
 * so the read is immediate, but the tint is a background wash — the value itself
 * stays in text colour and is never encoded by colour alone.
 */
export function SourceTable({ rows, totals }: { rows: SourceRow[]; totals: SourceRow }) {
  const [sortKey, setSortKey] = useState<ColumnKey>("leads");
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
          hint="Sources appear here once they have leads, spend, or a closed deal against them."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Source performance"
      subtitle="Sorted by any column. Revenue is setup + monthly fees from deals closed in range."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-xs">
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
                  className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5 text-left font-normal group-hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: SOURCE_COLORS[row.source] }}
                    />
                    <span className="text-ink">{SOURCE_LABELS[row.source]}</span>
                  </span>
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
        Green marks the best value in a column, red the worst. Cost columns invert — lower wins.
        A dash means the denominator was zero, not that the value is zero.
      </p>
    </Card>
  );
}
