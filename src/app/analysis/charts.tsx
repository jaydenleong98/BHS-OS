"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyProspectPoint, SourceRow } from "@/lib/metrics";
import { formatMonthKey, formatMonthKeyShort } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/types";
import { axisProps, CHROME, gridProps, SECONDARY_SERIES } from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui";
import { ChartFrame, DataTable, Legend, TooltipCard } from "@/components/chart-frame";

/**
 * Prospects by source.
 *
 * Horizontal bars, one hue, sorted. Source identity is carried by the axis label
 * rather than by colour — with ten sources there is no colour palette that stays
 * colourblind-safe, and a sorted bar chart answers "which source produces" more
 * directly than a ten-band stack ever did.
 */
export function SourceBars({ rows }: { rows: SourceRow[] }) {
  const data = rows
    .filter((row) => row.prospects > 0 || row.closed > 0)
    .map((row) => ({
      source: SOURCE_LABELS[row.source],
      prospects: row.prospects,
      closed: row.closed,
    }))
    .sort((a, b) => b.prospects - a.prospects || b.closed - a.closed);

  return (
    <ChartFrame
      title="Prospects by source"
      subtitle="Everyone who entered the pipeline in range, by where they came from."
      chart={
        data.length > 0 ? (
          <div className="w-full" style={{ height: Math.max(data.length * 34 + 24, 140) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
              >
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" {...axisProps} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  {...axisProps}
                  width={84}
                  tick={{ fill: CHROME.inkMuted, fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: CHROME.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as (typeof data)[number];
                    return (
                      <TooltipCard
                        heading={point.source}
                        rows={[
                          {
                            label: "Prospects",
                            value: formatNumber(point.prospects),
                            color: CHROME.accent,
                            emphasis: true,
                          },
                          { label: "Won", value: formatNumber(point.closed) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="prospects"
                  fill={CHROME.accent}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                  label={{ position: "right", fill: CHROME.inkMuted, fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            compact
            title="No prospects entered in this range."
            hint="Add prospects on the Pipeline page and this fills in from their source."
          />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "source", label: "Source" },
            { key: "prospects", label: "Prospects", align: "right" },
            { key: "closed", label: "Won", align: "right" },
          ]}
          rows={data.map((row) => ({
            source: row.source,
            prospects: formatNumber(row.prospects),
            closed: formatNumber(row.closed),
          }))}
        />
      }
    />
  );
}

/**
 * Pipeline volume by month: how many prospects entered against how many closed.
 *
 * Two series, so both a legend and a table view are present — the pair passes on
 * normal vision and deutan but sits in the floor band on tritan, which makes the
 * secondary encoding mandatory rather than nice to have. Bars are grouped rather
 * than stacked for the same reason: never rely on the colour boundary.
 */
export function ProspectVolumeChart({ points }: { points: MonthlyProspectPoint[] }) {
  const hasData = points.some((p) => p.added > 0 || p.won > 0);

  return (
    <ChartFrame
      title="Pipeline volume by month"
      subtitle="Entered vs won. Counted by the month each stage date falls in."
      legend={
        hasData ? (
          <Legend
            items={[
              { label: "Entered", color: CHROME.accent },
              { label: "Won", color: SECONDARY_SERIES },
            ]}
          />
        ) : undefined
      }
      chart={
        hasData ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={formatMonthKeyShort} />
                <YAxis {...axisProps} width={40} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: CHROME.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as MonthlyProspectPoint;
                    return (
                      <TooltipCard
                        heading={formatMonthKey(point.month)}
                        rows={[
                          {
                            label: "Entered",
                            value: formatNumber(point.added),
                            color: CHROME.accent,
                            emphasis: true,
                          },
                          {
                            label: "Won",
                            value: formatNumber(point.won),
                            color: SECONDARY_SERIES,
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="added"
                  fill={CHROME.accent}
                  maxBarSize={20}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="won"
                  fill={SECONDARY_SERIES}
                  maxBarSize={20}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState compact title="No pipeline movement in this range." />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "month", label: "Month" },
            { key: "added", label: "Entered", align: "right" },
            { key: "won", label: "Won", align: "right" },
          ]}
          rows={points.map((point) => ({
            month: formatMonthKey(point.month),
            added: formatNumber(point.added),
            won: formatNumber(point.won),
          }))}
        />
      }
    />
  );
}
