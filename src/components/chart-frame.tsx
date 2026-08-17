"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

/**
 * Card wrapper that carries a chart and its table-view twin.
 *
 * Every chart here has a table: a tooltip must never be the only way to read a
 * value, and a colour-only encoding needs a WCAG-clean equivalent.
 */
export function ChartFrame({
  title,
  subtitle,
  legend,
  chart,
  table,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <section className={cx("rounded-lg border border-line bg-surface", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-0.5 rounded border border-line bg-surface-2 p-0.5">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cx(
                "rounded px-2 py-1 text-[11px] capitalize transition-colors",
                view === v ? "bg-accent/15 text-accent-bright" : "text-ink-faint hover:text-ink"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {view === "chart" ? (
        <div className="p-4">
          {legend}
          {chart}
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto">{table}</div>
      )}
    </section>
  );
}

/** Legend swatch row. Always present for two or more series. */
export function Legend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span
            aria-hidden
            className="inline-block rounded-sm"
            style={
              item.dashed
                ? { width: 14, height: 2, background: item.color }
                : { width: 10, height: 10, background: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

type TooltipRow = { label: string; value: string; color?: string; emphasis?: boolean };

/** Shared tooltip body, so every chart's hover layer looks the same. */
export function TooltipCard({ heading, rows }: { heading: string; rows: TooltipRow[] }) {
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-2.5 py-2 shadow-lg">
      <div className="mb-1 text-[11px] font-medium text-ink">{heading}</div>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[11px]">
            {row.color ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ background: row.color }}
              />
            ) : (
              <span aria-hidden className="inline-block h-2 w-2 shrink-0" />
            )}
            <span className={cx("text-ink-faint", row.emphasis && "text-ink-muted")}>
              {row.label}
            </span>
            <span
              className={cx(
                "tabular ml-auto",
                row.emphasis ? "font-medium text-ink" : "text-ink-muted"
              )}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Plain data table used as every chart's table view. */
export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, ReactNode>[];
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead className="sticky top-0 bg-surface-2">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className={cx(
                "border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint",
                col.align === "right" ? "text-right" : "text-left"
              )}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-surface-2/50">
            {columns.map((col) => (
              <td
                key={col.key}
                className={cx(
                  "tabular border-b border-line px-3 py-1.5 text-ink-muted",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
