"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/metrics";
import { formatDM, formatDMY } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { SOURCE_LABELS, SOURCES } from "@/lib/types";
import {
  axisProps,
  CHROME,
  gridProps,
  ROLLING_AVERAGE_COLOR,
  SOURCE_COLORS,
} from "@/lib/chart-theme";
import { EmptyState } from "@/components/ui";
import { ChartFrame, DataTable, Legend, TooltipCard } from "./chart-frame";

/**
 * Row B — daily lead volume by source, with the 7-day rolling average overlaid.
 *
 * Both series are leads per day, so they share one y-axis. The rolling average
 * is the line that actually gets read; the stack shows where the volume came from.
 */
export function VolumeChart({ points }: { points: DailyPoint[] }) {
  const hasData = points.some((p) => p.total > 0);

  // Only chart sources that actually appear — an all-zero band is noise in the
  // legend and the tooltip. Colour still follows the entity, so survivors keep
  // their hue when the range changes.
  const activeSources = SOURCES.filter((source) => points.some((p) => p[source] > 0));

  const legendItems = [
    ...activeSources.map((source) => ({
      label: SOURCE_LABELS[source],
      color: SOURCE_COLORS[source],
    })),
    { label: "7-day average", color: ROLLING_AVERAGE_COLOR, dashed: true },
  ];

  return (
    <ChartFrame
      title="Lead volume by source"
      subtitle="Daily counts are noisy — read the 7-day average line."
      legend={hasData ? <Legend items={legendItems} /> : undefined}
      chart={
        hasData ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="date"
                  {...axisProps}
                  tickFormatter={formatDM}
                  minTickGap={28}
                />
                <YAxis {...axisProps} width={44} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as DailyPoint;
                    return (
                      <TooltipCard
                        heading={formatDMY(String(label))}
                        rows={[
                          ...activeSources
                            .filter((source) => point[source] > 0)
                            .map((source) => ({
                              label: SOURCE_LABELS[source],
                              value: formatNumber(point[source]),
                              color: SOURCE_COLORS[source],
                            })),
                          {
                            label: "Total",
                            value: formatNumber(point.total),
                            emphasis: true,
                          },
                          {
                            label: "7-day average",
                            value:
                              point.rollingAverage === null
                                ? "—"
                                : point.rollingAverage.toFixed(1),
                            color: ROLLING_AVERAGE_COLOR,
                          },
                        ]}
                      />
                    );
                  }}
                />

                {activeSources.map((source) => (
                  <Area
                    key={source}
                    type="monotone"
                    dataKey={source}
                    stackId="leads"
                    fill={SOURCE_COLORS[source]}
                    fillOpacity={0.85}
                    // A 2px stroke in the surface colour is the gap between
                    // stacked segments — not a border drawn around the mark.
                    stroke={CHROME.surface}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}

                <Line
                  type="monotone"
                  dataKey="rollingAverage"
                  stroke={ROLLING_AVERAGE_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            compact
            title="No leads logged in this range."
            hint="Nothing recorded between these dates. Backfill from the Daily Entry page if that's a gap rather than a quiet spell."
          />
        )
      }
      table={
        <DataTable
          columns={[
            { key: "date", label: "Date" },
            ...activeSources.map((source) => ({
              key: source,
              label: SOURCE_LABELS[source],
              align: "right" as const,
            })),
            { key: "total", label: "Total", align: "right" as const },
            { key: "avg", label: "7d avg", align: "right" as const },
          ]}
          rows={points.map((point) => ({
            date: formatDMY(point.date),
            ...Object.fromEntries(
              activeSources.map((source) => [source, formatNumber(point[source])])
            ),
            total: formatNumber(point.total),
            avg: point.rollingAverage === null ? "—" : point.rollingAverage.toFixed(1),
          }))}
        />
      }
    />
  );
}
